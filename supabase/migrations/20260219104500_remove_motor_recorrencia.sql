-- ==========================================
-- MIGRATION: 20260219104500_remove_motor_recorrencia.sql
-- v2.5.22 - Eliminação do Motor de Recorrência Automática
-- ==========================================
-- Motivo: Motor gera registros fantasma duplicados porque o partial index
-- não cobre registros pagos. Transição para modelo "Excel Turbo" (manual).
-- ==========================================

-- 1. DROPAR TRIGGER (auto-gera recorrências ao alterar categoria)
DROP TRIGGER IF EXISTS auto_gerar_recorrencias_trigger ON financeiro_itens_plano;

-- 2. DROPAR FUNÇÕES DO MOTOR
DROP FUNCTION IF EXISTS trg_auto_gerar_recorrencias_fixa();
DROP FUNCTION IF EXISTS processar_recorrencias_financeiras();

-- 3. DROPAR PARTIAL INDEX PROBLEMÁTICO
DROP INDEX IF EXISTS idx_financeiro_contas_sync_unique;

-- 4. LIMPEZA: Remover registros PENDENTES duplicados de Janeiro/2026
-- (Manter apenas os pagos que o usuário já confirmou manualmente)
-- Identifica como duplicado: mesmo item_financeiro_id + mesmo mês + recorrente=TRUE + pendente
-- quando já existe um registro PAGO para o mesmo item no mesmo mês
DELETE FROM financeiro_contas fc_pendente
WHERE fc_pendente.status = 'pendente'
  AND fc_pendente.recorrente = TRUE
  AND EXISTS (
      SELECT 1 FROM financeiro_contas fc_pago
      WHERE fc_pago.item_financeiro_id = fc_pendente.item_financeiro_id
        AND fc_pago.item_financeiro_id IS NOT NULL
        AND EXTRACT(MONTH FROM fc_pago.data_vencimento) = EXTRACT(MONTH FROM fc_pendente.data_vencimento)
        AND EXTRACT(YEAR FROM fc_pago.data_vencimento) = EXTRACT(YEAR FROM fc_pendente.data_vencimento)
        AND fc_pago.status = 'pago'
        AND fc_pago.id != fc_pendente.id
  );

-- Também limpar por nome (fallback para legado sem item_financeiro_id)
DELETE FROM financeiro_contas fc_pendente
WHERE fc_pendente.status = 'pendente'
  AND fc_pendente.recorrente = TRUE
  AND fc_pendente.item_financeiro_id IS NULL
  AND EXISTS (
      SELECT 1 FROM financeiro_contas fc_pago
      WHERE fc_pago.item = fc_pendente.item
        AND EXTRACT(MONTH FROM fc_pago.data_vencimento) = EXTRACT(MONTH FROM fc_pendente.data_vencimento)
        AND EXTRACT(YEAR FROM fc_pago.data_vencimento) = EXTRACT(YEAR FROM fc_pendente.data_vencimento)
        AND fc_pago.status = 'pago'
        AND fc_pago.id != fc_pendente.id
  );

-- 5. DOCUMENTAÇÃO
DO $$
DECLARE
    v_deleted INTEGER;
BEGIN
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Motor de recorrência removido. % registros fantasma limpos.', v_deleted;
END $$;

COMMENT ON TABLE financeiro_itens_plano IS
'Catálogo de categorias financeiras (Plano de Contas). 
v2.5.22: Motor de recorrência desativado. Categorias servem apenas como lista de sugestões 
para auto-preenchimento no lançamento manual. Botão "Replicar Mês" é o método principal 
para copiar despesas entre meses.';

NOTIFY pgrst, 'reload config';
