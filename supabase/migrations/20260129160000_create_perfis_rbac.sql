-- 1. Create Enum for Roles
CREATE TYPE user_role AS ENUM ('master', 'gerente', 'op_master', 'operador');

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

-- 4. RLS Policies for Profiles
-- Users can view their own profile
CREATE POLICY "Usuarios podem ver seu proprio perfil" ON perfis
  FOR SELECT USING (auth.uid() = id);

-- Masters can view all profiles
CREATE POLICY "Master pode ver todos os perfis" ON perfis
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'master')
  );

-- Masters can update any profile (to change roles)
CREATE POLICY "Master pode atualizar perfis" ON perfis
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'master')
  );

-- 5. Auto-Profile Trigger
-- Automatically creates a profile entry when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfis (id, role, nome)
  VALUES (new.id, 'operador', new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
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

-- 7. Helper Function to check if user is admin (master or gerente)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = auth.uid() 
    AND role IN ('master', 'gerente')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Seed: Force current user (You) to be Master if exists
-- Note: Replace 'admin@giroz.com' with your actual email if needed, 
-- or manually run an update after deploy. 
-- For safety, we just ensure the trigger works for new users.
-- Existing users might need manual profile creation if table is new.
INSERT INTO public.perfis (id, role)
SELECT id, 'master' FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'master';
