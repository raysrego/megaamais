/*
  # RLS Policies - Core Tables
  Security helper functions and policies for all main tables.
*/

-- Helper functions (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_gerente_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_loja_id()
RETURNS UUID AS $$
  SELECT loja_id FROM public.perfis WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── perfis ──
CREATE POLICY "Users read own profile or admin reads all"
  ON perfis FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users insert own profile"
  ON perfis FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users update own profile"
  ON perfis FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "Service role insert perfis"
  ON perfis FOR INSERT TO service_role
  WITH CHECK (true);

-- ── empresas ──
CREATE POLICY "Authenticated read empresas"
  ON empresas FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage empresas"
  ON empresas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin update empresas"
  ON empresas FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── grupos ──
CREATE POLICY "Authenticated read grupos"
  ON grupos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── produtos ──
CREATE POLICY "Authenticated read produtos"
  ON produtos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage produtos"
  ON produtos FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente_or_admin());

CREATE POLICY "Admin update produtos"
  ON produtos FOR UPDATE TO authenticated
  USING (public.is_gerente_or_admin()) WITH CHECK (public.is_gerente_or_admin());

-- ── terminais ──
CREATE POLICY "Authenticated read terminais"
  ON terminais FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage terminais"
  ON terminais FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente_or_admin());

CREATE POLICY "Admin update terminais"
  ON terminais FOR UPDATE TO authenticated
  USING (public.is_gerente_or_admin()) WITH CHECK (public.is_gerente_or_admin());

-- ── categorias_produtos ──
CREATE POLICY "Authenticated read categorias_produtos"
  ON categorias_produtos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── loja_produtos ──
CREATE POLICY "Users read loja_produtos"
  ON loja_produtos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage loja_produtos"
  ON loja_produtos FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente_or_admin());

-- ── financeiro_bancos ──
CREATE POLICY "Authenticated read bancos"
  ON financeiro_bancos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── financeiro_contas_bancarias ──
CREATE POLICY "Users read own contas bancarias"
  ON financeiro_contas_bancarias FOR SELECT TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Admin manage contas bancarias"
  ON financeiro_contas_bancarias FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente_or_admin());

CREATE POLICY "Admin update contas bancarias"
  ON financeiro_contas_bancarias FOR UPDATE TO authenticated
  USING (public.is_gerente_or_admin()) WITH CHECK (public.is_gerente_or_admin());

-- ── financeiro_itens_plano ──
CREATE POLICY "Users read own itens plano"
  ON financeiro_itens_plano FOR SELECT TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users manage itens plano"
  ON financeiro_itens_plano FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users update itens plano"
  ON financeiro_itens_plano FOR UPDATE TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin())
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Admin delete itens plano"
  ON financeiro_itens_plano FOR DELETE TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin());

-- ── financeiro_contas ──
CREATE POLICY "Users read own financeiro contas"
  ON financeiro_contas FOR SELECT TO authenticated
  USING ((loja_id = public.user_loja_id() OR public.is_admin()) AND deleted_at IS NULL);

CREATE POLICY "Users insert financeiro contas"
  ON financeiro_contas FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users update financeiro contas"
  ON financeiro_contas FOR UPDATE TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin())
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users delete financeiro contas"
  ON financeiro_contas FOR DELETE TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin());

-- ── financeiro_parametros ──
CREATE POLICY "Authenticated read parametros"
  ON financeiro_parametros FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage parametros"
  ON financeiro_parametros FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin update parametros"
  ON financeiro_parametros FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── caixa_sessoes ──
