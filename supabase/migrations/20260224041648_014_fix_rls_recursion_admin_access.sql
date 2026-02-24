/*
  # Correção de RLS - Recursão Infinita e Acesso Admin
  
  1. Problema Identificado
    - Policies usando `EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')`
    - Isso causa recursão infinita porque a policy de perfis verifica perfis
    - Admin não consegue acessar dados de outras lojas
    
  2. Solução
    - Criar função helper que usa cache e bypass de RLS
    - Simplificar policies para evitar recursão
    - Garantir que admin tem acesso TOTAL a tudo
    
  3. Características
    - Função `is_admin()` com SECURITY DEFINER
    - Função `is_gerente()` para facilitar checks
    - Função `user_loja_id()` para pegar loja do usuário
    - Policies reescritas sem recursão
*/

-- ============================================
-- FUNÇÕES HELPER (sem recursão)
-- ============================================

-- Função: Verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM perfis
        WHERE id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função: Verificar se usuário é gerente ou admin
CREATE OR REPLACE FUNCTION is_gerente_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM perfis
        WHERE id = auth.uid()
        AND role IN ('admin', 'gerente')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função: Pegar loja_id do usuário
CREATE OR REPLACE FUNCTION user_loja_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT loja_id FROM perfis WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- REMOVER POLICIES ANTIGAS (que causam recursão)
-- ============================================

-- Perfis
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON perfis;
DROP POLICY IF EXISTS "Admin pode ver todos os perfis" ON perfis;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON perfis;
DROP POLICY IF EXISTS "Admin pode atualizar todos os perfis" ON perfis;
DROP POLICY IF EXISTS "Admin pode inserir perfis" ON perfis;

-- Usuários
DROP POLICY IF EXISTS "Usuários podem ver próprio usuário" ON usuarios;
DROP POLICY IF EXISTS "Admin pode ver todos os usuários" ON usuarios;

-- Empresas
DROP POLICY IF EXISTS "Usuários veem empresas do próprio grupo" ON empresas;
DROP POLICY IF EXISTS "Admin pode gerenciar empresas" ON empresas;

-- Grupos
DROP POLICY IF EXISTS "Todos veem grupos" ON grupos;

-- Produtos
DROP POLICY IF EXISTS "Todos podem ver categorias ativas" ON categorias_produtos;
DROP POLICY IF EXISTS "Admin pode gerenciar categorias" ON categorias_produtos;
DROP POLICY IF EXISTS "Todos podem ver produtos ativos" ON produtos;
DROP POLICY IF EXISTS "Admin pode gerenciar produtos" ON produtos;
DROP POLICY IF EXISTS "Usuários veem produtos da própria loja" ON loja_produtos;
DROP POLICY IF EXISTS "Admin/gerente pode gerenciar loja_produtos" ON loja_produtos;

-- Terminais
DROP POLICY IF EXISTS "Usuários veem terminais da própria loja" ON terminais;
DROP POLICY IF EXISTS "Admin/gerente pode gerenciar terminais" ON terminais;

-- Financeiro
DROP POLICY IF EXISTS "Todos podem ver bancos" ON financeiro_bancos;
DROP POLICY IF EXISTS "Usuários veem contas bancárias da própria loja" ON financeiro_contas_bancarias;
DROP POLICY IF EXISTS "Admin/gerente pode gerenciar contas bancárias" ON financeiro_contas_bancarias;
DROP POLICY IF EXISTS "Usuários veem itens plano da própria loja" ON financeiro_itens_plano;
DROP POLICY IF EXISTS "Usuários podem criar itens plano" ON financeiro_itens_plano;
DROP POLICY IF EXISTS "Usuários podem atualizar itens plano da própria loja" ON financeiro_itens_plano;
DROP POLICY IF EXISTS "Usuários veem contas financeiras da própria loja" ON financeiro_contas;
DROP POLICY IF EXISTS "Usuários podem criar contas financeiras" ON financeiro_contas;
DROP POLICY IF EXISTS "Usuários podem atualizar contas financeiras da própria loja" ON financeiro_contas;
DROP POLICY IF EXISTS "Usuários veem transações bancárias da própria loja" ON financeiro_transacoes_bancarias;
DROP POLICY IF EXISTS "Admin/gerente pode gerenciar transações bancárias" ON financeiro_transacoes_bancarias;
DROP POLICY IF EXISTS "Todos podem ver parâmetros" ON financeiro_parametros;

