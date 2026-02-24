-- REBUILD PERMISSIONS V2 (Clean Slate)
-- Goal: Reset perfis, enforce 'loteria@demo.com' as ONLY Master.

-- 1. Disable RLS momentarily to allow bulk operations (or just rely on Service Key power)
-- Not strictly necessary via SQL Editor but good practice if running via client. 
-- We'll rely on the fact this is run in SQL Editor.

-- 2. Update Trigger Function to be STRICT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_email TEXT := 'loteria@demo.com'; 
  new_role user_role;
BEGIN
  -- Strict Logic:
  -- Only the specific email gets 'master'.
  -- Everyone else gets 'operador'.
  -- We removed the "first user" logic because it's flaky if users are deleted/recreated.
  
  IF new.email = target_email THEN
    new_role := 'master';
  ELSE
    new_role := 'operador'; -- Default safe role
  END IF;

  -- Insert with store_id as NULL initially (Master is always NULL, Operators assigned later)
  INSERT INTO public.perfis (id, role, nome, loja_id)
  VALUES (new.id, new_role, new.raw_user_meta_data->>'full_name', NULL);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Rebuild Data
DO $$
DECLARE
    r RECORD;
BEGIN
    -- A. Clear existing profiles to remove any 'bad state'
    -- This is safe because profiles are just cached permission states for Auth Users.
    DELETE FROM public.perfis;
    
    -- B. Re-insert for every existing user in Auth
    FOR r IN SELECT * FROM auth.users LOOP
        -- Apply the same logic as the trigger manually
        IF r.email = 'loteria@demo.com' THEN
             INSERT INTO public.perfis (id, role, nome, loja_id)
             VALUES (r.id, 'master', r.raw_user_meta_data->>'full_name', NULL);
        ELSE
             INSERT INTO public.perfis (id, role, nome, loja_id)
             VALUES (r.id, 'operador', r.raw_user_meta_data->>'full_name', NULL);
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Permissions Rebuilt. loteria@demo.com is Master. All others are Operators.';
END $$;