CREATE POLICY "Users read own caixa sessoes"
  ON caixa_sessoes FOR SELECT TO authenticated
  USING (operador_id = auth.uid() OR loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users insert caixa sessoes"
  ON caixa_sessoes FOR INSERT TO authenticated
  WITH CHECK (operador_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users update caixa sessoes"
  ON caixa_sessoes FOR UPDATE TO authenticated
  USING (operador_id = auth.uid() OR public.is_gerente_or_admin())
  WITH CHECK (operador_id = auth.uid() OR public.is_gerente_or_admin());

-- ── caixa_movimentacoes ──
CREATE POLICY "Users read caixa movimentacoes"
  ON caixa_movimentacoes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Users insert caixa movimentacoes"
  ON caixa_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users update caixa movimentacoes"
  ON caixa_movimentacoes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_gerente_or_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_gerente_or_admin());

CREATE POLICY "Users delete caixa movimentacoes"
  ON caixa_movimentacoes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- ── cofre_movimentacoes ──
CREATE POLICY "Users read cofre movimentacoes"
  ON cofre_movimentacoes FOR SELECT TO authenticated
  USING ((loja_id = public.user_loja_id() OR public.is_admin()) AND deleted_at IS NULL);

CREATE POLICY "Users insert cofre movimentacoes"
  ON cofre_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Admin update cofre movimentacoes"
  ON cofre_movimentacoes FOR UPDATE TO authenticated
  USING (public.is_gerente_or_admin()) WITH CHECK (public.is_gerente_or_admin());

-- ── boloes ──
CREATE POLICY "Users read boloes"
  ON boloes FOR SELECT TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Admin manage boloes"
  ON boloes FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Admin update boloes"
  ON boloes FOR UPDATE TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin())
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

-- ── cotas_boloes ──
CREATE POLICY "Users read cotas"
  ON cotas_boloes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users update cotas"
  ON cotas_boloes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert cotas"
  ON cotas_boloes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── vendas_boloes ──
CREATE POLICY "Users read vendas"
  ON vendas_boloes FOR SELECT TO authenticated
  USING ((loja_id = public.user_loja_id() OR public.is_admin()) AND deleted_at IS NULL);

CREATE POLICY "Users insert vendas"
  ON vendas_boloes FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users update vendas"
  ON vendas_boloes FOR UPDATE TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin())
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

-- ── caixa_bolao_sessoes ──
CREATE POLICY "Users read caixa bolao sessoes"
  ON caixa_bolao_sessoes FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid() OR public.is_gerente_or_admin());

CREATE POLICY "Users insert caixa bolao sessoes"
  ON caixa_bolao_sessoes FOR INSERT TO authenticated
  WITH CHECK (responsavel_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users update caixa bolao sessoes"
  ON caixa_bolao_sessoes FOR UPDATE TO authenticated
  USING (responsavel_id = auth.uid() OR public.is_gerente_or_admin())
  WITH CHECK (responsavel_id = auth.uid() OR public.is_gerente_or_admin());

-- ── audit_logs ──
CREATE POLICY "Admin read audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "System insert audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── fechamento_tfl ──
CREATE POLICY "Authenticated read tfl"
  ON fechamento_tfl FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert tfl"
  ON fechamento_tfl FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update tfl"
  ON fechamento_tfl FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── fechamento_caixa_ia ──
CREATE POLICY "Authenticated read caixa ia"
  ON fechamento_caixa_ia FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert caixa ia"
  ON fechamento_caixa_ia FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update caixa ia"
  ON fechamento_caixa_ia FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── categorias_operacionais ──
CREATE POLICY "Authenticated read categorias operacionais"
  ON categorias_operacionais FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage categorias operacionais"
  ON categorias_operacionais FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente_or_admin());

CREATE POLICY "Admin update categorias operacionais"
  ON categorias_operacionais FOR UPDATE TO authenticated
  USING (public.is_gerente_or_admin()) WITH CHECK (public.is_gerente_or_admin());

-- ── conciliacao_extratos ──
CREATE POLICY "Users read conciliacao"
  ON conciliacao_extratos FOR SELECT TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users manage conciliacao"
  ON conciliacao_extratos FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users update conciliacao"
  ON conciliacao_extratos FOR UPDATE TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin())
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

-- ── financeiro_transacoes_bancarias ──
CREATE POLICY "Users read transacoes bancarias"
  ON financeiro_transacoes_bancarias FOR SELECT TO authenticated
  USING (loja_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Users insert transacoes bancarias"
  ON financeiro_transacoes_bancarias FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.user_loja_id() OR public.is_admin());

-- ── usuarios ──
CREATE POLICY "Users read usuarios"
  ON usuarios FOR SELECT TO authenticated
  USING (id = auth.uid() OR empresa_id = public.user_loja_id() OR public.is_admin());

CREATE POLICY "Service role insert usuarios"
  ON usuarios FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Admin insert usuarios"
  ON usuarios FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin update usuarios"
  ON usuarios FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