-- Caixa
DROP POLICY IF EXISTS "Operadores veem próprias sessões de caixa" ON caixa_sessoes;
DROP POLICY IF EXISTS "Operadores podem criar sessões de caixa" ON caixa_sessoes;
DROP POLICY IF EXISTS "Operadores podem atualizar próprias sessões" ON caixa_sessoes;
DROP POLICY IF EXISTS "Usuários veem movimentações de caixa da própria loja" ON caixa_movimentacoes;
DROP POLICY IF EXISTS "Usuários podem criar movimentações de caixa" ON caixa_movimentacoes;
DROP POLICY IF EXISTS "Usuários veem movimentações do cofre da própria loja" ON cofre_movimentacoes;
DROP POLICY IF EXISTS "Admin/gerente pode gerenciar cofre" ON cofre_movimentacoes;

-- Bolões
DROP POLICY IF EXISTS "Usuários veem bolões da própria loja" ON boloes;
DROP POLICY IF EXISTS "Usuários podem criar bolões" ON boloes;
DROP POLICY IF EXISTS "Admin/gerente pode atualizar bolões" ON boloes;
DROP POLICY IF EXISTS "Usuários veem cotas de bolões da própria loja" ON cotas_boloes;
DROP POLICY IF EXISTS "Sistema pode gerenciar cotas" ON cotas_boloes;
DROP POLICY IF EXISTS "Usuários veem vendas da própria loja" ON vendas_boloes;
DROP POLICY IF EXISTS "Usuários podem criar vendas" ON vendas_boloes;
DROP POLICY IF EXISTS "Admin/gerente pode atualizar vendas" ON vendas_boloes;
DROP POLICY IF EXISTS "Usuários veem prestações da própria loja" ON prestacoes_contas;
DROP POLICY IF EXISTS "Admin/gerente pode criar prestações" ON prestacoes_contas;

-- Auditoria
DROP POLICY IF EXISTS "Admin pode ver todos os logs" ON audit_logs;
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON audit_logs;
DROP POLICY IF EXISTS "Admin pode ver rate limits" ON rate_limit_log;

-- Storage
DROP POLICY IF EXISTS "Usuários podem fazer upload de comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem ver comprovantes da própria loja" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar próprios comprovantes" ON storage.objects;

-- ============================================
-- NOVAS POLICIES (sem recursão, admin com acesso total)
-- ============================================

-- PERFIS: Admin vê tudo, usuários veem próprio perfil
CREATE POLICY "perfis_select_policy" ON perfis FOR SELECT
    USING (
        auth.uid() = id OR is_admin()
    );

CREATE POLICY "perfis_update_policy" ON perfis FOR UPDATE
    USING (auth.uid() = id OR is_admin())
    WITH CHECK (auth.uid() = id OR is_admin());

CREATE POLICY "perfis_insert_policy" ON perfis FOR INSERT
    WITH CHECK (is_admin());

-- USUARIOS: Admin vê tudo, usuários veem próprio
CREATE POLICY "usuarios_select_policy" ON usuarios FOR SELECT
    USING (auth.uid() = id OR is_admin());

CREATE POLICY "usuarios_all_policy" ON usuarios FOR ALL
    USING (is_admin());

-- GRUPOS: Admin vê tudo
CREATE POLICY "grupos_select_policy" ON grupos FOR SELECT
    USING (is_admin() OR true);

CREATE POLICY "grupos_all_policy" ON grupos FOR ALL
    USING (is_admin());

-- EMPRESAS: Admin vê tudo, outros veem própria loja
CREATE POLICY "empresas_select_policy" ON empresas FOR SELECT
    USING (
        is_admin() OR
        id = user_loja_id() OR
        id IS NULL
    );

CREATE POLICY "empresas_all_policy" ON empresas FOR ALL
    USING (is_admin());

-- CATEGORIAS PRODUTOS: Todos veem, admin gerencia
CREATE POLICY "categorias_select_policy" ON categorias_produtos FOR SELECT
    USING (ativo = true OR is_admin());

CREATE POLICY "categorias_all_policy" ON categorias_produtos FOR ALL
    USING (is_admin());

-- PRODUTOS: Todos veem ativos, admin gerencia
CREATE POLICY "produtos_select_policy" ON produtos FOR SELECT
    USING (ativo = true OR is_admin());

