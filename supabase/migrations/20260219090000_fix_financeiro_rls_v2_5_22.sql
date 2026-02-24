-- ===================================================================
-- FIX v2.5.22: Limpar RLS duplicada em financeiro_contas
-- Data: 2026-02-19
-- Problema: Policy "financeiro_contas_isolation" (SELECT only) é 
--           redundante com "financeiro_contas_modify" (FOR ALL).
--           Postgres avalia ambas em OR para cada SELECT, overhead desnecessário.
-- Solução: Remover a policy redundante e adicionar WITH CHECK explícito.
-- ===================================================================

-- 1. Remover policy SELECT redundante (já coberta pelo FOR ALL)
DROP POLICY IF EXISTS "financeiro_contas_isolation" ON public.financeiro_contas;

-- 2. Recriar policy "modify" com WITH CHECK explícito para INSERT
-- (Sem WITH CHECK, INSERT pode falhar silenciosamente em alguns cenários)
DROP POLICY IF EXISTS "financeiro_contas_modify" ON public.financeiro_contas;

CREATE POLICY "financeiro_contas_access" ON public.financeiro_contas
    FOR ALL TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id())
    WITH CHECK (public.is_master() OR loja_id = public.get_my_loja_id());

-- 3. Garantir GRANT necessário
GRANT ALL ON public.financeiro_contas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE financeiro_contas_id_seq TO authenticated;
