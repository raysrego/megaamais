-- Migration: Emergency RLS Fix for Profiles (v2)
-- Data: 2026-02-03
-- Objetivo: Garantir acesso aos perfis e evitar recursão nas políticas RLS.

-- 1. Funções de Segurança (SECURITY DEFINER para pular RLS)
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = user_id 
    AND role::text IN ('admin', 'gerente', 'master')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_master(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = user_id 
    AND role::text IN ('admin', 'master')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpeza total de políticas em perfis
DROP POLICY IF EXISTS "perfil_select_proprio" ON public.perfis;
DROP POLICY IF EXISTS "perfil_select_all_authenticated" ON public.perfis;
DROP POLICY IF EXISTS "perfil_admin_select_all" ON public.perfis;
DROP POLICY IF EXISTS "perfil_gerente_loja" ON public.perfis;
DROP POLICY IF EXISTS "perfil_master_select" ON public.perfis;
DROP POLICY IF EXISTS "perfil_master_all" ON public.perfis;

-- 3. Criar políticas seguras (Simples e Diretas)
-- 3.1 Usuário logado sempre vê seu próprio perfil (Sem função = Sem recursão)
CREATE POLICY "perfil_select_own" ON public.perfis
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3.2 Admin vê tudo (Usa função SECURITY DEFINER externa)
CREATE POLICY "perfil_admin_all" ON public.perfis
  FOR SELECT TO authenticated
  USING (public.check_is_admin(auth.uid()));

-- 3.3 Master pode TUDO
CREATE POLICY "perfil_master_full" ON public.perfis
  FOR ALL TO authenticated
  USING (public.check_is_master(auth.uid()));

-- 4. Garantir permissões de acesso
GRANT SELECT ON public.perfis TO authenticated;

-- 5. Helper functions globais (legacy compatibility)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT public.check_is_admin(auth.uid());
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_master() RETURNS BOOLEAN AS $$
  SELECT public.check_is_master(auth.uid());
$$ LANGUAGE sql STABLE;
