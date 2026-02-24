-- ==============================================================================
-- MIGRATION: RELAX EMPRESAS RLS (FILTERS FIX)
-- Data: 2026-02-13
-- Motivo: O filtro de lojas parou de listar novas filiais para admins. 
--         A política anterior 'empresas_isolation' dependia de funções complexas (is_master).
--         Vamos simplificar para garantir que admins vejam todas as lojas.
-- ==============================================================================

-- 1. Dropar políticas antigas de isolamento
DROP POLICY IF EXISTS "empresas_isolation" ON public.empresas;
DROP POLICY IF EXISTS "lojas_isolation" ON public.empresas;

-- 2. Criar política simplificada de leitura
-- Permitir que qualquer usuário autenticado veja as empresas.
-- A filtragem lógica (quem pode ver o que) será feita no Frontend/API via 'loja_id' do perfil se necessário.
-- Mas para 'combobox' de seleção, geralmente é melhor listar tudo ou filtrar apenas por ativo.

CREATE POLICY "empresas_select_auth" ON public.empresas
    FOR SELECT TO authenticated
    USING (true);

-- 3. Garantir Grant
GRANT SELECT ON public.empresas TO authenticated;
