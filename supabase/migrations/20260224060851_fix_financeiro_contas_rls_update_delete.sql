/*
  # Correção Crítica - RLS financeiro_contas (UPDATE e DELETE)

  1. Problema Identificado
    - UPDATE policy impede soft delete (deleted_at = now())
    - DELETE policy válida, mas precisa permitir soft delete também
    
  2. Alterações
    - UPDATE policy: Remover restrição deleted_at do WITH CHECK
    - Permite marcar registro como deletado
    
  3. Segurança
    - Mantém validação de loja_id
    - Apenas admin ou loja owner pode atualizar
*/

-- Drop e recriar UPDATE policy
DROP POLICY IF EXISTS "financeiro_contas_update_policy" ON financeiro_contas;

CREATE POLICY "financeiro_contas_update_policy"
  ON financeiro_contas
  FOR UPDATE
  TO authenticated
  USING (
    -- Pode ver se não foi deletado E (é da loja OU é admin OU é global)
    deleted_at IS NULL 
    AND (
      loja_id = user_loja_id() 
      OR loja_id IS NULL 
      OR is_admin()
    )
  )
  WITH CHECK (
    -- Pode atualizar se é da loja OU é admin OU é global
    -- REMOVIDO: deleted_at IS NULL (permite soft delete)
    loja_id = user_loja_id() 
    OR loja_id IS NULL 
    OR is_admin()
  );

-- Garantir que DELETE policy permite soft delete
DROP POLICY IF EXISTS "financeiro_contas_delete_policy" ON financeiro_contas;

CREATE POLICY "financeiro_contas_delete_policy"
  ON financeiro_contas
  FOR DELETE
  TO authenticated
  USING (
    -- Pode deletar se não foi deletado ainda E (é da loja OU é admin OU é global)
    deleted_at IS NULL 
    AND (
      loja_id = user_loja_id() 
      OR loja_id IS NULL 
      OR is_admin()
    )
  );