CREATE POLICY "produtos_all_policy" ON produtos FOR ALL
    USING (is_admin());

-- LOJA_PRODUTOS: Usuários veem própria loja, admin vê tudo
CREATE POLICY "loja_produtos_select_policy" ON loja_produtos FOR SELECT
    USING (
        loja_id = user_loja_id() OR is_admin()
    );

CREATE POLICY "loja_produtos_all_policy" ON loja_produtos FOR ALL
    USING (
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        is_admin()
    );

-- TERMINAIS: Própria loja ou admin
CREATE POLICY "terminais_select_policy" ON terminais FOR SELECT
    USING (loja_id = user_loja_id() OR is_admin());

CREATE POLICY "terminais_all_policy" ON terminais FOR ALL
    USING (
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        is_admin()
    );

-- FINANCEIRO BANCOS: Todos veem
CREATE POLICY "financeiro_bancos_select_policy" ON financeiro_bancos FOR SELECT
    USING (true);

-- FINANCEIRO CONTAS BANCARIAS: Própria loja ou admin
CREATE POLICY "financeiro_contas_bancarias_select_policy" ON financeiro_contas_bancarias FOR SELECT
    USING (
        loja_id = user_loja_id() OR
        loja_id IS NULL OR
        is_admin()
    );

CREATE POLICY "financeiro_contas_bancarias_all_policy" ON financeiro_contas_bancarias FOR ALL
    USING (
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        loja_id IS NULL OR
        is_admin()
    );

-- FINANCEIRO ITENS PLANO: Própria loja ou admin
CREATE POLICY "financeiro_itens_plano_select_policy" ON financeiro_itens_plano FOR SELECT
    USING (loja_id = user_loja_id() OR is_admin());

CREATE POLICY "financeiro_itens_plano_insert_policy" ON financeiro_itens_plano FOR INSERT
    WITH CHECK (loja_id = user_loja_id() OR is_admin());

CREATE POLICY "financeiro_itens_plano_update_policy" ON financeiro_itens_plano FOR UPDATE
    USING (loja_id = user_loja_id() OR is_admin())
    WITH CHECK (loja_id = user_loja_id() OR is_admin());

-- FINANCEIRO CONTAS: Própria loja ou admin
CREATE POLICY "financeiro_contas_select_policy" ON financeiro_contas FOR SELECT
    USING (
        (loja_id = user_loja_id() OR loja_id IS NULL OR is_admin()) AND
        deleted_at IS NULL
    );

CREATE POLICY "financeiro_contas_insert_policy" ON financeiro_contas FOR INSERT
    WITH CHECK (loja_id = user_loja_id() OR loja_id IS NULL OR is_admin());

CREATE POLICY "financeiro_contas_update_policy" ON financeiro_contas FOR UPDATE
    USING (
        (loja_id = user_loja_id() OR loja_id IS NULL OR is_admin()) AND
        deleted_at IS NULL
    );

-- FINANCEIRO TRANSACOES BANCARIAS: Própria loja ou admin
CREATE POLICY "financeiro_transacoes_select_policy" ON financeiro_transacoes_bancarias FOR SELECT
    USING (loja_id = user_loja_id() OR loja_id IS NULL OR is_admin());

CREATE POLICY "financeiro_transacoes_all_policy" ON financeiro_transacoes_bancarias FOR ALL
    USING (
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        loja_id IS NULL OR
        is_admin()
    );

-- FINANCEIRO PARAMETROS: Todos veem
CREATE POLICY "financeiro_parametros_select_policy" ON financeiro_parametros FOR SELECT
    USING (true);

-- CAIXA SESSOES: Próprias sessões ou gerente/admin da loja
CREATE POLICY "caixa_sessoes_select_policy" ON caixa_sessoes FOR SELECT
    USING (
        operador_id = auth.uid() OR
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        is_admin()
    );

CREATE POLICY "caixa_sessoes_insert_policy" ON caixa_sessoes FOR INSERT
    WITH CHECK (
        operador_id = auth.uid() OR
        is_admin()
    );

CREATE POLICY "caixa_sessoes_update_policy" ON caixa_sessoes FOR UPDATE
    USING (
        operador_id = auth.uid() OR
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        is_admin()
    );

