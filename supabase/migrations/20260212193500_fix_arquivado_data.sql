-- Migration: Fix Arquivado NULLs
-- Description: Correção emergencial para definir arquivado=FALSE onde está NULL.
-- O filtro .eq('arquivado', false) no frontend escondeu itens que tinham esse campo nulo.

-- 1. Atualizar registros existentes
UPDATE public.financeiro_itens_plano
SET arquivado = FALSE
WHERE arquivado IS NULL;

-- 2. Garantir default para futuros inserts
ALTER TABLE public.financeiro_itens_plano
ALTER COLUMN arquivado SET DEFAULT FALSE;

-- 3. Refaz a análise para atualizar estatísticas do índice
ANALYZE public.financeiro_itens_plano;
