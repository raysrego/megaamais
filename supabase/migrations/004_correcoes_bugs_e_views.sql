-- ============================================================
-- MIGRATION 004: Correções de Bugs e Views Adicionais (CORRIGIDA)
-- Validada contra schema real do banco
-- ============================================================

-- 1. prestacoes_contas já existe no banco — pular criação.
-- (Schema real: id, loja_id, operador_id, responsavel_id, valor_total, metodo_pagamento, data_hora, observacao)

-- 2. Migrar roles legados (master → admin, op_master → op_admin)
UPDATE perfis SET role = 'admin' WHERE role = 'master';
UPDATE perfis SET role = 'op_admin' WHERE role = 'op_master';

-- 3. Trigger para registrar vendas de bolão em caixa_movimentacoes
-- CORRIGIDO: vendas_boloes usa usuario_id (não operador_id),
-- metodo_pagamento (não forma_pagamento), quantidade_cotas (não quantidade)
CREATE OR REPLACE FUNCTION fn_registrar_venda_bolao_no_caixa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sessao_id BIGINT;
    v_produto_nome TEXT;
    v_tipo_mov TEXT;
BEGIN
    -- Buscar sessão de caixa aberta para este usuário
    -- Usa sessao_caixa_id se já veio preenchido, senão busca a aberta
    IF NEW.sessao_caixa_id IS NOT NULL THEN
        v_sessao_id := NEW.sessao_caixa_id;
    ELSE
        SELECT id INTO v_sessao_id
        FROM caixa_sessoes
        WHERE operador_id = NEW.usuario_id
          AND status = 'aberto'
        ORDER BY data_abertura DESC
        LIMIT 1;
    END IF;

    -- Se não tem sessão, não registra (venda avulsa)
    IF v_sessao_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Buscar nome do produto
    SELECT p.nome INTO v_produto_nome
    FROM boloes b
    JOIN produtos p ON p.id = b.produto_id
    WHERE b.id = NEW.bolao_id;

    -- Determinar tipo baseado no metodo_pagamento (é um enum, comparar com cast)
    v_tipo_mov := CASE
        WHEN NEW.metodo_pagamento::text = 'pix' THEN 'venda_bolao_pix'
        ELSE 'venda_bolao'
    END;

    -- Inserir movimentação no caixa
    INSERT INTO caixa_movimentacoes (
        sessao_id, tipo, valor, descricao, created_at
    ) VALUES (
        v_sessao_id,
        v_tipo_mov,
        NEW.valor_total,
        FORMAT('Bolão %s - %s cota(s)',
               COALESCE(v_produto_nome, '#' || NEW.bolao_id),
               NEW.quantidade_cotas),
        NOW()
    );

    -- Atualizar valor_final_calculado da sessão
    UPDATE caixa_sessoes
    SET valor_final_calculado = COALESCE(valor_final_calculado, 0) + NEW.valor_total
    WHERE id = v_sessao_id;

    RETURN NEW;
END;
$$;

-- Criar trigger (drop primeiro para ser idempotente)
DROP TRIGGER IF EXISTS trg_venda_bolao_no_caixa ON vendas_boloes;
CREATE TRIGGER trg_venda_bolao_no_caixa
    AFTER INSERT ON vendas_boloes
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_venda_bolao_no_caixa();

-- 4. View para conciliação: resumo diário por conta
-- CORRIGIDO: financeiro_contas_bancarias NÃO tem coluna "banco"
-- Tem banco_id FK → financeiro_bancos(id, nome)
DROP VIEW IF EXISTS vw_conciliacao_resumo_diario CASCADE;
CREATE VIEW vw_conciliacao_resumo_diario AS
SELECT
    ce.id,
    ce.conta_id,
    cb.nome AS conta_nome,
    COALESCE(fb.nome, 'Sem banco') AS conta_banco,
    ce.data_extrato,
    ce.depositos_confirmados,
    ce.pix_ted_recebidos,
    ce.debitos_pagamentos,
    ce.tarifas_bancarias,
    ce.saldo_extrato,
    ce.depositos_sistema,
    ce.pix_sistema,
    ce.pagamentos_sistema,
    ce.diferenca_depositos,
    ce.diferenca_pix,
    ce.diferenca_pagamentos,
    ce.status,
    ce.justificativa,
    ce.registrado_por,
    ce.created_at,
    ce.conciliado_at,
    CASE
        WHEN ABS(COALESCE(ce.diferenca_depositos, 0)) > 0.01
          OR ABS(COALESCE(ce.diferenca_pix, 0)) > 0.01
          OR ABS(COALESCE(ce.diferenca_pagamentos, 0)) > 0.01
        THEN true
        ELSE false
    END AS tem_divergencia,
    COALESCE(ce.depositos_confirmados, 0) + COALESCE(ce.pix_ted_recebidos, 0)
        + COALESCE(ce.outros_creditos, 0) AS total_entradas_extrato,
    COALESCE(ce.debitos_pagamentos, 0) + COALESCE(ce.tarifas_bancarias, 0)
        + COALESCE(ce.outros_debitos, 0) AS total_saidas_extrato
