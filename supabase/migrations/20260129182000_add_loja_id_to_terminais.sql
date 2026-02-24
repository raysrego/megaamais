-- Migrate: Add loja_id to terminais
-- Description: Vincula terminais a lojas específicas para controle multi-filial.

-- 1. Add column
ALTER TABLE public.terminais 
ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.empresas(id);

-- 2. Create index
CREATE INDEX IF NOT EXISTS idx_terminais_loja_id ON public.terminais(loja_id);

-- 3. Update RLS to be strict
DROP POLICY IF EXISTS "Todos os usuários autenticados podem ver terminais" ON public.terminais;
CREATE POLICY "Ver terminais da propria loja" ON public.terminais
FOR SELECT USING (
    (public.is_master()) OR 
    (loja_id = public.get_my_loja_id())
);

-- 4. Set a default store for existing terminals (Optional, based on requirement)
-- Assuming the first store is the main one for existing terminals
UPDATE public.terminais 
SET loja_id = (SELECT id FROM public.empresas LIMIT 1)
WHERE loja_id IS NULL;
