-- ===================================================================
-- DIAGNÓSTICO: VISIBILIDADE DOS ITENS (ARQUIVADO vs ATIVO)
-- ===================================================================

SELECT 
    id, 
    item, 
    tipo_recorrencia, 
    ativo, 
    arquivado -- AQUI PODE ESTAR O PROBLEMA (Se for NULL, o front não carrega)
FROM public.financeiro_itens_plano 
WHERE item IN ('Vale Transporte', 'Internet', 'Simples Nacional', 'OLHO VIVO', 'CEFOR');
