-- ==========================================
-- MEGA B - EXTENSÃO FECHAMENTO TFL
-- Versão: 1.1 (2026-02-02)
-- Objetivo: Campos para espelhamento simplificado do TFL.
-- ==========================================

ALTER TABLE public.caixa_sessoes 
ADD COLUMN IF NOT EXISTS tfl_vendas NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tfl_premios NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tfl_contas NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tfl_saldo_projetado NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tfl_comprovante_url TEXT;

COMMENT ON COLUMN public.caixa_sessoes.tfl_vendas IS 'Total de vendas bruto no TFL';
COMMENT ON COLUMN public.caixa_sessoes.tfl_premios IS 'Total de prêmios pagos no TFL';
COMMENT ON COLUMN public.caixa_sessoes.tfl_contas IS 'Total de recebimento de contas no TFL';
COMMENT ON COLUMN public.caixa_sessoes.tfl_saldo_projetado IS 'Saldo final indicado pelo relatório TFL';
