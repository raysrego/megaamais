-- Migration: Fix caixa enums and types
-- Description: Expandindo os tipos de movimentação e garantindo compatibilidade com o frontend.

-- Adicionar novos valores ao enum movimentacao_tipo
-- Nota: ALTER TYPE ... ADD VALUE não pode ser executado dentro de uma transação DO $$ em algumas versões.
-- Vamos rodar comandos diretos.

ALTER TYPE movimentacao_tipo ADD VALUE IF NOT EXISTS 'pix';
ALTER TYPE movimentacao_tipo ADD VALUE IF NOT EXISTS 'trocados';
ALTER TYPE movimentacao_tipo ADD VALUE IF NOT EXISTS 'deposito';
ALTER TYPE movimentacao_tipo ADD VALUE IF NOT EXISTS 'boleto';

-- Garantir que a tabela de sessões tenha o valor_final_calculado inicializado corretamente
UPDATE caixa_sessoes SET valor_final_calculado = valor_inicial WHERE valor_final_calculado IS NULL;
