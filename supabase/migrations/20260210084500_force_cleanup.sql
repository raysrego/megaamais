-- ==========================================
-- MIGRATION: 20260210084500_force_cleanup.sql
-- Objetivo: Forçar limpeza de dados legados por MATCH DE NOME
-- MOTIVO: Itens antigos não têm 'item_financeiro_id' vinculado, então a deleção anterior falhou.
-- ==========================================

-- 1. Limpeza por NOME (Fallback para Legado)
DELETE FROM financeiro_contas fc
WHERE fc.status = 'pendente'
  AND fc.data_vencimento >= CURRENT_DATE
  AND fc.recorrente = TRUE
  AND (
      -- Tenta achar o item pelo nome na tabela de plano
      EXISTS (
          SELECT 1 FROM financeiro_itens_plano fip
          WHERE fip.item = fc.item -- Match exato de string
            AND (fip.tipo_recorrencia = 'VARIAVEL' OR fip.tipo_recorrencia = 'NENHUMA')
      )
  );

-- 2. Garantir que item_financeiro_id seja populado em TUDO (Auto-Healing)
UPDATE financeiro_contas fc
SET item_financeiro_id = fip.id
FROM financeiro_itens_plano fip
WHERE fc.item = fip.item
  AND fc.item_financeiro_id IS NULL;

-- 3. Trigger reload
NOTIFY pgrst, 'reload config';
