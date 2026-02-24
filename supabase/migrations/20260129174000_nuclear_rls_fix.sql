-- NUCLEAR FIX: End 500 Errors and Force Master
-- This script sanitizes all RLS recursion and enforces the Master rule.

-- 1. Helper Functions (SECURITY DEFINER bypasses RLS to avoid loops)
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.perfis WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_loja_id()
RETURNS UUID AS $$
  SELECT loja_id FROM public.perfis WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
  SELECT (public.get_my_role() = 'master');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Clean Up Policies
DROP POLICY IF EXISTS "Ver proprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Master ver tudo" ON public.perfis;
DROP POLICY IF EXISTS "Gerente ver sua loja" ON public.perfis;
DROP POLICY IF EXISTS "Master atualizar" ON public.perfis;
DROP POLICY IF EXISTS "Usuarios podem ver seu proprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Master pode ver todos os perfis" ON public.perfis;
DROP POLICY IF EXISTS "Master pode atualizar perfis" ON public.perfis;

-- 3. Recreate Clean, Non-Recursive Policies
-- Every user can see their own data
CREATE POLICY "perfil_select_proprio" ON public.perfis
  FOR SELECT USING (auth.uid() = id);

-- Masters can see and update everything
CREATE POLICY "perfil_master_select" ON public.perfis
  FOR SELECT USING (public.is_master());

CREATE POLICY "perfil_master_all" ON public.perfis
  FOR ALL USING (public.is_master());

-- Managers can see people from their own store (using the safe function)
CREATE POLICY "perfil_gerente_loja" ON public.perfis
  FOR SELECT USING (
    public.get_my_role() = 'gerente' AND 
    loja_id = public.get_my_loja_id()
  );

-- 4. Rigorous Trigger for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role user_role;
BEGIN
  -- If email matches our master email -> MASTER
  IF LOWER(TRIM(new.email)) = 'loteria@demo.com' THEN
    new_role := 'master';
  ELSE
    new_role := 'operador';
  END IF;

  INSERT INTO public.perfis (id, role, nome)
  VALUES (new.id, new_role, new.raw_user_meta_data->>'full_name');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Final Data Correction
UPDATE public.perfis 
SET role = 'master' 
WHERE id IN (
    SELECT id FROM auth.users 
    WHERE LOWER(TRIM(email)) = 'loteria@demo.com'
);

-- Ensure all others follow the rules (if you only want ONE master initially)
-- UPDATE public.perfis SET role = 'operador' WHERE role = 'master' AND id NOT IN (SELECT id FROM auth.users WHERE email = 'loteria@demo.com');
