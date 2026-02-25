/*
  # Ajustar Políticas RLS de Caixa Movimentações

  ## Alterações
    - Permite que admin possa editar qualquer movimentação
    - Permite que o usuário que criou a movimentação possa editar
    - Permite que admin possa deletar qualquer movimentação  
    - Permite que o usuário que criou a movimentação possa deletar
    - Adiciona verificação de soft delete (deleted_at IS NULL)

  ## Segurança
    - Mantém isolamento por sessão de caixa
    - Garante que apenas proprietários ou admins podem modificar
*/

-- ==========================================
-- 1. REMOVER POLÍTICAS ANTIGAS
-- ==========================================

DROP POLICY IF EXISTS "Operadores podem editar movimentacoes" ON caixa_movimentacoes;
DROP POLICY IF EXISTS "Operadores podem deletar movimentacoes" ON caixa_movimentacoes;

-- ==========================================
-- 2. CRIAR NOVAS POLÍTICAS DE UPDATE
-- ==========================================

CREATE POLICY "Usuario pode editar propria movimentacao ou admin pode editar qualquer"
  ON caixa_movimentacoes
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      -- Admin pode editar qualquer movimentação da mesma empresa
      EXISTS (
        SELECT 1 FROM usuarios u
        INNER JOIN caixa_sessoes cs ON cs.id = caixa_movimentacoes.sessao_id
        WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.empresa_id = cs.loja_id
      )
      OR
      -- Usuário pode editar a própria movimentação
      created_by = auth.uid()
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM usuarios u
        INNER JOIN caixa_sessoes cs ON cs.id = caixa_movimentacoes.sessao_id
        WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.empresa_id = cs.loja_id
      )
      OR
      created_by = auth.uid()
    )
  );

-- ==========================================
-- 3. CRIAR NOVAS POLÍTICAS DE DELETE
-- ==========================================

CREATE POLICY "Usuario pode deletar propria movimentacao ou admin pode deletar qualquer"
  ON caixa_movimentacoes
  FOR DELETE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      -- Admin pode deletar qualquer movimentação da mesma empresa
      EXISTS (
        SELECT 1 FROM usuarios u
        INNER JOIN caixa_sessoes cs ON cs.id = caixa_movimentacoes.sessao_id
        WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.empresa_id = cs.loja_id
      )
      OR
      -- Usuário pode deletar a própria movimentação
      created_by = auth.uid()
    )
  );

-- ==========================================
-- 4. ATUALIZAR POLÍTICA DE SELECT PARA SOFT DELETE
-- ==========================================

DROP POLICY IF EXISTS "Operadores podem ler suas movimentacoes" ON caixa_movimentacoes;

CREATE POLICY "Usuarios podem visualizar movimentacoes da empresa nao deletadas"
  ON caixa_movimentacoes
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM caixa_sessoes cs
      INNER JOIN usuarios u ON u.id = auth.uid()
      WHERE cs.id = caixa_movimentacoes.sessao_id
      AND u.empresa_id = cs.loja_id
    )
  );
