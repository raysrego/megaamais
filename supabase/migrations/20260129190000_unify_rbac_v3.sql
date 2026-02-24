-- ==========================================
-- MIGRATION: 20260129190000_unify_rbac_v3.sql
-- Objetivo: Unificar perfis, endurecer RLS e configurar permissões específicas.
-- ==========================================

-- 0. CORREÇÃO DE ENUM: Renomear valores existentes (MASTER -> ADMIN)
-- Isso resolve o erro 55P04 pois RENAME VALUE pode rodar na mesma transação se o enum não estiver em uso por colunas em índices (que é o nosso caso).
DO $$ 
BEGIN 
  -- Renomear 'master' para 'admin' se 'master' existir e 'admin' não
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'master') 
     AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'admin') THEN
    ALTER TYPE user_role RENAME VALUE 'master' TO 'admin';
  END IF;

  -- Renomear 'op_master' para 'op_admin' por consistência
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'op_master') 
     AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'op_admin') THEN
    ALTER TYPE user_role RENAME VALUE 'op_master' TO 'op_admin';
  END IF;
END $$;

-- 1. ADICIONAR COLUNA ATIVO À TABELA PERFIS (para unificar com 'usuarios')
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- 2. LIMPEZA DE GRANTS EXCESSIVOS (Endurecimento)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Garantir que a role authenticated tenha o básico necessário
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;

-- 3. UNIFICAÇÃO DE DADOS (Sync de usuarios -> perfis)
-- O cast para text e depois para user_role resolve conflitos de tipo durante a transição
INSERT INTO public.perfis (id, role, nome, ativo)
SELECT 
  id, 
  CASE 
    WHEN role = 'master' THEN 'admin'::user_role 
    WHEN role = 'op_master' THEN 'op_admin'::user_role
    ELSE role::user_role 
  END, 
  nome, 
  ativo
FROM public.usuarios
ON CONFLICT (id) DO UPDATE SET
  ativo = EXCLUDED.ativo,
  role = EXCLUDED.role;

-- 4. CONFIGURAÇÃO DOS USUÁRIOS ESPECÍFICOS
-- Admin Total
UPDATE public.perfis SET role = 'admin' 
WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'loteria@demo.com');

-- Gerente
UPDATE public.perfis SET role = 'gerente' 
WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'ildo@gmail.com');

-- Operador
UPDATE public.perfis SET role = 'operador' 
WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'patricia@gmail.com');

-- 5. REFINAMENTO DE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.perfis WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
  SELECT (public.get_my_role() = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_my_role() IN ('admin', 'gerente');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. REFINAMENTO DE RLS
DROP POLICY IF EXISTS "perfil_select_all_authenticated" ON public.perfis;
DROP POLICY IF EXISTS "perfil_admin_full_access" ON public.perfis;
DROP POLICY IF EXISTS "perfil_update_own" ON public.perfis;

CREATE POLICY "perfil_select_all_authenticated" ON public.perfis
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "perfil_admin_full_access" ON public.perfis
  FOR ALL TO authenticated USING (public.is_master());

CREATE POLICY "perfil_update_own" ON public.perfis
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Terminais
ALTER TABLE public.terminais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "terminais_isolation" ON public.terminais;

CREATE POLICY "terminais_isolation" ON public.terminais
FOR ALL TO authenticated USING (
    public.is_master() OR 
    (loja_id = (SELECT loja_id FROM public.perfis WHERE id = auth.uid()))
);

-- Empresas (Isolamento de Filiais)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_isolation" ON public.empresas;

CREATE POLICY "empresas_isolation" ON public.empresas
FOR SELECT TO authenticated USING (
    public.is_master() OR 
    (id = (SELECT loja_id FROM public.perfis WHERE id = auth.uid()))
);

-- 7. GRANTS ESPECÍFICOS
GRANT SELECT ON public.empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.boloes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vendas_boloes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.caixa_sessoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.caixa_movimentacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.terminais TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.produtos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.movimentacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fechamentos_caixa TO authenticated;

-- 8. TRIGGER DE NOVO USUÁRIO ATUALIZADO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role public.user_role;
  raw_role text;
  raw_loja_id uuid;
BEGIN
  -- Tentar extrair role e loja_id dos metadados (se enviado via admin API)
  raw_role := new.raw_user_meta_data->>'role';
  
  BEGIN
    IF raw_role IS NOT NULL THEN
      new_role := raw_role::public.user_role;
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
  -- NUNCA falhar a criação do usuário no Auth, mesmo que o perfil falhe
  -- Erros podem ser logados ou corrigidos via sync posterior
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
