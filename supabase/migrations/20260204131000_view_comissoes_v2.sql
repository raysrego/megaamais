-- ===================================================================
-- SPRINT 5: INTELIGÊNCIA DE COMISSÕES (VIEW) - v2 REVISADA
-- Data: 2026-02-04
-- Objetivo: Criar View Analítica com cálculo PRECISO de comissões (JOIN boloes).
--           Regra 70/30 aplicada sobre o lucro real.
-- ===================================================================

DROP VIEW IF EXISTS public.vw_performance_operadores CASCADE;

CREATE VIEW public.vw_performance_operadores AS
WITH vendas_detalhadas AS (
    -- 1. Calcular lucro linha a linha (Venda a Venda)
    SELECT
        v.usuario_id,
        v.loja_id,
        v.valor_total as valor_venda_bruto,
        -- Lucro Real = (Preço Venda - Valor Base) * Qtd Cotas Vendidas
        -- Como vendas_boloes pode não ter qtd_cotas explícito antiga, derivamos do valor
        -- Ou melhor, vamos assumir que vendas_boloes tem quantidade_cotas (padrão)
        -- Se não tiver, usamos (v.valor_total / b.preco_venda_cota) para achar qtd
        (b.preco_venda_cota - b.valor_cota_base) * (v.valor_total / b.preco_venda_cota) as lucro_real_venda
    FROM vendas_boloes v
    JOIN boloes b ON b.id = v.bolao_id
    WHERE DATE_TRUNC('month', v.created_at) = DATE_TRUNC('month', CURRENT_DATE)
),
vendas_resumo AS (
    -- 2. Agregar por Operador
    SELECT 
        vd.usuario_id as operador_id,
        p.nome as operador_nome,
        vd.loja_id,
        l.nome_fantasia as filial_nome,
        COUNT(*) as qtd_vendas,
        SUM(vd.valor_venda_bruto) as total_vendas_bruto,
        SUM(vd.lucro_real_venda) as comissao_total_gerada -- SOMA DO LUCRO REAL
    FROM vendas_detalhadas vd
    JOIN perfis p ON p.id = vd.usuario_id
    JOIN lojas l ON l.id = vd.loja_id
    GROUP BY vd.usuario_id, p.nome, vd.loja_id, l.nome_fantasia
)
SELECT 
    operador_id,
    operador_nome,
    loja_id,
    filial_nome,
    qtd_vendas,
    total_vendas_bruto,
    
    -- Cálculos da Regra 70/30 (Sobre o REAL)
    comissao_total_gerada,
    (comissao_total_gerada * 0.70) as parte_casa_70,
    (comissao_total_gerada * 0.30) as parte_pool_30,

    -- Lógica de Metas (Tier) mantida
    CASE 
        WHEN total_vendas_bruto >= 30000 THEN 4
        WHEN total_vendas_bruto >= 25000 THEN 3
        WHEN total_vendas_bruto >= 20000 THEN 2
        WHEN total_vendas_bruto >= 10000 THEN 1
        ELSE 0 
    END as tier_atingido,

    -- Valor do Prêmio (Fixo)
    CASE 
        WHEN total_vendas_bruto >= 30000 THEN 1000.00
        WHEN total_vendas_bruto >= 25000 THEN 800.00
        WHEN total_vendas_bruto >= 20000 THEN 700.00
        WHEN total_vendas_bruto >= 10000 THEN 600.00
        ELSE 0.00
    END as premio_a_receber,

    -- Próxima Meta
    CASE 
        WHEN total_vendas_bruto >= 30000 THEN NULL
        WHEN total_vendas_bruto >= 25000 THEN 30000
        WHEN total_vendas_bruto >= 20000 THEN 25000
        WHEN total_vendas_bruto >= 10000 THEN 20000
        ELSE 10000 
    END as proxima_meta_valor,

    -- Quanto falta
    CASE 
        WHEN total_vendas_bruto >= 30000 THEN 0
        WHEN total_vendas_bruto >= 25000 THEN 30000 - total_vendas_bruto
        WHEN total_vendas_bruto >= 20000 THEN 25000 - total_vendas_bruto
        WHEN total_vendas_bruto >= 10000 THEN 20000 - total_vendas_bruto
        ELSE 10000 - total_vendas_bruto
    END as falta_para_proxima_meta

FROM vendas_resumo;

-- Permissions
GRANT SELECT ON public.vw_performance_operadores TO authenticated;
