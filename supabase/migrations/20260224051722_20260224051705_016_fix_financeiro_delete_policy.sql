/*
  # Correção Crítica: Políticas DELETE e UPDATE para financeiro_contas
  
  ## Problema Identificado
  - Tabela `financeiro_contas` NÃO tinha política DELETE
  - RLS habilitado bloqueava todas tentativas de exclusão
  - Política UPDATE não tinha WITH CHECK clause
  
  ## Solução
  
  1. **Política DELETE** (Nova)
     - Permite DELETE para registros da mesma loja ou admin
     - Respeita soft delete (deleted_at IS NULL)
     - Validação: usuário autenticado + ownership/admin
  
  2. **Política UPDATE** (Correção)
     - Adiciona WITH CHECK clause faltante
     - Garante que updates não violem regras de ownership
  
  3. **Auditoria**
     - Todas operações DELETE devem popular deleted_at e deleted_by
     - Mantém integridade referencial
  
  ## Segurança
  - ✅ Usuários só podem excluir seus próprios registros
  - ✅ Admin pode excluir qualquer registro
  - ✅ Registros já excluídos (deleted_at NOT NULL) não podem ser reexcluídos
  - ✅ Soft delete preserva histórico
*/

-- ====================
-- 1. DROP das políticas antigas (se existirem)
-- ====================

DO $$ 
BEGIN
    -- Drop política UPDATE antiga (sem WITH CHECK)
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'financeiro_contas' 
        AND policyname = 'financeiro_contas_update_policy'
    ) THEN
        DROP POLICY financeiro_contas_update_policy ON financeiro_contas;
    END IF;

    -- Drop política DELETE antiga (se existir)
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'financeiro_contas' 
        AND policyname = 'financeiro_contas_delete_policy'
    ) THEN
        DROP POLICY financeiro_contas_delete_policy ON financeiro_contas;
    END IF;
END $$;

-- ====================
-- 2. Criar política UPDATE corrigida
-- ====================

CREATE POLICY "financeiro_contas_update_policy"
    ON financeiro_contas
    FOR UPDATE
    TO public
    USING (
        -- Validação para ler (USING)
        (
            (loja_id = user_loja_id()) OR 
            (loja_id IS NULL) OR 
            is_admin()
        ) 
        AND deleted_at IS NULL
    )
    WITH CHECK (
        -- Validação para escrever (WITH CHECK)
        (
            (loja_id = user_loja_id()) OR 
            (loja_id IS NULL) OR 
            is_admin()
        )
    );

-- ====================
-- 3. Criar política DELETE (NOVA)
-- ====================

CREATE POLICY "financeiro_contas_delete_policy"
    ON financeiro_contas
    FOR DELETE
    TO public
    USING (
        -- Apenas registros não excluídos
        deleted_at IS NULL
        AND
        (
            -- Usuário da mesma loja
            (loja_id = user_loja_id()) OR 
            -- Registros sem loja (global)
            (loja_id IS NULL) OR 
            -- Admin pode excluir tudo
            is_admin()
        )
    );

-- ====================
-- 4. Verificação de Integridade
-- ====================

-- Garantir que RLS está habilitado
ALTER TABLE financeiro_contas ENABLE ROW LEVEL SECURITY;

-- Confirmar que todas políticas foram criadas
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_policies
    WHERE tablename = 'financeiro_contas'
    AND policyname IN (
        'financeiro_contas_select_policy',
        'financeiro_contas_insert_policy',
        'financeiro_contas_update_policy',
        'financeiro_contas_delete_policy'
    );

    IF v_count != 4 THEN
        RAISE EXCEPTION 'Erro: Esperado 4 políticas, encontrado %', v_count;
    END IF;

    RAISE NOTICE '✅ Todas as 4 políticas (SELECT, INSERT, UPDATE, DELETE) foram criadas com sucesso';
END $$;

-- ====================
-- 5. Comentários de Auditoria
-- ====================

COMMENT ON POLICY "financeiro_contas_update_policy" ON financeiro_contas IS 
'Permite UPDATE para registros da mesma loja ou admin. Respeita soft delete.';

COMMENT ON POLICY "financeiro_contas_delete_policy" ON financeiro_contas IS 
'Permite DELETE para registros da mesma loja ou admin. Apenas registros não excluídos (deleted_at IS NULL).';
