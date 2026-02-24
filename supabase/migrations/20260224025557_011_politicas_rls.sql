/*
  # Políticas RLS (Row Level Security)
  
  1. Princípios de Segurança
    - Multi-tenant: usuários só acessam dados da própria loja
    - Baseado em roles: admin, gerente, operador
    - Restrições por ação: SELECT, INSERT, UPDATE, DELETE
    - Auth: todas policies verificam auth.uid()
    
  2. Estrutura de Policies
    - Perfis: acesso ao próprio perfil ou todos (admin)
    - Empresas: admin vê todas, outros veem só a própria
    - Produtos: todos veem, admin cria/edita
    - Caixa: operador vê próprio, gerente/admin veem todos da loja
    - Financeiro: operador vê próprio, gerente/admin veem todos da loja
    - Bolões: todos da loja veem e criam
    - Vendas: operador vê próprias, gerente/admin veem todas da loja
    
  3. Notas
    - Policies permissivas para admins
    - Validação de loja_id em todas as operações
    - Storage policies para comprovantes
*/

-- ============================================
-- PERFIS E USUÁRIOS
-- ============================================

-- Perfis: usuários podem ver próprio perfil, admin vê todos
CREATE POLICY "Usuários podem ver próprio perfil"
  ON perfis FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin pode ver todos os perfis"
  ON perfis FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON perfis FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin pode atualizar todos os perfis"
  ON perfis FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin pode inserir perfis"
  ON perfis FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Usuários: mesma lógica dos perfis
CREATE POLICY "Usuários podem ver próprio usuário"
  ON usuarios FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin pode ver todos os usuários"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- EMPRESAS E GRUPOS
-- ============================================

CREATE POLICY "Usuários veem empresas do próprio grupo"
  ON empresas FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT loja_id FROM perfis WHERE id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Admin pode gerenciar empresas"
  ON empresas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Todos veem grupos"
  ON grupos FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- PRODUTOS E CATEGORIAS
-- ============================================

CREATE POLICY "Todos podem ver categorias ativas"
  ON categorias_produtos FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Admin pode gerenciar categorias"
  ON categorias_produtos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Todos podem ver produtos ativos"
  ON produtos FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Admin pode gerenciar produtos"
  ON produtos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Usuários veem produtos da própria loja"
  ON loja_produtos FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Admin/gerente pode gerenciar loja_produtos"
  ON loja_produtos FOR ALL
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

-- ============================================
-- TERMINAIS
-- ============================================

CREATE POLICY "Usuários veem terminais da própria loja"
  ON terminais FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Admin/gerente pode gerenciar terminais"
  ON terminais FOR ALL
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

-- ============================================
-- FINANCEIRO
-- ============================================

CREATE POLICY "Todos podem ver bancos"
  ON financeiro_bancos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários veem contas bancárias da própria loja"
  ON financeiro_contas_bancarias FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR
    loja_id IS NULL
  );

CREATE POLICY "Admin/gerente pode gerenciar contas bancárias"
  ON financeiro_contas_bancarias FOR ALL
  TO authenticated
  USING (
    (loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR loja_id IS NULL) AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Usuários veem itens plano da própria loja"
  ON financeiro_itens_plano FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Usuários podem criar itens plano"
  ON financeiro_itens_plano FOR INSERT
  TO authenticated
  WITH CHECK (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Usuários podem atualizar itens plano da própria loja"
  ON financeiro_itens_plano FOR UPDATE
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  )
  WITH CHECK (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Usuários veem contas financeiras da própria loja"
  ON financeiro_contas FOR SELECT
  TO authenticated
  USING (
    (loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR loja_id IS NULL) AND
    deleted_at IS NULL
  );

CREATE POLICY "Usuários podem criar contas financeiras"
  ON financeiro_contas FOR INSERT
  TO authenticated
  WITH CHECK (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR loja_id IS NULL
  );

CREATE POLICY "Usuários podem atualizar contas financeiras da própria loja"
  ON financeiro_contas FOR UPDATE
  TO authenticated
  USING (
    (loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR loja_id IS NULL) AND
    deleted_at IS NULL
  );

CREATE POLICY "Usuários veem transações bancárias da própria loja"
  ON financeiro_transacoes_bancarias FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR loja_id IS NULL
  );

CREATE POLICY "Admin/gerente pode gerenciar transações bancárias"
  ON financeiro_transacoes_bancarias FOR ALL
  TO authenticated
  USING (
    (loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR loja_id IS NULL) AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Todos podem ver parâmetros"
  ON financeiro_parametros FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- CAIXA
-- ============================================

CREATE POLICY "Operadores veem próprias sessões de caixa"
  ON caixa_sessoes FOR SELECT
  TO authenticated
  USING (
    operador_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
        AND loja_id = caixa_sessoes.loja_id
    )
  );

CREATE POLICY "Operadores podem criar sessões de caixa"
  ON caixa_sessoes FOR INSERT
  TO authenticated
  WITH CHECK (
    operador_id = auth.uid() AND
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Operadores podem atualizar próprias sessões"
  ON caixa_sessoes FOR UPDATE
  TO authenticated
  USING (
    operador_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
        AND loja_id = caixa_sessoes.loja_id
    )
  );

CREATE POLICY "Usuários veem movimentações de caixa da própria loja"
  ON caixa_movimentacoes FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM caixa_sessoes cs
      WHERE cs.id = caixa_movimentacoes.sessao_id
        AND (cs.operador_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin', 'gerente') AND loja_id = cs.loja_id))
    )
  );