FROM conciliacao_extratos ce
JOIN financeiro_contas_bancarias cb ON cb.id = ce.conta_id
LEFT JOIN financeiro_bancos fb ON fb.id = cb.banco_id
ORDER BY ce.data_extrato DESC;

-- 5. View para o cofre: depósitos bancários com rastreio
-- CORRIGIDO: mesmo fix do JOIN com financeiro_bancos
DROP VIEW IF EXISTS vw_cofre_depositos_rastreio CASCADE;
CREATE VIEW vw_cofre_depositos_rastreio AS
SELECT
    cm.id AS cofre_mov_id,
    cm.valor,
    cm.data_movimentacao,
    cm.conta_bancaria_id,
    cb.nome AS conta_nome,
    COALESCE(fb.nome, 'Sem banco') AS conta_banco,
    cm.observacoes,
    cm.operador_id,
    p.nome AS operador_nome,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM conciliacao_extratos ce
            WHERE ce.conta_id = cm.conta_bancaria_id
              AND ce.data_extrato = cm.data_movimentacao::date
              AND ce.status IN ('conciliado', 'justificado')
        ) THEN 'conciliado'
        ELSE 'pendente'
    END AS status_conciliacao
FROM cofre_movimentacoes cm
LEFT JOIN financeiro_contas_bancarias cb ON cb.id = cm.conta_bancaria_id
LEFT JOIN financeiro_bancos fb ON fb.id = cb.banco_id
LEFT JOIN perfis p ON p.id = cm.operador_id
WHERE cm.tipo = 'saida_deposito'
  AND cm.deleted_at IS NULL
ORDER BY cm.data_movimentacao DESC;

-- 6. RPC: Recalcular valores do sistema para uma conciliação existente
CREATE OR REPLACE FUNCTION recalcular_conciliacao(p_conciliacao_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
    v_depositos_sistema NUMERIC(12,2);
    v_pix_sistema NUMERIC(12,2);
    v_pagamentos_sistema NUMERIC(12,2);
    v_status TEXT;
BEGIN
    SELECT * INTO v_rec FROM conciliacao_extratos WHERE id = p_conciliacao_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registro não encontrado');
    END IF;

    SELECT COALESCE(SUM(valor), 0) INTO v_depositos_sistema
    FROM cofre_movimentacoes
    WHERE tipo = 'saida_deposito'
      AND conta_bancaria_id = v_rec.conta_id
      AND data_movimentacao::date = v_rec.data_extrato
      AND deleted_at IS NULL;

    SELECT COALESCE(SUM(cm.valor), 0) INTO v_pix_sistema
    FROM caixa_movimentacoes cm
    JOIN caixa_sessoes cs ON cs.id = cm.sessao_id
    WHERE cm.tipo = 'pix' AND cm.valor > 0
      AND cm.deleted_at IS NULL
      AND cs.data_turno = v_rec.data_extrato;

    SELECT COALESCE(SUM(valor), 0) INTO v_pagamentos_sistema
    FROM financeiro_contas
    WHERE tipo = 'despesa' AND status = 'pago'
      AND data_pagamento = v_rec.data_extrato
      AND deleted_at IS NULL;

    v_status := CASE
        WHEN ABS(v_rec.depositos_confirmados - v_depositos_sistema) < 0.01
         AND ABS(v_rec.pix_ted_recebidos - v_pix_sistema) < 0.01
         AND ABS(v_rec.debitos_pagamentos - v_pagamentos_sistema) < 0.01
        THEN 'conciliado'
        ELSE 'divergente'
    END;

    UPDATE conciliacao_extratos SET
        depositos_sistema = v_depositos_sistema,
        pix_sistema = v_pix_sistema,
        pagamentos_sistema = v_pagamentos_sistema,
        diferenca_depositos = depositos_confirmados - v_depositos_sistema,
        diferenca_pix = pix_ted_recebidos - v_pix_sistema,
        diferenca_pagamentos = debitos_pagamentos - v_pagamentos_sistema,
        status = CASE WHEN status = 'justificado' THEN 'justificado' ELSE v_status END,
        updated_at = NOW()
    WHERE id = p_conciliacao_id;

    RETURN jsonb_build_object(
        'success', true,
        'depositos_sistema', v_depositos_sistema,
        'pix_sistema', v_pix_sistema,
        'pagamentos_sistema', v_pagamentos_sistema,
        'status', v_status
    );
END;
$$;

-- 7. RPC: Justificar divergência na conciliação
CREATE OR REPLACE FUNCTION justificar_conciliacao(
    p_conciliacao_id INTEGER,
    p_justificativa TEXT,
    p_usuario_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE conciliacao_extratos SET
        status = 'justificado',
        justificativa = p_justificativa,
        conciliado_por = p_usuario_id,
        conciliado_at = NOW(),
        updated_at = NOW()
    WHERE id = p_conciliacao_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registro não encontrado');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
