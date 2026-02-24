-- 1. Create Enum for Roles (Safely)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('master', 'gerente', 'op_master', 'operador');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Profiles Table (Extension of Auth)
CREATE TABLE IF NOT EXISTS perfis (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role DEFAULT 'operador',
  nome TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Profiles (Drop and Recreate to be safe)
DROP POLICY IF EXISTS "Usuarios podem ver seu proprio perfil" ON perfis;
DROP POLICY IF EXISTS "Master pode ver todos os perfis" ON perfis;
DROP POLICY IF EXISTS "Master pode atualizar perfis" ON perfis;

-- Users can view their own profile
CREATE POLICY "Usuarios podem ver seu proprio perfil" ON perfis
  FOR SELECT USING (auth.uid() = id);

-- Masters can view all profiles
-- NOTE: Changed to also allow if user IS the row being queried (redundant but safe)
-- OR if the requester is master
CREATE POLICY "Master pode ver todos os perfis" ON perfis
  FOR SELECT USING (
    (auth.uid() = id) OR 
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'master')
  );

-- Masters can update any profile (to change roles)
CREATE POLICY "Master pode atualizar perfis" ON perfis
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'master')
  );

-- 5. Auto-Profile Trigger with FIRST USER Logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  count_users INTEGER;
  new_role user_role;
BEGIN
  -- Count existing profiles
  SELECT count(*) INTO count_users FROM public.perfis;
  
  -- If table is empty, first user is MASTER. Else OPERADOR.
  IF count_users = 0 THEN
    new_role := 'master';
  ELSE
    new_role := 'operador';
  END IF;

  INSERT INTO public.perfis (id, role, nome)
  VALUES (new.id, new_role, new.raw_user_meta_data->>'full_name');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Helper Function to check if user is master (for RLS usage in other tables)
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = auth.uid() 
    AND role = 'master'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Sync Existing Users (Fix for your current issue)
-- This will insert profiles for any user that exists in auth.users but not in perfis
-- And it will FORCE the first user found (by created_at) to be MASTER if no master exists.
DO $$
DECLARE
    r RECORD;
    master_exists BOOLEAN;
BEGIN
    -- Check if any master exists
    SELECT EXISTS (SELECT 1 FROM public.perfis WHERE role = 'master') INTO master_exists;

    -- For each user in auth...
    FOR r IN SELECT * FROM auth.users ORDER BY created_at ASC LOOP
        -- If profile doesn't exist, create it
        IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE id = r.id) THEN
            -- If no master exists yet, this one becomes master
            IF NOT master_exists THEN
                INSERT INTO public.perfis (id, role, nome) VALUES (r.id, 'master', r.raw_user_meta_data->>'full_name');
                master_exists := TRUE; -- Now we have a master
            ELSE
                INSERT INTO public.perfis (id, role, nome) VALUES (r.id, 'operador', r.raw_user_meta_data->>'full_name');
            END IF;
        END IF;
    END LOOP;
    
    -- FORCE UPDATE: If you specifically want to ensure 'loteria@demo.com' is master regardless of order
    UPDATE public.perfis 
    SET role = 'master' 
    WHERE id IN (SELECT id FROM auth.users WHERE email = 'loteria@demo.com');
    
END $$;
