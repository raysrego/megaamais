ALTER TABLE caixa_sessoes
    -- Resumo calculado automaticamente no fechamento (por tipo de movimentação)
    ADD COLUMN IF NOT EXISTS resumo_entradas_pix NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_entradas_dinheiro NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_entradas_bolao_dinheiro NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_entradas_bolao_pix NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_saidas_sangria NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_saidas_deposito NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_saidas_boleto NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_saidas_trocados NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_total_entradas NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumo_total_saidas NUMERIC(12,2) DEFAULT 0,

    -- Valores declarados pelo operador no fechamento
    ADD COLUMN IF NOT EXISTS dinheiro_em_maos NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_enviado_cofre NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pix_externo_informado NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fundo_caixa_devolvido BOOLEAN DEFAULT true,

    -- Reconciliação calculada
    ADD COLUMN IF NOT EXISTS saldo_esperado_dinheiro NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS diferenca_caixa NUMERIC(12,2) DEFAULT 0,

    -- Auditoria do gerente (substitui status_validacao antigo)
    ADD COLUMN IF NOT EXISTS auditoria_status TEXT DEFAULT 'pendente',
    ADD COLUMN IF NOT EXISTS auditoria_por UUID,
    ADD COLUMN IF NOT EXISTS auditoria_data TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auditoria_observacoes TEXT,

    -- Vínculo com cofre (preenchido quando aprovado)
    ADD COLUMN IF NOT EXISTS cofre_movimentacao_id INTEGER,
    ADD COLUMN IF NOT EXISTS cofre_confirmado BOOLEAN DEFAULT false;

-- Constraint para auditoria_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'caixa_sessoes_auditoria_status_check'
    ) THEN
        ALTER TABLE caixa_sessoes
            ADD CONSTRAINT caixa_sessoes_auditoria_status_check
            CHECK (auditoria_status IN ('pendente', 'aprovado', 'rejeitado', 'correcao_solicitada'));
    END IF;
END $$;

-- 2. Garantir que cofre_movimentacoes tenha os campos de vínculo
ALTER TABLE cofre_movimentacoes
    ADD COLUMN IF NOT EXISTS origem_sessao_id INTEGER,
    ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID;

-- 3. Tipo 'venda_bolao' no caixa_movimentacoes (se houver constraint de tipo)
-- Verificamos se existe constraint e a atualizamos
DO $$
BEGIN
    -- Tenta dropar a constraint existente se houver
    BEGIN
        ALTER TABLE caixa_movimentacoes DROP CONSTRAINT IF EXISTS caixa_movimentacoes_tipo_check;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Recria com os novos tipos
    ALTER TABLE caixa_movimentacoes
        ADD CONSTRAINT caixa_movimentacoes_tipo_check
        CHECK (tipo IN (
            'venda', 'sangria', 'suprimento', 'pagamento', 'estorno',
            'pix', 'trocados', 'deposito', 'boleto',
            'venda_bolao', 'venda_bolao_pix'
        ));
EXCEPTION WHEN OTHERS THEN
    -- Se não havia constraint, não faz nada
    NULL;
END $$;

