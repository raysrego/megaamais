-- ==========================================
-- MIGRATION: 20260210120000_fix_delete_categories_v2_5_14.sql
-- v2.5.14 - Correção: Permitir exclusão de categorias
-- ==========================================
-- Problema: RLS ou FK bloqueiam DELETE de financeiro_itens_plano
-- Solução: Adicionar GRANT e ajustar FK para SET NULL em cascata
-- ==========================================

-- 1. GARANTIR PERMISSÃO DE DELETE (Caso esteja faltando)
GRANT DELETE ON financeiro_itens_plano TO authenticated;

-- 2. RECRIAR FK COM CASCATA SET NULL (Preserva histórico ao deletar categoria)
ALTER TABLE financeiro_contas 
DROP CONSTRAINT IF EXISTS financeiro_contas_item_financeiro_id_fkey;

ALTER TABLE financeiro_contas
ADD CONSTRAINT financeiro_contas_item_financeiro_id_fkey
FOREIGN KEY (item_financeiro_id) 
REFERENCES financeiro_itens_plano(id)
ON DELETE SET NULL;  -- ← Ao deletar categoria, movimentações ficam órfãs (mas preservadas)

-- 3. DOCUMENTAÇÃO
COMMENT ON CONSTRAINT financeiro_contas_item_financeiro_id_fkey 
ON financeiro_contas IS 
'FK opcional para classificação estruturada. ON DELETE SET NULL preserva histórico financeiro mesmo se a categoria for removida do plano de contas.';

-- 4. ADICIONAR COLUNA AUXILIAR PARA SOFT DELETE (Opcional mas Recomendado)
ALTER TABLE financeiro_itens_plano 
ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_itens_plano_arquivado 
ON financeiro_itens_plano(arquivado) 
WHERE arquivado = FALSE;

COMMENT ON COLUMN financeiro_itens_plano.arquivado IS 
'Soft delete: TRUE = categoria arquivada (não aparece no UI, mas preserva histórico). Preferível a DELETE físico.';

-- 5. LOG
DO $$
BEGIN
    RAISE NOTICE 'v2.5.14: Permissões de DELETE corrigidas. FK ajustada para SET NULL.';
END $$;
