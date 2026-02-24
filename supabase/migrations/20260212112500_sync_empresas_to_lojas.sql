-- ===================================================================
-- MIGRATION: 20260212112500_sync_empresas_to_lojas.sql
-- Objetivo: Sincronizar dados da tabela antiga 'empresas' para a nova 'lojas'
-- Motivo: O módulo financeiro usa 'lojas', mas os dados estão em 'empresas'.
-- ===================================================================

-- 1. Copiar dados de empresas para lojas (Preservando IDs)
INSERT INTO public.lojas (id, nome_fantasia, razao_social, cnpj, cidade, uf, ativo, created_at)
SELECT 
    id, 
    nome_fantasia, 
    nome as razao_social, -- Adaptando colunas
    cnpj, 
    endereco_cidade, 
    endereco_uf, 
    ativo::boolean, 
    created_at
FROM public.empresas
ON CONFLICT (id) DO UPDATE SET
    nome_fantasia = EXCLUDED.nome_fantasia,
    ativo = EXCLUDED.ativo;

-- 2. Confirmação
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.lojas;
    RAISE NOTICE 'Sincronização concluída. Total de lojas na tabela nova: %', v_count;
END $$;
