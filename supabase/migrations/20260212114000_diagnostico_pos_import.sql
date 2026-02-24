-- ===================================================================
-- DIAGNÓSTICO SIMPLIFICADO (APENAS SELECTS)
-- ===================================================================

-- 1. VERIFICAR GRUPO B (Luz, Água, Folha, etc)
-- Se aparecerem aqui, estão no banco.
SELECT id, item, data_vencimento, valor, status, loja_id 
FROM public.financeiro_contas 
WHERE item IN ('IOCS', 'Luz', 'GPS', 'FGTS', 'ISSQN', 'TFL', 'Folha de Pag.')
  AND data_vencimento >= '2026-01-01'
ORDER BY item, data_vencimento;

-- 2. VERIFICAR "FANTASMAS" (FIXEL, TOKIO)
-- Verificando a categoria origiral deles
SELECT id, item, tipo_recorrencia, fixo, ativo 
FROM public.financeiro_itens_plano 
WHERE item ILIKE '%FIXEL%' OR item ILIKE '%TOKIO%';

-- Verificando quantos lançamentos futuros existem deles
SELECT item, count(*) as total_lancamentos_2026 
FROM public.financeiro_contas 
WHERE (item ILIKE '%FIXEL%' OR item ILIKE '%TOKIO%')
  AND data_vencimento >= '2026-01-01'
GROUP BY item;
