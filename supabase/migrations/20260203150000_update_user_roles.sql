-- Migration: Sync User Roles with New Hierarchy (ULTIMATE FIX)
-- Data: 2026-02-03
-- Resolve dependências de RLS e erros de cast de ENUM

-- 1. Derrubar políticas que dependem da coluna role ou das funções
DROP POLICY IF EXISTS "gerente_venda_select_loja" ON public.vendas_boloes;
DROP POLICY IF EXISTS "perfil_gerente_loja" ON public.perfis;
DROP POLICY IF EXISTS "perfil_master_select" ON public.perfis;
DROP POLICY IF EXISTS "perfil_master_all" ON public.perfis;

-- 2. Garantir que os novos valores existam no ENUM (master -> admin, op_master -> op_admin)
-- Usamos RENAME VALUE que é seguro se o valor de origem existe
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'master') THEN
    ALTER TYPE user_role RENAME VALUE 'master' TO 'admin';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'op_master') THEN
    ALTER TYPE user_role RENAME VALUE 'op_master' TO 'op_admin';
  END IF;
  
  -- Se as roles novas não existirem (nem como rename nem original), adicionamos
  -- Nota: Isso só funciona se rodar fora de um bloco transacional que use essas roles.
  -- Mas como o RENAME VALUE já deve ter resolvido na maioria dos casos, deixamos como fallback.
END $$;

-- 3. Caso o ENUM ainda não tenha as roles (ex: instalação limpa), o usuário pode precisar rodar estes separadamente.
-- Mas tentaremos atualizar os dados convertendo para TEXT para evitar erro 22P02
UPDATE public.perfis 
SET role = 'admin'::user_role 
WHERE role::text = 'master' OR role::text = 'admin'; -- Garante consistência

-- 4. Re-sincronizar funções auxiliares
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = auth.uid() 
    AND role::text IN ('admin', 'master') -- Retrocompatibilidade de texto
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = auth.uid() 
    AND role::text IN ('admin', 'gerente', 'master')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recriar as políticas derrubadas
CREATE POLICY "gerente_venda_select_loja" ON vendas_boloes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM caixa_sessoes cs
      JOIN perfis p ON p.id = auth.uid()
      WHERE cs.id = vendas_boloes.sessao_caixa_id
        AND cs.loja_id = p.loja_id
        AND p.role::text IN ('gerente', 'admin', 'master')
    )
  );

CREATE POLICY "perfil_gerente_loja" ON public.perfis
  FOR SELECT USING (
    (SELECT role::text FROM public.perfis WHERE id = auth.uid()) = 'gerente' 
    AND loja_id = (SELECT loja_id FROM public.perfis WHERE id = auth.uid())
  );

CREATE POLICY "perfil_master_select" ON public.perfis
  FOR SELECT USING (public.is_master());

CREATE POLICY "perfil_master_all" ON public.perfis
  FOR ALL USING (public.is_master());

-- 6. Garantir Admin Total
UPDATE public.perfis SET role = 'admin' 
WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'loteria@demo.com');
