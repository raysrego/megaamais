-- Migration: Fix Boloes Foreign Key to Empresas
-- Data: 2026-02-12
-- Objetivo: Corrigir erro 23503 onde bolão tenta referenciar tabela 'lojas' (fantasma) ao invés de 'empresas' (real).

-- 1. Corrigir FK da tabela BOLOES
ALTER TABLE public.boloes
DROP CONSTRAINT IF EXISTS boloes_loja_id_fkey;

-- Recriar apontando para empresas
ALTER TABLE public.boloes
ADD CONSTRAINT boloes_loja_id_fkey
FOREIGN KEY (loja_id)
REFERENCES public.empresas(id)
ON DELETE CASCADE;

-- 2. Corrigir FK da tabela VENDAS_BOLOES (preventivo)
ALTER TABLE public.vendas_boloes
DROP CONSTRAINT IF EXISTS vendas_boloes_loja_id_fkey;

ALTER TABLE public.vendas_boloes
ADD CONSTRAINT vendas_boloes_loja_id_fkey
FOREIGN KEY (loja_id)
REFERENCES public.empresas(id)
ON DELETE SET NULL;

-- 3. Garantir que índices existam para performance
CREATE INDEX IF NOT EXISTS idx_boloes_loja_id ON public.boloes(loja_id);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_loja_id ON public.vendas_boloes(loja_id);

-- 4. Confirmação
DO $$
BEGIN
    RAISE NOTICE 'Foreign Keys de boloes e vendas_boloes corrigidas para apontar para public.empresas.';
END $$;
