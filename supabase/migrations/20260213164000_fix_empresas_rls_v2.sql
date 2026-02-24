-- ==============================================================================
-- FIX RLS: EMPRESAS (Versão 2 - Com DROP Preventivo)
-- Data: 2026-02-13
-- Motivo: Corrigir erro "policy already exists" e garantir permissões de INSERT
-- ==============================================================================

-- 1. Dropar políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "empresas_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update" ON public.empresas;

-- 2. Recriar políticas permissivas (Para usuários autenticados)
CREATE POLICY "empresas_insert" ON public.empresas
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "empresas_update" ON public.empresas
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Garantir Grant (caso não tenha)
GRANT ALL ON public.empresas TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
