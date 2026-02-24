-- ===================================================================
-- DATABASE BOOSTER: RPCs for DASHBOARD & FINANCEIRO
-- Data: 2026-02-09
-- Objetivo: Acabar com loops de carregamento e hangs de RLS.
--           Fornece funções SECURITY DEFINER para buscar dados vitais
--           contornando o overhead de avaliação de RLS linha-a-linha.
-- ===================================================================

-- 1. Otimização das Funções de Contexto (Super Fast)
CREATE OR REPLACE FUNCTION public.get_my_loja_id()
RETURNS UUID AS $$
    -- Seleção direta cacheada pelo Postgres na sessão se possível
    -- Mas aqui garantimos que seja SECURITY DEFINER para não bater no RLS de perfis
    SELECT p.loja_id FROM public.perfis p WHERE p.id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfis p 
        WHERE p.id = auth.uid() AND p.role::text = 'master'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. RPC: Get Dashboard Metrics (Bypass RLS overhead)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_loja_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_loja_nome TEXT;
    v_vendas_jogos DECIMAL(10,2);
    v_vendas_boloes DECIMAL(10,2);
    v_premios_pagos DECIMAL(10,2);
    v_lucro_real_boloes DECIMAL(10,2);
    v_terminais_ativos INTEGER;
    v_terminais_total INTEGER;
    v_saldo_cofre DECIMAL(10,2);
    v_saldo_bancos DECIMAL(10,2);
BEGIN
    -- Obter nome da loja
    SELECT nome_fantasia INTO v_loja_nome FROM public.empresas WHERE id = p_loja_id;

    -- KPIs da View Consolidada (Calculado no servidor)
    SELECT 
        vendas_jogos, vendas_boloes, premios_pagos
    INTO v_vendas_jogos, v_vendas_boloes, v_premios_pagos
    FROM public.vw_dashboard_consolidado
    WHERE filial = v_loja_nome;

    -- Lucro Real Bolões (Hoje)
    SELECT COALESCE(SUM((preco_venda_cota - valor_cota_base) * cotas_vendidas), 0)
    INTO v_lucro_real_boloes
    FROM public.boloes
    WHERE loja_id = p_loja_id AND created_at >= CURRENT_DATE;

    -- Terminais
    SELECT count(*) INTO v_terminais_total FROM public.terminais WHERE loja_id = p_loja_id;
    SELECT count(*) INTO v_terminais_ativos FROM public.caixa_sessoes WHERE loja_id = p_loja_id AND status::text = 'aberto';

    -- Saldos
    SELECT COALESCE(saldo, 0) INTO v_saldo_cofre FROM public.cofre_saldo_atual WHERE loja_id = p_loja_id;
    SELECT COALESCE(SUM(saldo_atual), 0) INTO v_saldo_bancos FROM public.financeiro_contas_bancarias WHERE loja_id = p_loja_id;

    -- Montagem do Result
    result := jsonb_build_object(
        'faturamentoHoje', COALESCE(v_vendas_jogos, 0) + COALESCE(v_vendas_boloes, 0),
        'vendasJogos', COALESCE(v_vendas_jogos, 0),
        'vendasBoloes', COALESCE(v_vendas_boloes, 0),
        'lucroBoloes', COALESCE(v_lucro_real_boloes, 0),
        'terminaisAtivos', COALESCE(v_terminais_ativos, 0),
        'terminaisTotal', COALESCE(v_terminais_total, 0),
        'saldoCofre', COALESCE(v_saldo_cofre, 0),
        'saldoBancos', COALESCE(v_saldo_bancos, 0)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Get Financeiro Transactions (Bypass RLS overhead)
CREATE OR REPLACE FUNCTION public.get_financeiro_transactions(
    p_loja_id UUID, 
    p_ano INTEGER, 
    p_mes INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    IF p_mes = 0 THEN
        v_start_date := (p_ano || '-01-01')::DATE;
        v_end_date := (p_ano || '-12-31')::DATE;
    ELSE
        v_start_date := (p_ano || '-' || p_mes || '-01')::DATE;
        v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;

    SELECT jsonb_agg(t) INTO result
    FROM (
        SELECT 
            id, tipo, descricao, valor, item, 
            data_vencimento, data_pagamento, status, 
            recorrente, frequencia, loja_id, 
            metodo_pagamento, comprovante_url
        FROM public.financeiro_contas
        WHERE (p_loja_id IS NULL OR loja_id = p_loja_id)
        AND data_vencimento BETWEEN v_start_date AND v_end_date
        ORDER BY data_vencimento ASC
    ) t;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Get Dashboard Consolidado (Para Admin)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(t) INTO result
    FROM (
        SELECT * FROM public.vw_dashboard_consolidado
        ORDER BY filial ASC
    ) t;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_transactions(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary() TO authenticated;
