-- ==========================================
-- MEGA B - FIX SCHEMA CACHE FINANCEIRO
-- Data: 2026-02-02
-- Objetivo: Forçar atualização do PostgREST após renomeação de tabelas
-- ==========================================

-- 1. Garantir que as colunas existam na nova tabela 'financeiro_itens'
-- (Caso a migração anterior tenha falhado ou o cache esteja preso)
ALTER TABLE IF EXISTS public.financeiro_itens 
ADD COLUMN IF NOT EXISTS valor_padrao NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31);

-- 2. Tocar na tabela para forçar atualização do cache do Supabase
COMMENT ON TABLE public.financeiro_itens IS 'Itens financeiros (ex-categorias) com suporte a automação de vencimento.';

-- 3. Forçar reload do schema (se o usuário tiver permissão via RPC ou apenas pela alteração do DDL)
-- O Supabase recarrega automaticamente ao detectar alterações de DDL (como o COMMENT acima)
