-- ==============================================================================
-- MIGRATION: FIX GRUPOS RLS
-- Data: 2026-02-13
-- Motivo: A tabela 'grupos' estava restrita apenas a quem tinha role='admin' verificado via join.
--         Como o 'empresas' foi liberado para 'authenticated', vamos alinhar 'grupos' 
--         para evitar que o painel fique vazio se a verificação de role falhar.
-- ==============================================================================

-- 1. Dropar política restritiva anterior
DROP POLICY IF EXISTS "Acesso total para Master" ON public.grupos;

-- 2. Criar políticas mais permissivas para o MVP (Authenticated users podem ver/editar)
--    Isso garante que o usuário consiga ver o grupo "Mega Bolões Brasil"

CREATE POLICY "grupos_select" ON public.grupos
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "grupos_insert" ON public.grupos
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "grupos_update" ON public.grupos
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "grupos_delete" ON public.grupos
    FOR DELETE TO authenticated
    USING (true);

-- 3. Garantir permissões de grant
GRANT ALL ON public.grupos TO authenticated;
