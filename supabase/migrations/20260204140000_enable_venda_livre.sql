-- Migration: Enable Venda Livre
-- Description: Remove a obrigatoriedade de sessão de caixa para vendas e adiciona controle de prestação de contas.

BEGIN;

-- 1. Tornar sessao_caixa_id opcional
ALTER TABLE vendas_boloes 
ALTER COLUMN sessao_caixa_id DROP NOT NULL;

-- 2. Criar Enum para status de prestação se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_prestacao_venda') THEN
        CREATE TYPE status_prestacao_venda AS ENUM ('pendente', 'concluido', 'parcial');
    END IF;
END $$;

-- 3. Adicionar colunas de controle de prestação
ALTER TABLE vendas_boloes
ADD COLUMN IF NOT EXISTS status_prestacao status_prestacao_venda DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS prestacao_id BIGINT; -- FK para a tabela futura de prestações

-- 4. Índice para buscar vendas pendentes por operador
CREATE INDEX IF NOT EXISTS idx_vendas_pendentes_operador 
ON vendas_boloes(usuario_id, status_prestacao) 
WHERE status_prestacao = 'pendente';

COMMIT;
