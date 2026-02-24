-- ==============================================================================
-- MIGRATION: ADD ENDERECO TO EMPRESAS
-- Data: 2026-02-13
-- Objetivo: Adicionar colunas de endereço que faltam na tabela 'empresas'
--           para permitir salvar Cidade, UF e Endereço corretamente.
-- ==============================================================================

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS endereco_cidade text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS endereco_uf text;

-- Atualizar permissão de RLS para garantir que ninguém seja bloqueado
-- (Reforço das regras já criadas)
GRANT ALL ON public.empresas TO authenticated;
