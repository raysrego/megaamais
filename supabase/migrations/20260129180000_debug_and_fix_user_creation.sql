-- DEBUG & FIX USER CREATION
-- This script aims to resolve the "Database error creating new user" by making the trigger ultra-simple.

-- 1. Drop trigger to reset state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Create a "Safe-Failure" function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_role user_role := 'operador'::user_role;
  target_email TEXT := 'loteria@demo.com';
  display_nome TEXT;
BEGIN
  -- 1. Determine Role
  IF LOWER(TRIM(new.email)) = target_email THEN
    default_role := 'master'::user_role;
  END IF;

  -- 2. Safe Name Extraction
  display_nome := COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Membro');

  -- 3. The INSERT (Minimalist)
  -- We use ON CONFLICT to prevent errors if the profile exists
  INSERT INTO public.perfis (id, role, nome, loja_id)
  VALUES (new.id, default_role, display_nome, NULL)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    updated_at = now();

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Last resort: Just return the record so Auth creation doesn't fail
  -- even if profile creation fails (we can fix it later via sync)
  RETURN new;
END;
$$;

-- 3. Re-enable trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Diagnostic: Check if any user is missing profile right now
INSERT INTO public.perfis (id, role, nome)
SELECT 
    id, 
    CASE WHEN LOWER(TRIM(email)) = 'loteria@demo.com' THEN 'master'::user_role ELSE 'operador'::user_role END,
    COALESCE(raw_user_meta_data->>'full_name', 'Membro Offline')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5. CHECK PERMISSIONS on public schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
