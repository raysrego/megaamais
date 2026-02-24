-- DIAGRÓSTICO DE ESTRUTURA (Lojas vs Empresas)
-- Rode este script para listar o que existe no banco

-- 1. Listar TODAS as Lojas cadastradas
SELECT 'Tabela LOJAS' as origem, id, nome_fantasia, razao_social, cidade, ativo 
FROM public.lojas;

-- 2. Listar TODAS as Empresas (se existir a tabela)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'empresas') THEN
        execute 'SELECT ''Tabela EMPRESAS'' as origem, id, nome_fantasia FROM public.empresas';
    ELSE
        RAISE NOTICE 'ALERTA: Tabela EMPRESAS não existe neste banco.';
    END IF;
END $$;

-- 3. Verificando se existe algo parecido com Aririzal em QUALQUER lugar
SELECT 'Busca Aririzal (Lojas)' as busca, id, nome_fantasia 
FROM public.lojas 
WHERE nome_fantasia ILIKE '%Aririzal%';
