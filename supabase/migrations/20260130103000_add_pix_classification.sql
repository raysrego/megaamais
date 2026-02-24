-- Migration: Add Pix Classification
-- Description: Adiciona coluna para armazenar a classificação bancária do Pix para conciliação.

ALTER TABLE caixa_movimentacoes 
ADD COLUMN IF NOT EXISTS classificacao_pix TEXT;

COMMENT ON COLUMN caixa_movimentacoes.classificacao_pix IS 'Classificação bancária do Pix (CRED PIX QR COD EST, PIX RECEBIDO, etc.) para conciliação.';
