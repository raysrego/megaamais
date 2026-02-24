-- FIX USER CREATION TRIGGER
-- Ensures handle_new_user is safe and correctly linked.

-- 1. DROP old trigger to be 100% clean
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Create ultra-robust function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role user_role;
  raw_nome TEXT;
BEGIN
  -- Safe extraction of name from metadata
  BEGIN
    raw_nome := new.raw_user_meta_data->>'full_name';
  EXCEPTION WHEN OTHERS THEN
    raw_nome := 'Novo Usuário';
  END;

  -- Default role logic
  IF new.email IS NOT NULL AND LOWER(TRIM(new.email)) = 'loteria@demo.com' THEN
    new_role := 'master';
  ELSE
    new_role := 'operador';
  END IF;

  -- Insert into profiles
  -- Using ON CONFLICT to avoid "Database error" if profile already exists for some reason
  INSERT INTO public.perfis (id, role, nome, created_at, updated_at)
  VALUES (
    new.id, 
    new_role, 
    COALESCE(raw_nome, 'Membro da Equipe'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    nome = EXCLUDED.nome,
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-link trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Check for existing users without profile (Sync)
-- This ensures that if the trigger failed before, we fix it now.
INSERT INTO public.perfis (id, role, nome)
SELECT 
    id, 
    CASE WHEN LOWER(TRIM(email)) = 'loteria@demo.com' THEN 'master'::user_role ELSE 'operador'::user_role END,
    COALESCE(raw_user_meta_data->>'full_name', 'Membro da Equipe')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