-- CAIXA MOVIMENTACOES: Via sessão ou admin
CREATE POLICY "caixa_movimentacoes_select_policy" ON caixa_movimentacoes FOR SELECT
    USING (
        deleted_at IS NULL AND (
            EXISTS (
                SELECT 1 FROM caixa_sessoes cs
                WHERE cs.id = caixa_movimentacoes.sessao_id
                AND (cs.operador_id = auth.uid() OR cs.loja_id = user_loja_id() OR is_admin())
            ) OR is_admin()
        )
    );

CREATE POLICY "caixa_movimentacoes_insert_policy" ON caixa_movimentacoes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM caixa_sessoes cs
            WHERE cs.id = sessao_id AND cs.operador_id = auth.uid()
        ) OR is_admin()
    );

-- COFRE MOVIMENTACOES: Própria loja ou admin
CREATE POLICY "cofre_movimentacoes_select_policy" ON cofre_movimentacoes FOR SELECT
    USING (
        (loja_id = user_loja_id() AND deleted_at IS NULL) OR
        is_admin()
    );

CREATE POLICY "cofre_movimentacoes_all_policy" ON cofre_movimentacoes FOR ALL
    USING (
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        is_admin()
    );

-- BOLOES: Própria loja ou admin
CREATE POLICY "boloes_select_policy" ON boloes FOR SELECT
    USING (loja_id = user_loja_id() OR is_admin());

CREATE POLICY "boloes_insert_policy" ON boloes FOR INSERT
    WITH CHECK (loja_id = user_loja_id() OR is_admin());

CREATE POLICY "boloes_update_policy" ON boloes FOR UPDATE
    USING (
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        is_admin()
    );

-- COTAS BOLOES: Via bolão ou admin
CREATE POLICY "cotas_boloes_select_policy" ON cotas_boloes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM boloes b
            WHERE b.id = cotas_boloes.bolao_id
            AND (b.loja_id = user_loja_id() OR is_admin())
        ) OR is_admin()
    );

CREATE POLICY "cotas_boloes_all_policy" ON cotas_boloes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM boloes b
            WHERE b.id = bolao_id
            AND (b.loja_id = user_loja_id() OR is_admin())
        ) OR is_admin()
    );

-- VENDAS BOLOES: Própria loja ou admin
CREATE POLICY "vendas_boloes_select_policy" ON vendas_boloes FOR SELECT
    USING (
        (loja_id = user_loja_id() OR usuario_id = auth.uid() OR is_admin()) AND
        deleted_at IS NULL
    );

CREATE POLICY "vendas_boloes_insert_policy" ON vendas_boloes FOR INSERT
    WITH CHECK (
        (usuario_id = auth.uid() AND (loja_id = user_loja_id() OR loja_id IS NULL)) OR
        is_admin()
    );

CREATE POLICY "vendas_boloes_update_policy" ON vendas_boloes FOR UPDATE
    USING (
        (loja_id = user_loja_id() AND is_gerente_or_admin() AND deleted_at IS NULL) OR
        is_admin()
    );

-- PRESTACOES CONTAS: Própria loja ou admin
CREATE POLICY "prestacoes_contas_select_policy" ON prestacoes_contas FOR SELECT
    USING (loja_id = user_loja_id() OR is_admin());

CREATE POLICY "prestacoes_contas_insert_policy" ON prestacoes_contas FOR INSERT
    WITH CHECK (
        (loja_id = user_loja_id() AND is_gerente_or_admin()) OR
        is_admin()
    );

-- AUDIT LOGS: Apenas admin
CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT
    USING (is_admin());

CREATE POLICY "audit_logs_insert_policy" ON audit_logs FOR INSERT
    WITH CHECK (true);

-- RATE LIMIT: Apenas admin vê
CREATE POLICY "rate_limit_select_policy" ON rate_limit_log FOR SELECT
    USING (is_admin());

-- STORAGE: Própria loja
CREATE POLICY "storage_insert_policy" ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'comprovantes' AND
        ((storage.foldername(name))[1] = user_loja_id()::text OR is_admin())
    );

CREATE POLICY "storage_select_policy" ON storage.objects FOR SELECT
    USING (
        bucket_id = 'comprovantes' AND
        ((storage.foldername(name))[1] = user_loja_id()::text OR is_admin())
    );

CREATE POLICY "storage_delete_policy" ON storage.objects FOR DELETE
    USING (
        bucket_id = 'comprovantes' AND
        ((storage.foldername(name))[1] = user_loja_id()::text OR is_admin())
    );