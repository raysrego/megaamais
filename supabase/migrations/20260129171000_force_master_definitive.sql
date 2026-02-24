-- GOLDEN FIX: Force Master Permission Definitive
-- This script overrides previous logic to ensuring 'loteria@demo.com' is ALWAYS Master.

-- 1. Create a Specific Function for this Constraint
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  count_users INTEGER;
  new_role user_role;
  target_email TEXT := 'loteria@demo.com'; -- HARDCODED ADMIN EMAIL
BEGIN
  -- Count existing profiles
  SELECT count(*) INTO count_users FROM public.perfis;
  
  -- LOGIC:
  -- 1. If email matches target -> MASTER
  -- 2. If table is empty -> MASTER
  -- 3. Otherwise -> OPERADOR
  
  IF new.email = target_email THEN
    new_role := 'master';
  ELSIF count_users = 0 THEN
    new_role := 'master';
  ELSE
    new_role := 'operador';
  END IF;

  INSERT INTO public.perfis (id, role, nome)
  VALUES (new.id, new_role, new.raw_user_meta_data->>'full_name');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Force Update NOW (in case the user already exists as operator)
UPDATE public.perfis
SET role = 'master'
FROM auth.users
WHERE public.perfis.id = auth.users.id
AND auth.users.email = 'loteria@demo.com';

-- 3. Verify and Output (for the logs)
DO $$
DECLARE
    r_role user_role;
BEGIN
    SELECT p.role INTO r_role 
    FROM public.perfis p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = 'loteria@demo.com';
    
    IF r_role IS NULL THEN
        RAISE NOTICE 'User loteria@demo.com does not have a profile yet.';
    ELSE
        RAISE NOTICE 'User loteria@demo.com is now: %', r_role;
    END IF;
END $$;