-- 4. RPC: Calcular resumo de uma sessão (chamada antes de fechar)
CREATE OR REPLACE FUNCTION calcular_resumo_sessao(p_sessao_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resultado JSONB;
    v_valor_inicial NUMERIC(12,2);
BEGIN
    -- Buscar valor inicial
    SELECT valor_inicial INTO v_valor_inicial
    FROM caixa_sessoes WHERE id = p_sessao_id;

    SELECT jsonb_build_object(
        'entradas_pix', COALESCE(SUM(CASE WHEN tipo = 'pix' AND valor > 0 THEN valor END), 0),
        'entradas_dinheiro', COALESCE(SUM(CASE WHEN tipo = 'venda' AND valor > 0 THEN valor END), 0),
        'entradas_bolao_dinheiro', COALESCE(SUM(CASE WHEN tipo = 'venda_bolao' AND valor > 0 THEN valor END), 0),
        'entradas_bolao_pix', COALESCE(SUM(CASE WHEN tipo = 'venda_bolao_pix' AND valor > 0 THEN valor END), 0),
        'saidas_sangria', COALESCE(SUM(CASE WHEN tipo = 'sangria' THEN ABS(valor) END), 0),
        'saidas_deposito', COALESCE(SUM(CASE WHEN tipo = 'deposito' THEN ABS(valor) END), 0),
        'saidas_boleto', COALESCE(SUM(CASE WHEN tipo IN ('boleto', 'pagamento') THEN ABS(valor) END), 0),
        'saidas_trocados', COALESCE(SUM(CASE WHEN tipo = 'trocados' THEN ABS(valor) END), 0),
        'total_entradas', COALESCE(SUM(CASE WHEN valor > 0 THEN valor END), 0),
        'total_saidas', COALESCE(SUM(CASE WHEN valor < 0 THEN ABS(valor) END), 0),
        'saldo_esperado_dinheiro',
            v_valor_inicial
            + COALESCE(SUM(CASE WHEN tipo IN ('venda', 'venda_bolao', 'suprimento') AND valor > 0 THEN valor END), 0)
            - COALESCE(SUM(CASE WHEN tipo IN ('sangria', 'deposito', 'boleto', 'pagamento') AND valor < 0 THEN ABS(valor) END), 0)
    ) INTO v_resultado
    FROM caixa_movimentacoes
    WHERE sessao_id = p_sessao_id
      AND deleted_at IS NULL;

    RETURN v_resultado;
END;
$$;

-- 5. RPC: Aprovar fechamento e criar entrada no cofre
CREATE OR REPLACE FUNCTION aprovar_fechamento_caixa(
    p_sessao_id INTEGER,
    p_gerente_id UUID,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sessao RECORD;
    v_cofre_id INTEGER;
BEGIN
    -- Buscar sessão
    SELECT * INTO v_sessao
    FROM caixa_sessoes
    WHERE id = p_sessao_id AND status = 'fechado';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão não encontrada ou não está fechada');
    END IF;

    IF v_sessao.auditoria_status = 'aprovado' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão já foi aprovada');
    END IF;

    -- Criar entrada no cofre vinculada à sessão (se valor_enviado_cofre > 0)
    IF COALESCE(v_sessao.valor_enviado_cofre, 0) > 0 THEN
        INSERT INTO cofre_movimentacoes (
            tipo, valor, operador_id, origem_sessao_id, observacoes
        ) VALUES (
            'entrada_fechamento',
            v_sessao.valor_enviado_cofre,
            p_gerente_id,
            p_sessao_id,
            FORMAT('Fechamento %s turno %s - Operador %s',
                   v_sessao.terminal_id, v_sessao.data_turno, v_sessao.operador_id)
        )
        RETURNING id INTO v_cofre_id;
    END IF;

    -- Atualizar sessão como aprovada
    UPDATE caixa_sessoes SET
        auditoria_status = 'aprovado',
        auditoria_por = p_gerente_id,
        auditoria_data = NOW(),
        auditoria_observacoes = p_observacoes,
        cofre_movimentacao_id = v_cofre_id,
        cofre_confirmado = true
    WHERE id = p_sessao_id;

    RETURN jsonb_build_object(
        'success', true,
        'cofre_movimentacao_id', v_cofre_id,
        'valor_cofre', v_sessao.valor_enviado_cofre
    );
END;
$$;

-- 6. RPC: Rejeitar fechamento
CREATE OR REPLACE FUNCTION rejeitar_fechamento_caixa(
    p_sessao_id INTEGER,
    p_gerente_id UUID,
    p_observacoes TEXT,
    p_solicitar_correcao BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE caixa_sessoes SET
        auditoria_status = CASE WHEN p_solicitar_correcao THEN 'correcao_solicitada' ELSE 'rejeitado' END,
        auditoria_por = p_gerente_id,
        auditoria_data = NOW(),
        auditoria_observacoes = p_observacoes
    WHERE id = p_sessao_id AND status = 'fechado';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão não encontrada');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
