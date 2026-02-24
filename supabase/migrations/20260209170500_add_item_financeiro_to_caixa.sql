-- ==========================================
-- MIGRATION: 20260209170500_add_item_financeiro_to_caixa.sql
-- Objetivo: Vincular movimentações de caixa (sangrias/despesas) a categorias financeiras
-- ==========================================

ALTER TABLE caixa_movimentacoes
ADD COLUMN IF NOT EXISTS item_financeiro_id INTEGER REFERENCES financeiro_itens_plano(id);

CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_item ON caixa_movimentacoes(item_financeiro_id);

COMMENT ON COLUMN caixa_movimentacoes.item_financeiro_id IS 'Referência ao item do plano de contas (categoria da despesa/receita)';