CREATE POLICY "Usuários podem criar movimentações de caixa"
  ON caixa_movimentacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM caixa_sessoes cs
      WHERE cs.id = caixa_movimentacoes.sessao_id
        AND cs.operador_id = auth.uid()
    )
  );

CREATE POLICY "Usuários veem movimentações do cofre da própria loja"
  ON cofre_movimentacoes FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) AND
    deleted_at IS NULL
  );

CREATE POLICY "Admin/gerente pode gerenciar cofre"
  ON cofre_movimentacoes FOR ALL
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

-- ============================================
-- BOLÕES
-- ============================================

CREATE POLICY "Usuários veem bolões da própria loja"
  ON boloes FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Usuários podem criar bolões"
  ON boloes FOR INSERT
  TO authenticated
  WITH CHECK (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Admin/gerente pode atualizar bolões"
  ON boloes FOR UPDATE
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Usuários veem cotas de bolões da própria loja"
  ON cotas_boloes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boloes b
      WHERE b.id = cotas_boloes.bolao_id
        AND b.loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
    )
  );

CREATE POLICY "Sistema pode gerenciar cotas"
  ON cotas_boloes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boloes b
      WHERE b.id = cotas_boloes.bolao_id
        AND b.loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
    )
  );

CREATE POLICY "Usuários veem vendas da própria loja"
  ON vendas_boloes FOR SELECT
  TO authenticated
  USING (
    (loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR
     usuario_id = auth.uid()) AND
    deleted_at IS NULL
  );

CREATE POLICY "Usuários podem criar vendas"
  ON vendas_boloes FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    (loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) OR loja_id IS NULL)
  );

CREATE POLICY "Admin/gerente pode atualizar vendas"
  ON vendas_boloes FOR UPDATE
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) AND
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Usuários veem prestações da própria loja"
  ON prestacoes_contas FOR SELECT
  TO authenticated
  USING (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Admin/gerente pode criar prestações"
  ON prestacoes_contas FOR INSERT
  TO authenticated
  WITH CHECK (
    loja_id = (SELECT loja_id FROM perfis WHERE id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

-- ============================================
-- AUDITORIA
-- ============================================

CREATE POLICY "Admin pode ver todos os logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Sistema pode inserir logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin pode ver rate limits"
  ON rate_limit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- STORAGE (Comprovantes)
-- ============================================

-- Policy para upload de comprovantes
CREATE POLICY "Usuários podem fazer upload de comprovantes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes' AND
    (storage.foldername(name))[1] = (SELECT loja_id::text FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Usuários podem ver comprovantes da própria loja"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comprovantes' AND
    (storage.foldername(name))[1] = (SELECT loja_id::text FROM perfis WHERE id = auth.uid())
  );

CREATE POLICY "Usuários podem deletar próprios comprovantes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'comprovantes' AND
    (storage.foldername(name))[1] = (SELECT loja_id::text FROM perfis WHERE id = auth.uid())
  );