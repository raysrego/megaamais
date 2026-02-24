-- ===================================================================
-- DIAGNÓSTICO: Listar Lojas Disponíveis
-- Objetivo: Identificar o nome correto ou ID da filial para ajustar o script de importação.
-- ===================================================================

SELECT id, nome_fantasia, razao_social, cnpj, ativo 
FROM public.lojas;
