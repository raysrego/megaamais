DO $$
BEGIN
    ALTER TABLE cofre_movimentacoes
        ALTER COLUMN data_movimentacao SET DEFAULT timezone('utc'::text, now());
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'data_movimentacao default já existe ou coluna não encontrada: %', SQLERRM;
END $$;

-- 2. View do saldo do cofre (incluindo entrada_fechamento)
-- DROP primeiro para evitar erro se a view existente tem colunas diferentes
DROP VIEW IF EXISTS cofre_saldo_atual CASCADE;
CREATE VIEW cofre_saldo_atual AS
SELECT
    COALESCE(
        SUM(CASE
            WHEN tipo IN ('entrada_sangria', 'entrada_fechamento', 'ajuste_entrada') THEN valor
            WHEN tipo IN ('saida_deposito', 'ajuste_saida') THEN -valor
            ELSE 0
        END),
    0) AS saldo
FROM cofre_movimentacoes
WHERE deleted_at IS NULL;

-- 3. View de sangrias pendentes
-- Mostra sangrias manuais (durante turno) que ainda não foram recebidas no cofre
DROP VIEW IF EXISTS cofre_sangrias_pendentes CASCADE;
CREATE VIEW cofre_sangrias_pendentes AS
SELECT
    cm.id AS sangria_id,
    ABS(cm.valor) AS valor,
    cm.created_at AS data_hora,
    cs.terminal_id,
    cs.operador_id,
    cm.descricao AS observacao_caixa
FROM caixa_movimentacoes cm
JOIN caixa_sessoes cs ON cs.id = cm.sessao_id
WHERE cm.tipo = 'sangria'
  AND cm.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM cofre_movimentacoes cof
    WHERE cof.origem_sangria_id = cm.id
      AND cof.deleted_at IS NULL
  )
  -- Exclui sangrias de fechamento (gerenciadas pela aprovação)
  AND (cm.descricao IS NULL OR cm.descricao NOT LIKE 'Sangria para cofre%')
ORDER BY cm.created_at DESC;

-- 4. View de entradas do cofre por fechamento aprovado
DROP VIEW IF EXISTS cofre_entradas_por_fechamento CASCADE;
CREATE VIEW cofre_entradas_por_fechamento AS
SELECT
    cs.id AS sessao_id,
    cs.terminal_id,
    cs.operador_id,
    cs.data_turno,
    cs.valor_enviado_cofre,
    cs.auditoria_status,
    cs.cofre_confirmado,
    p.nome AS operador_nome,
    cm.id AS cofre_movimentacao_id,
    cm.created_at AS data_entrada_cofre
FROM caixa_sessoes cs
LEFT JOIN perfis p ON p.id = cs.operador_id
LEFT JOIN cofre_movimentacoes cm ON cm.origem_sessao_id = cs.id
    AND cm.deleted_at IS NULL
WHERE cs.status = 'fechado'
  AND COALESCE(cs.valor_enviado_cofre, 0) > 0
ORDER BY cs.data_turno DESC, cs.data_fechamento DESC;

-- 5. View para auditoria unificada
-- Usa cs.loja_id diretamente (não precisa JOIN com terminais para pegar loja)
DROP VIEW IF EXISTS vw_auditoria_fechamentos CASCADE;
CREATE VIEW vw_auditoria_fechamentos AS
SELECT
    cs.id,
    'tfl' AS tipo,
    cs.terminal_id,
    cs.operador_id,
    p.nome AS operador_nome,
    cs.data_turno,
    cs.data_abertura,
    cs.data_fechamento,
    cs.valor_inicial,
    cs.valor_final_calculado,

    -- Resumo por tipo
    COALESCE(cs.resumo_entradas_pix, 0) AS resumo_entradas_pix,
    COALESCE(cs.resumo_entradas_dinheiro, 0) AS resumo_entradas_dinheiro,
    COALESCE(cs.resumo_entradas_bolao_dinheiro, 0) AS resumo_entradas_bolao_dinheiro,
    COALESCE(cs.resumo_entradas_bolao_pix, 0) AS resumo_entradas_bolao_pix,
    COALESCE(cs.resumo_saidas_sangria, 0) AS resumo_saidas_sangria,
    COALESCE(cs.resumo_saidas_deposito, 0) AS resumo_saidas_deposito,
    COALESCE(cs.resumo_saidas_boleto, 0) AS resumo_saidas_boleto,
    COALESCE(cs.resumo_saidas_trocados, 0) AS resumo_saidas_trocados,
    COALESCE(cs.resumo_total_entradas, 0) AS resumo_total_entradas,
    COALESCE(cs.resumo_total_saidas, 0) AS resumo_total_saidas,

    -- Declaração do operador
    COALESCE(cs.dinheiro_em_maos, 0) AS dinheiro_em_maos,
    COALESCE(cs.valor_enviado_cofre, 0) AS valor_enviado_cofre,
    COALESCE(cs.pix_externo_informado, 0) AS pix_externo_informado,
    COALESCE(cs.fundo_caixa_devolvido, true) AS fundo_caixa_devolvido,
    cs.tem_fundo_caixa,

    -- Reconciliação
    COALESCE(cs.saldo_esperado_dinheiro, 0) AS saldo_esperado_dinheiro,
    COALESCE(cs.diferenca_caixa, 0) AS diferenca_caixa,

    -- Auditoria
    COALESCE(cs.auditoria_status, 'pendente') AS auditoria_status,
    cs.auditoria_por,
    cs.auditoria_data,
    cs.auditoria_observacoes,
    cs.observacoes AS observacoes_operador,

    -- Cofre
    COALESCE(cs.cofre_confirmado, false) AS cofre_confirmado,
    cs.cofre_movimentacao_id,

    -- Loja (direto da sessão, sem JOIN extra)
    cs.loja_id

FROM caixa_sessoes cs
LEFT JOIN perfis p ON p.id = cs.operador_id
WHERE cs.status = 'fechado'
ORDER BY cs.data_turno DESC, cs.data_fechamento DESC;

-- 6. Índices de performance
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_auditoria
    ON caixa_sessoes(auditoria_status, data_turno DESC)
    WHERE status = 'fechado';

CREATE INDEX IF NOT EXISTS idx_cofre_mov_origem_sessao
    ON cofre_movimentacoes(origem_sessao_id)
    WHERE origem_sessao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cofre_mov_conta_bancaria
    ON cofre_movimentacoes(conta_bancaria_id, data_movimentacao)
    WHERE conta_bancaria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caixa_mov_tipo_sessao
    ON caixa_movimentacoes(sessao_id, tipo)
    WHERE deleted_at IS NULL;
