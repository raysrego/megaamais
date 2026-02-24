/*
  # Correção Crítica - RLS caixa_bolao_sessoes (TABELA SEM POLÍTICAS)

  1. Problema Identificado
    - RLS ativo (rowsecurity = true)
    - ZERO policies configuradas
    - Resultado: Erro 400 (Bad Request) em TODOS os selects
    
  2. Políticas Criadas
    - SELECT: Usuários autenticados veem suas sessões ou admin vê todas
    - INSERT: Usuários autenticados podem criar sessões
    - UPDATE: Apenas responsável ou admin pode atualizar
    - DELETE: Apenas admin pode deletar (soft delete preferencial)
    
  3. Segurança
    - Validação de loja_id quando aplicável
    - Admin tem acesso total
    - Operadores veem apenas suas sessões
*/

-- SELECT: Ver próprias sessões ou admin vê todas
CREATE POLICY "caixa_bolao_sessoes_select_policy"
  ON caixa_bolao_sessoes
  FOR SELECT
  TO authenticated
  USING (
    -- Admin vê todas
    is_admin() 
    OR 
    -- Operador vê apenas suas próprias sessões
    responsavel_id = auth.uid()
  );

-- INSERT: Criar novas sessões
CREATE POLICY "caixa_bolao_sessoes_insert_policy"
  ON caixa_bolao_sessoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Usuário autenticado pode criar sessão para si mesmo
    responsavel_id = auth.uid()
    OR
    -- Admin pode criar para qualquer um
    is_admin()
  );

-- UPDATE: Atualizar sessões
CREATE POLICY "caixa_bolao_sessoes_update_policy"
  ON caixa_bolao_sessoes
  FOR UPDATE
  TO authenticated
  USING (
    -- Pode ver se é dono ou admin
    responsavel_id = auth.uid() OR is_admin()
  )
  WITH CHECK (
    -- Pode atualizar se é dono ou admin
    responsavel_id = auth.uid() OR is_admin()
  );

-- DELETE: Apenas admin pode deletar fisicamente
CREATE POLICY "caixa_bolao_sessoes_delete_policy"
  ON caixa_bolao_sessoes
  FOR DELETE
  TO authenticated
  USING (
    -- Apenas admin pode deletar
    is_admin()
  );