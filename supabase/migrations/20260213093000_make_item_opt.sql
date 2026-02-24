-- Migration: Make item_financeiro_id optional
-- Description: Desacopla a obrigatoriedade de ter um ID de item financeiro vinculado.
--            Isso permite lançamentos com categorias em texto livre ("Excel Mode").

ALTER TABLE public.financeiro_contas
ALTER COLUMN item_financeiro_id DROP NOT NULL;

-- Adicionalmente, vamos garantir que a coluna 'categoria' (texto) seja a fonte da verdade para exibição
-- quando não houver ID vinculado.
COMMENT ON COLUMN public.financeiro_contas.item IS 'Nome da categoria (Texto Livre). Se houver item_financeiro_id, deve estar sincronizado, mas o texto tem precedência visual.';
