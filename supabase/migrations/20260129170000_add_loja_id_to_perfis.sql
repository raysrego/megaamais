-- 1. Add loja_id column to perfis
ALTER TABLE public.perfis 
ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_perfis_loja_id ON public.perfis(loja_id);

-- 3. Update RLS policies to include store check?
-- Current RLS policies allow users to read their own profile. This remains valid.
-- Master can see all. Remains valid.
-- Manager viewing other profiles?
-- Ideally, a Manager should only see profiles from their own store.

DROP POLICY IF EXISTS "Master ver tudo" ON perfis;

CREATE POLICY "Master ver tudo" ON perfis
  FOR SELECT USING ( public.is_master() );

CREATE POLICY "Gerente ver sua loja" ON perfis
  FOR SELECT USING (
    -- If I am a manager...
    (public.get_my_role() = 'gerente') AND
    -- And the target profile belongs to my store
    (loja_id = (SELECT loja_id FROM public.perfis WHERE id = auth.uid()))
  );
  
-- 4. Update Trigger to handle loja_id (optional, mostly handled by explicit insert in admin action)
-- But we can ensure that if loja_id is not provided, it defaults to NULL.
-- Existing trigger handle_new_user is fine as is (it inserts id, role, nome). 
-- Access control will happen at application level or via Admin Action update.
