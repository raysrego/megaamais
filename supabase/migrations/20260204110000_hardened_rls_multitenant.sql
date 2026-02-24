-- ===================================================================
-- SPRINT SEGURANÇA: Endurecimento de RLS (Multi-Tenant)
-- Data: 2026-02-04
-- Objetivo: Restringir acesso de Gerentes/Operadores apenas aos dados da sua loja_id.
--           Garantir que apenas Administradores (is_master) tenham visão global.
-- ===================================================================

-- 1. HELPER FUNCTIONS DE SEGURANÇA (Garantir que existam e sejam robustas)
CREATE OR REPLACE FUNCTION public.get_my_loja_id()
RETURNS UUID AS $$
    SELECT loja_id FROM public.perfis WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. HARDENING: PERFIS (Isolamento de pessoal)
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_select_all_authenticated" ON public.perfis;
DROP POLICY IF EXISTS "perfil_select_isolation" ON public.perfis;

CREATE POLICY "perfil_select_isolation" ON public.perfis
    FOR SELECT TO authenticated
    USING (
        public.is_master() OR 
        loja_id = public.get_my_loja_id() OR
        id = auth.uid()
    );

-- 3. HARDENING: LOJAS (Isolamento de filial)
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lojas_isolation" ON public.lojas;

CREATE POLICY "lojas_isolation" ON public.lojas
    FOR SELECT TO authenticated
    USING (
        public.is_master() OR 
        id = public.get_my_loja_id()
    );

-- 4. HARDENING: FINANCEIRO_ITENS_PLANO (Plano de Contas)
ALTER TABLE public.financeiro_itens_plano ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itens_plano_select" ON public.financeiro_itens_plano;
DROP POLICY IF EXISTS "itens_plano_insert" ON public.financeiro_itens_plano;
DROP POLICY IF EXISTS "itens_plano_update" ON public.financeiro_itens_plano;
DROP POLICY IF EXISTS "itens_plano_delete" ON public.financeiro_itens_plano;

CREATE POLICY "itens_plano_isolation_select" ON public.financeiro_itens_plano
    FOR SELECT TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

CREATE POLICY "itens_plano_isolation_insert" ON public.financeiro_itens_plano
    FOR INSERT TO authenticated
    WITH CHECK (public.is_master() OR loja_id = public.get_my_loja_id());

CREATE POLICY "itens_plano_isolation_update" ON public.financeiro_itens_plano
    FOR UPDATE TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

CREATE POLICY "itens_plano_isolation_delete" ON public.financeiro_itens_plano
    FOR DELETE TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

-- 5. HARDENING: BOLOES
ALTER TABLE public.boloes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boloes_select_policy" ON public.boloes;
DROP POLICY IF EXISTS "boloes_insert_policy" ON public.boloes;
DROP POLICY IF EXISTS "boloes_update_policy" ON public.boloes;

CREATE POLICY "boloes_isolation_select" ON public.boloes
    FOR SELECT TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

CREATE POLICY "boloes_isolation_insert" ON public.boloes
    FOR INSERT TO authenticated
    WITH CHECK (public.is_master() OR loja_id = public.get_my_loja_id());

CREATE POLICY "boloes_isolation_update" ON public.boloes
    FOR UPDATE TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

-- 6. HARDENING: COTAS_BOLOES (Cascata de segurança)
ALTER TABLE public.cotas_boloes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotas_boloes_isolation" ON public.cotas_boloes;

CREATE POLICY "cotas_boloes_isolation" ON public.cotas_boloes
    FOR ALL TO authenticated
    USING (
        public.is_master() OR 
        EXISTS (
            SELECT 1 FROM public.boloes b
            WHERE b.id = bolao_id
            AND b.loja_id = public.get_my_loja_id()
        )
    );

-- 7. HARDENING: VENDAS_BOLOES
ALTER TABLE public.vendas_boloes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendas_boloes_isolation" ON public.vendas_boloes;

CREATE POLICY "vendas_boloes_isolation" ON public.vendas_boloes
    FOR SELECT TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

-- 8. HARDENING: CAIXA_SESSOES
ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "caixa_sessoes_isolation" ON public.caixa_sessoes;
DROP POLICY IF EXISTS "Sessões: Operador vê a sua" ON public.caixa_sessoes;

CREATE POLICY "caixa_sessoes_isolation" ON public.caixa_sessoes
    FOR SELECT TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

CREATE POLICY "caixa_sessoes_insert" ON public.caixa_sessoes
    FOR INSERT TO authenticated
    WITH CHECK (public.is_master() OR loja_id = public.get_my_loja_id());

-- 9. HARDENING: CAIXA_MOVIMENTACOES (Segurança profunda via sessão)
ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "caixa_movimentacoes_isolation" ON public.caixa_movimentacoes;

CREATE POLICY "caixa_movimentacoes_isolation" ON public.caixa_movimentacoes
    FOR SELECT TO authenticated
    USING (
        public.is_master() OR 
        EXISTS (
            SELECT 1 FROM public.caixa_sessoes s
            WHERE s.id = sessao_id
            AND s.loja_id = public.get_my_loja_id()
        )
    );

-- 10. HARDENING: FINANCEIRO_CONTAS
ALTER TABLE public.financeiro_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financeiro_contas_isolation" ON public.financeiro_contas;

CREATE POLICY "financeiro_contas_isolation" ON public.financeiro_contas
    FOR SELECT TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

CREATE POLICY "financeiro_contas_modify" ON public.financeiro_contas
    FOR ALL TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

-- 11. HARDENING: COFRE_MOVIMENTACOES
ALTER TABLE public.cofre_movimentacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cofre_movimentacoes_isolation" ON public.cofre_movimentacoes;

CREATE POLICY "cofre_movimentacoes_isolation" ON public.cofre_movimentacoes
    FOR SELECT TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

-- 12. HARDENING: TERMINAIS
ALTER TABLE public.terminais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "terminais_isolation" ON public.terminais;

CREATE POLICY "terminais_isolation" ON public.terminais
    FOR SELECT TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());

-- 13. REFORÇO DE GRANTS PARA SEGURANÇA DEFINER
-- Garante que funções RPC consigam operar mesmo com RLS ativado se necessário,
-- mas aqui o objetivo é que o RLS seja respeitado.

COMMENT ON FUNCTION public.get_my_loja_id() IS 'Retorna o loja_id do usuário autenticado no contexto do Supabase.';
