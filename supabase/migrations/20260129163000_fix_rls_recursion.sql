-- FIX: Infinite Recursion in RLS
-- The previous policy caused an infinite loop because checking if user is master 
-- queried the table 'perfis', which triggered the policy again.

-- 1. Ensure the helper function is SECURITY DEFINER (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
DECLARE
  assigned_role user_role;
BEGIN
  SELECT role INTO assigned_role FROM public.perfis WHERE id = auth.uid();
  RETURN assigned_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
BEGIN
  -- Uses the SECURITY DEFINER query to avoid RLS loop
  RETURN (public.get_my_role() = 'master');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Master pode ver todos os perfis" ON perfis;
DROP POLICY IF EXISTS "Master pode atualizar perfis" ON perfis;
DROP POLICY IF EXISTS "Usuarios podem ver seu proprio perfil" ON perfis;

-- 3. Recreate Policies with clean logic

-- Policy 1: Everyone can see their own profile
CREATE POLICY "Ver proprio perfil" ON perfis
  FOR SELECT USING (auth.uid() = id);

-- Policy 2: Masters can see ALL profiles
-- Using public.is_master() which is SECURITY DEFINER avoids the loop
CREATE POLICY "Master ver tudo" ON perfis
  FOR SELECT USING ( public.is_master() );

-- Policy 3: Master Update
CREATE POLICY "Master atualizar" ON perfis
  FOR UPDATE USING ( public.is_master() );

-- 4. Verification: Force Master Role Cleanly
UPDATE public.perfis 
SET role = 'master' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'loteria@demo.com' -- troque pelo seu email se diferente
);
