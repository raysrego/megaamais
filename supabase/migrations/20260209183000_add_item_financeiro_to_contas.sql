-- ==========================================
-- MIGRATION: 20260209183000_add_item_financeiro_to_contas.sql
-- Objetivo: Vincular lançamentos financeiros (contas) a categorias financeiras (itens do plano)
-- ==========================================

ALTER TABLE financeiro_contas
ADD COLUMN IF NOT EXISTS item_financeiro_id INTEGER REFERENCES financeiro_itens_plano(id);

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_item_financeiro ON financeiro_contas(item_financeiro_id);

COMMENT ON COLUMN financeiro_contas.item_financeiro_id IS 'Referência estruturada à categoria financeira (fk para financeiro_itens_plano)';
