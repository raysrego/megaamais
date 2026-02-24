-- ===================================================================
-- Filtros Inteligentes: Buscar Anos com Movimentação
-- Data: 2026-02-04
-- Objetivo: Determinar dinamicamente quais anos possuem dados para o filtro
-- ===================================================================

CREATE OR REPLACE FUNCTION public.get_anos_financeiros_disponiveis(p_loja_id UUID DEFAULT NULL)
RETURNS TABLE(ano INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT EXTRACT(YEAR FROM data_vencimento)::INTEGER as ano_val
    FROM financeiro_contas
    WHERE (p_loja_id IS NULL OR loja_id = p_loja_id)
      AND data_vencimento IS NOT NULL
    ORDER BY ano_val DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_anos_financeiros_disponiveis IS 
'Retorna os anos distintos que possuem lançamentos financeiros, opcionalmente filtrados por loja.';
