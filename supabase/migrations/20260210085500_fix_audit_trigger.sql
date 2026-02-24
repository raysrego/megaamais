-- ==========================================
-- MIGRATION: 20260210085500_fix_audit_trigger.sql
-- Objetivo: Adicionar coluna updated_at faltante em tabelas auditadas
-- Motivo: Trigger set_audit_fields tenta atualizar updated_at, mas colunas não foram criadas na auditoria anterior.
-- ==========================================

-- 1. Financeiro Contas
ALTER TABLE financeiro_contas 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Cofre Movimentações
ALTER TABLE cofre_movimentacoes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Vendas Bolões
ALTER TABLE vendas_boloes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Caixa Movimentações
ALTER TABLE caixa_movimentacoes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Reaplicar a trigger de limpeza (Force Cleanup) que falhou
-- Como a migration anterior falhou no meio, é seguro rodar o comando de limpeza novamente aqui.

-- Limpeza por NOME (Fallback para Legado)
DELETE FROM financeiro_contas fc
WHERE fc.status = 'pendente'
  AND fc.data_vencimento >= CURRENT_DATE
  AND fc.recorrente = TRUE
  AND (
      EXISTS (
          SELECT 1 FROM financeiro_itens_plano fip
          WHERE fip.item = fc.item
            AND (fip.tipo_recorrencia = 'VARIAVEL' OR fip.tipo_recorrencia = 'NENHUMA')
      )
  );

-- Auto-Healing de IDs
UPDATE financeiro_contas fc
SET item_financeiro_id = fip.id
FROM financeiro_itens_plano fip
WHERE fc.item = fip.item
  AND fc.item_financeiro_id IS NULL;

-- Trigger reload
NOTIFY pgrst, 'reload config';
