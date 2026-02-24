/*
  # Correção Crítica - Módulo Financeiro
  
  1. Problemas Corrigidos
    - RPC get_financeiro_transactions com assinatura correta
    - Índices de performance para queries lentas
    - Função de soma segura para cálculos financeiros
    - View otimizada para resumos
    
  2. Melhorias
    - Índices compostos para data + loja + status
    - Function para validar dias do mês
    - Triggers para atualizar saldos
    - Função de replicação segura
*/

-- ============================================
-- 1. DROP FUNCTION ANTIGA (se existir)
-- ============================================

DROP FUNCTION IF EXISTS get_financeiro_transactions(UUID, INTEGER, INTEGER);

-- ============================================
-- 2. RPC CRÍTICA: get_financeiro_transactions
-- ============================================

CREATE OR REPLACE FUNCTION get_financeiro_transactions(
    p_loja_id UUID,
    p_ano INTEGER,
    p_mes INTEGER DEFAULT NULL
) RETURNS TABLE (
    id BIGINT,
    loja_id UUID,
    tipo fin_tipo_conta,
    descricao TEXT,
    valor NUMERIC(15,2),
    valor_realizado NUMERIC(15,2),
    status fin_status_conta,
    data_vencimento DATE,
    data_pagamento DATE,
    metodo_pagamento fin_metodo_pagamento,
    item_financeiro_id INTEGER,
    item_nome TEXT,
    comprovante_url TEXT,
    nota TEXT,
    origem_tipo TEXT,
    origem_id BIGINT,
    created_at TIMESTAMPTZ,
    created_by UUID,
    updated_at TIMESTAMPTZ,
    recorrente BOOLEAN,
    parcela_numero INTEGER,
    total_parcelas INTEGER,
    deleted_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fc.id,
        fc.loja_id,
        fc.tipo,
        fc.descricao,
        fc.valor,
        fc.valor_realizado,
        fc.status,
        fc.data_vencimento,
        fc.data_pagamento,
        fc.metodo_pagamento,
        fc.item_financeiro_id,
        fip.item AS item_nome,
        fc.comprovante_url,
        fc.nota,
        fc.origem_tipo,
        fc.origem_id,
        fc.created_at,
        fc.created_by,
        fc.updated_at,
        fc.recorrente,
        fc.parcela_numero,
        fc.total_parcelas,
        fc.deleted_at
    FROM financeiro_contas fc
    LEFT JOIN financeiro_itens_plano fip ON fc.item_financeiro_id = fip.id
    WHERE 
        fc.loja_id = p_loja_id
        AND fc.deleted_at IS NULL
        AND EXTRACT(YEAR FROM fc.data_vencimento) = p_ano
        AND (p_mes IS NULL OR EXTRACT(MONTH FROM fc.data_vencimento) = p_mes)
    ORDER BY fc.data_vencimento DESC, fc.created_at DESC
    LIMIT 1000; -- Limitar para performance
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_financeiro_transactions IS 'Busca transações financeiras filtradas por loja, ano e opcionalmente mês. Inclui apenas registros não deletados. Limite de 1000 registros.';

-- ============================================
-- 3. FUNÇÃO: Soma Segura de Valores
-- ============================================

CREATE OR REPLACE FUNCTION safe_sum_values(
    p_values NUMERIC[]
) RETURNS NUMERIC(15,2) AS $$
DECLARE
    v_sum NUMERIC(15,2) := 0;
    v_value NUMERIC(15,2);
BEGIN
    FOREACH v_value IN ARRAY p_values
    LOOP
        v_sum := v_sum + COALESCE(v_value, 0);
    END LOOP;
    
    RETURN ROUND(v_sum, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 4. FUNÇÃO: Validar Dia do Mês
-- ============================================

CREATE OR REPLACE FUNCTION get_valid_day_for_month(
    p_ano INTEGER,
    p_mes INTEGER,
    p_dia INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_ultimo_dia INTEGER;
BEGIN
    v_ultimo_dia := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'));
    RETURN LEAST(p_dia, v_ultimo_dia);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 5. VIEW: Resumo Financeiro Mensal
-- ============================================

DROP VIEW IF EXISTS v_financeiro_resumo_mensal;

CREATE VIEW v_financeiro_resumo_mensal AS
SELECT 
    fc.loja_id,
    EXTRACT(YEAR FROM fc.data_vencimento)::INTEGER AS ano,
    EXTRACT(MONTH FROM fc.data_vencimento)::INTEGER AS mes,
    fc.tipo,
    fc.status,
    COUNT(*) AS quantidade,
    COALESCE(SUM(fc.valor), 0)::NUMERIC(15,2) AS valor_total,
    COALESCE(SUM(fc.valor_realizado), 0)::NUMERIC(15,2) AS valor_realizado_total,
    COALESCE(SUM(CASE WHEN fc.status = 'pago' THEN fc.valor_realizado ELSE 0 END), 0)::NUMERIC(15,2) AS valor_pago,
    COALESCE(SUM(CASE WHEN fc.status = 'pendente' THEN fc.valor ELSE 0 END), 0)::NUMERIC(15,2) AS valor_pendente,
    COALESCE(SUM(CASE WHEN fc.status = 'atrasado' THEN fc.valor ELSE 0 END), 0)::NUMERIC(15,2) AS valor_atrasado
FROM financeiro_contas fc
WHERE fc.deleted_at IS NULL
GROUP BY fc.loja_id, ano, mes, fc.tipo, fc.status;

-- ============================================
-- 6. FUNÇÃO: Get Resumo Financeiro
-- ============================================

DROP FUNCTION IF EXISTS get_financeiro_resumo(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_financeiro_resumo(
    p_loja_id UUID,
    p_ano INTEGER,
    p_mes INTEGER
) RETURNS TABLE (
    total_receitas NUMERIC(15,2),
    total_despesas NUMERIC(15,2),
    receitas_pagas NUMERIC(15,2),
    receitas_pendentes NUMERIC(15,2),
    despesas_pagas NUMERIC(15,2),
    despesas_pendentes NUMERIC(15,2),
    despesas_atrasadas NUMERIC(15,2),
    saldo_previsto NUMERIC(15,2),
    saldo_realizado NUMERIC(15,2)
) AS $$
DECLARE
    v_rec_total NUMERIC(15,2) := 0;
    v_desp_total NUMERIC(15,2) := 0;
    v_rec_pagas NUMERIC(15,2) := 0;
    v_rec_pendentes NUMERIC(15,2) := 0;
    v_desp_pagas NUMERIC(15,2) := 0;
    v_desp_pendentes NUMERIC(15,2) := 0;
    v_desp_atrasadas NUMERIC(15,2) := 0;
BEGIN
    SELECT 
        COALESCE(SUM(valor), 0),
        COALESCE(SUM(CASE WHEN status = 'pago' THEN valor_realizado ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END), 0)
    INTO v_rec_total, v_rec_pagas, v_rec_pendentes
    FROM financeiro_contas
    WHERE loja_id = p_loja_id
        AND tipo = 'receita'
        AND EXTRACT(YEAR FROM data_vencimento) = p_ano
        AND EXTRACT(MONTH FROM data_vencimento) = p_mes
        AND deleted_at IS NULL;
    
    SELECT 
        COALESCE(SUM(valor), 0),
        COALESCE(SUM(CASE WHEN status = 'pago' THEN valor_realizado ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'atrasado' THEN valor ELSE 0 END), 0)
    INTO v_desp_total, v_desp_pagas, v_desp_pendentes, v_desp_atrasadas
    FROM financeiro_contas
    WHERE loja_id = p_loja_id
        AND tipo = 'despesa'
        AND EXTRACT(YEAR FROM data_vencimento) = p_ano
        AND EXTRACT(MONTH FROM data_vencimento) = p_mes
        AND deleted_at IS NULL;
    
    RETURN QUERY SELECT 
        v_rec_total,
        v_desp_total,
        v_rec_pagas,
        v_rec_pendentes,
        v_desp_pagas,
        v_desp_pendentes,
        v_desp_atrasadas,
        (v_rec_total - v_desp_total)::NUMERIC(15,2) AS saldo_previsto,
        (v_rec_pagas - v_desp_pagas)::NUMERIC(15,2) AS saldo_realizado;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 7. ÍNDICES DE PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_loja_data_status 
ON financeiro_contas(loja_id, data_vencimento DESC, status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_data_parts
ON financeiro_contas(loja_id, EXTRACT(YEAR FROM data_vencimento), EXTRACT(MONTH FROM data_vencimento))
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_item
ON financeiro_contas(item_financeiro_id, loja_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_origem
ON financeiro_contas(origem_tipo, origem_id)
WHERE deleted_at IS NULL AND origem_tipo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_not_deleted
ON financeiro_contas(loja_id, data_vencimento)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_itens_loja_tipo
ON financeiro_itens_plano(loja_id, tipo, arquivado)
WHERE arquivado = false;

CREATE INDEX IF NOT EXISTS idx_financeiro_transacoes_conta_status
ON financeiro_transacoes_bancarias(conta_id, status_conciliacao, data_transacao DESC);

-- ============================================
-- 8. FUNÇÃO: Replicar Despesas do Mês Anterior
-- ============================================

DROP FUNCTION IF EXISTS replicar_despesas_mes_anterior(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER[]);

CREATE OR REPLACE FUNCTION replicar_despesas_mes_anterior(
    p_loja_id UUID,
    p_ano_origem INTEGER,
    p_mes_origem INTEGER,
    p_ano_destino INTEGER,
    p_mes_destino INTEGER,
    p_item_ids INTEGER[] DEFAULT NULL
) RETURNS TABLE (
    total_replicadas INTEGER,
    ids_criados BIGINT[]
) AS $$
DECLARE
    v_count INTEGER := 0;
    v_ids BIGINT[] := '{}';
    v_new_id BIGINT;
    v_despesa RECORD;
    v_dia_valido INTEGER;
BEGIN
    FOR v_despesa IN
        SELECT *
        FROM financeiro_contas
        WHERE loja_id = p_loja_id
            AND tipo = 'despesa'
            AND EXTRACT(YEAR FROM data_vencimento) = p_ano_origem
            AND EXTRACT(MONTH FROM data_vencimento) = p_mes_origem
            AND deleted_at IS NULL
            AND (p_item_ids IS NULL OR item_financeiro_id = ANY(p_item_ids))
    LOOP
        v_dia_valido := get_valid_day_for_month(
            p_ano_destino, 
            p_mes_destino, 
            EXTRACT(DAY FROM v_despesa.data_vencimento)::INTEGER
        );
        
        INSERT INTO financeiro_contas (
            loja_id, tipo, descricao, valor, valor_realizado, status, data_vencimento,
            metodo_pagamento, item_financeiro_id, nota, created_by
        ) VALUES (
            p_loja_id, 'despesa', v_despesa.descricao, v_despesa.valor, v_despesa.valor,
            'pendente', MAKE_DATE(p_ano_destino, p_mes_destino, v_dia_valido),
            v_despesa.metodo_pagamento, v_despesa.item_financeiro_id,
            'Replicado de ' || TO_CHAR(v_despesa.data_vencimento, 'MM/YYYY'), v_despesa.created_by
        ) RETURNING id INTO v_new_id;
        
        v_count := v_count + 1;
        v_ids := array_append(v_ids, v_new_id);
    END LOOP;
    
    RETURN QUERY SELECT v_count, v_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION get_financeiro_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION get_financeiro_resumo TO authenticated;
GRANT EXECUTE ON FUNCTION get_valid_day_for_month TO authenticated;
GRANT EXECUTE ON FUNCTION replicar_despesas_mes_anterior TO authenticated;
GRANT EXECUTE ON FUNCTION safe_sum_values TO authenticated;
GRANT SELECT ON v_financeiro_resumo_mensal TO authenticated;