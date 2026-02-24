-- Migration: Add Origin Link to Financeiro
-- Description: Adiciona colunas para vincular lançamentos a entidades de origem (ex: Cotas de Encalhe)

BEGIN;

ALTER TABLE financeiro_contas
ADD COLUMN IF NOT EXISTS origem_tipo TEXT, -- 'cota_encalhe', 'venda', etc
ADD COLUMN IF NOT EXISTS origem_id BIGINT; -- ID da entidade de origem

-- Índice para buscas reversas (ex: achar o lançamento financeiro de uma cota)
CREATE INDEX IF NOT EXISTS idx_financeiro_origem 
ON financeiro_contas(origem_tipo, origem_id);

COMMIT;
