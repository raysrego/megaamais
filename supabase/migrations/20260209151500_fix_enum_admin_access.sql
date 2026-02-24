-- ===================================================================
-- REPAIR: Standardizing Admin Role (admin vs master)
-- Data: 2026-02-09
-- Objetivo: Corrigir inconsistências entre os termos 'admin' e 'master' 
--           que causam erros de cast de ENUM (invalid input value).
-- ===================================================================

-- 1. Garantir que o ENUM tenha os valores corretos
-- Se 'master' existir, renomeamos para 'admin' por consistência com o v3
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'master') 
     AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'admin') THEN
    ALTER TYPE user_role RENAME VALUE 'master' TO 'admin';
  END IF;
END $$;

-- 2. Corrigir as Funções de Contexto (Super Robust)
-- Usamos 'admin' como o valor oficial do ENUM agora.
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfis p 
        WHERE p.id = auth.uid() 
        AND p.role::text IN ('admin', 'master') -- Aceitar ambos como texto para evitar erros de cast
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role AS $$
  -- Retorna o enum diretamente
  SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfis p 
        WHERE p.id = auth.uid() 
        AND p.role::text IN ('admin', 'master', 'gerente')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Corrigir Trigger de Novo Usuário (Prevenção de erros no signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role public.user_role;
  raw_role text;
  raw_loja_id uuid;
BEGIN
  -- Tentar extrair role dos metadados
  raw_role := new.raw_user_meta_data->>'role';
  
  BEGIN
    IF raw_role IS NOT NULL THEN
      -- Mapeamento de emergência: se vier 'master', vira 'admin'
      IF raw_role = 'master' THEN
        new_role := 'admin'::public.user_role;
      ELSE
        new_role := raw_role::public.user_role;
      END IF;
    ELSIF LOWER(TRIM(new.email)) = 'loteria@demo.com' THEN
      new_role := 'admin'::public.user_role;
    ELSE
      new_role := 'operador'::public.user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    new_role := 'operador'::public.user_role;
  END;

  -- Tentar extrair loja_id
  IF new.raw_user_meta_data->>'loja_id' IS NOT NULL THEN
    raw_loja_id := (new.raw_user_meta_data->>'loja_id')::uuid;
  END IF;

  INSERT INTO public.perfis (id, role, nome, loja_id)
  VALUES (
    new.id, 
    new_role, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    raw_loja_id
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    role = EXCLUDED.role,
    loja_id = EXCLUDED.loja_id,
    updated_at = now();
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Garantir que a Loja ID NULL para Admin não quebre RLS
-- Adicionando política que permite master ver tudo explicitamente
DROP POLICY IF EXISTS "perfil_master_select_all" ON public.perfis;
CREATE POLICY "perfil_master_select_all" ON public.perfis
    FOR SELECT TO authenticated
    USING (public.is_master());

-- 5. Force Sync: Garantir que o admin principal tenha a role 'admin' no enum
UPDATE public.perfis 
SET role = 'admin'::public.user_role 
WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'loteria@demo.com');

-- 6. RPC: Get All Users (Bypass RLS overhead para o Admin)
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Verifica se quem está chamando é master/admin antes de liberar
    IF NOT public.is_master() THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_agg(t) INTO result
    FROM (
        SELECT * FROM public.perfis 
        ORDER BY ativo DESC, created_at DESC
    ) t;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
