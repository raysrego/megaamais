-- ULTIMATE MASTER FIX (Case-Insensitive)
-- Enforces Master role for 'loteria@demo.com' regardless of casing.

-- 1. Correct the Profile NOW
UPDATE public.perfis 
SET role = 'master' 
WHERE id IN (
    SELECT id FROM auth.users 
    WHERE LOWER(TRIM(email)) = 'loteria@demo.com'
);

-- 2. Update the Trigger to be equally resilient
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_email TEXT := 'loteria@demo.com'; 
  new_role user_role;
BEGIN
  -- Strict Logic with Case Insensitivity
  IF LOWER(TRIM(new.email)) = target_email THEN
    new_role := 'master';
  ELSE
    new_role := 'operador';
  END IF;

  INSERT INTO public.perfis (id, role, nome, loja_id)
  VALUES (new.id, new_role, new.raw_user_meta_data->>'full_name', NULL);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Diagnostic Report
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT u.email, p.role, p.id
        FROM auth.users u
        LEFT JOIN public.perfis p ON p.id = u.id
        WHERE LOWER(TRIM(u.email)) = 'loteria@demo.com'
    ) LOOP
        RAISE NOTICE 'USER FOUND: Email=%, Role=%, ID=%', r.email, r.role, r.id;
    END LOOP;
END $$;
