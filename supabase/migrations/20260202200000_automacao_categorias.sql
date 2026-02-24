-- ==========================================
-- MEGA B - AUTOMAÇÃO DE CATEGORIAS FIXAS
-- Versão: 1.2 (2026-02-02)
-- Objetivo: Permitir que categorias fixas tenham valor e data padrão
-- ==========================================

-- 1. Adicionar colunas de automação em categorias
ALTER TABLE public.financeiro_categorias_plano 
ADD COLUMN IF NOT EXISTS valor_padrao NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31);

-- 2. Atualizar categorias fixas existentes com valores sugeridos (podem ser alterados na UI)
UPDATE public.financeiro_categorias_plano SET dia_vencimento = 5, valor_padrao = 2000 WHERE nome = 'Aluguel';
UPDATE public.financeiro_categorias_plano SET dia_vencimento = 10, valor_padrao = 150 WHERE nome = 'Internet';
UPDATE public.financeiro_categorias_plano SET dia_vencimento = 5, valor_padrao = 300 WHERE nome = 'Contador';
UPDATE public.financeiro_categorias_plano SET dia_vencimento = 5 WHERE nome = 'Salários Equipe';
