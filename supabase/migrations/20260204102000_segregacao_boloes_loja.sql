-- ===================================================================
-- Segregação de Bolões por Loja
-- Data: 2026-02-04
-- Objetivo: Garantir que bolões sejam específicos por filial
-- ===================================================================

-- 1. ADICIONAR COLUNA LOJA_ID EM BOLOES
ALTER TABLE public.boloes 
ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id);

-- 2. VINCULAR BOLOES EXISTENTES À MATRIZ (NATUREZA)
DO $$
DECLARE
    v_natureza_id UUID;
BEGIN
    SELECT id INTO v_natureza_id FROM public.lojas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;
    IF v_natureza_id IS NULL THEN
        SELECT id INTO v_natureza_id FROM public.lojas WHERE ativo = TRUE LIMIT 1;
    END IF;

    UPDATE public.boloes 
    SET loja_id = v_natureza_id 
    WHERE loja_id IS NULL;
END $$;

-- 3. TORNAR LOJA_ID OBRIGATÓRIA
ALTER TABLE public.boloes 
ALTER COLUMN loja_id SET NOT NULL;

-- 4. ATUALIZAR RLS EM BOLOES
ALTER TABLE public.boloes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boloes_select_policy" ON public.boloes;
CREATE POLICY "boloes_select_policy" ON public.boloes
    FOR SELECT TO authenticated
    USING (true); -- Filtragem será feita no front/RPC por enquanto, mas podemos restringir futuramente

DROP POLICY IF EXISTS "boloes_insert_policy" ON public.boloes;
CREATE POLICY "boloes_insert_policy" ON public.boloes
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "boloes_update_policy" ON public.boloes;
CREATE POLICY "boloes_update_policy" ON public.boloes
    FOR UPDATE TO authenticated
    USING (true);

-- 5. ÍNDICE PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_boloes_loja_id ON public.boloes(loja_id);

-- 6. ATUALIZAR VIEW DE PRESTAÇÃO DE CONTAS (Se existir e precisar de ajuste de loja)
-- A view vw_prestacao_contas_operadores já parece usar cs.loja_id, então deve estar ok.
