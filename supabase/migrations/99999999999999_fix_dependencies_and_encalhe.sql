-- SCRIPT CONSOLIDADO: Robustez Financeira + Motor de Encalhe
-- Use este script para garantir que todas as estruturas existam.

-- 1. Enums necessários
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_metodo_pagamento') THEN
        CREATE TYPE fin_metodo_pagamento AS ENUM ('pix', 'dinheiro', 'boleto', 'cartao', 'outros');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_tipo_transacao') THEN
        CREATE TYPE fin_tipo_transacao AS ENUM ('receita', 'despesa');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_status_conta') THEN
        CREATE TYPE fin_status_conta AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'bolao_status' AND e.enumlabel = 'sorteio_realizado') THEN
        ALTER TYPE bolao_status ADD VALUE 'sorteio_realizado';
    END IF;
END $$;

-- 2. Tabela de Categorias (Plano de Contas) - O QUE ESTAVA FALTANDO
CREATE TABLE IF NOT EXISTS financeiro_categorias_plano (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo fin_tipo_transacao NOT NULL,
    fixo BOOLEAN DEFAULT FALSE,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Seed de Categorias Iniciais
INSERT INTO financeiro_categorias_plano (nome, tipo, fixo, ordem)
SELECT name, type, is_fixed, ord FROM (
    VALUES 
        ('Ágio Bolão (35%)', 'receita'::fin_tipo_transacao, FALSE, 1),
        ('Jogos (8,61%)', 'receita'::fin_tipo_transacao, FALSE, 2),
        ('Encalhe de Jogos', 'despesa'::fin_tipo_transacao, FALSE, 20),
        ('Aluguel', 'despesa'::fin_tipo_transacao, TRUE, 4),
        ('Contador', 'despesa'::fin_tipo_transacao, TRUE, 5),
        ('Internet', 'despesa'::fin_tipo_transacao, TRUE, 6)
) AS t(name, type, is_fixed, ord)
WHERE NOT EXISTS (SELECT 1 FROM financeiro_categorias_plano WHERE nome = t.name);

-- 4. Ajustes na tabela de Contas
ALTER TABLE financeiro_contas 
ADD COLUMN IF NOT EXISTS loja_id UUID,
ADD COLUMN IF NOT EXISTS metodo_pagamento fin_metodo_pagamento DEFAULT 'dinheiro',
ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
ADD COLUMN IF NOT EXISTS valor_realizado DECIMAL(10, 2) DEFAULT 0;

-- 5. Outras tabelas de suporte
CREATE TABLE IF NOT EXISTS financeiro_contas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    saldo_inicial DECIMAL(10, 2) DEFAULT 0,
    saldo_atual DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Documentação de status de cota
COMMENT ON COLUMN cotas_boloes.status IS 'Status da cota: disponivel, vendida, encalhe_casa';

-- 7. Função do Motor de Encalhe
CREATE OR REPLACE FUNCTION get_boloes_vencidos()
RETURNS SETOF boloes AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM boloes 
    WHERE status = 'disponivel' 
    AND data_sorteio < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
