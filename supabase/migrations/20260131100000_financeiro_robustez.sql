-- Migration: Robustez Financeira (MegaB)
-- Description: Implementa suporte a múltiplos métodos de pagamento, comprovantes, plano de contas e metas.

-- 1. Enum para Método de Pagamento e Bancos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_metodo_pagamento') THEN
        CREATE TYPE fin_metodo_pagamento AS ENUM ('pix', 'dinheiro', 'boleto', 'cartao', 'outros');
    END IF;
END $$;

-- 2. Ajustes na tabela principal
ALTER TABLE financeiro_contas 
ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id),
ADD COLUMN IF NOT EXISTS metodo_pagamento fin_metodo_pagamento DEFAULT 'dinheiro',
ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
ADD COLUMN IF NOT EXISTS valor_realizado DECIMAL(10, 2) DEFAULT 0;

-- 3. Tabela de Contas Bancárias / Caixas
CREATE TABLE IF NOT EXISTS financeiro_contas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL, -- Ex: 'Cofre Central', 'Banco do Brasil', 'Caixa Econômica'
    tipo TEXT NOT NULL, -- 'banco', 'caixa_fisico', 'digital'
    saldo_inicial DECIMAL(10, 2) DEFAULT 0,
    saldo_atual DECIMAL(10, 2) DEFAULT 0,
    loja_id UUID REFERENCES lojas(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Plano de Contas (Categorias Estruturadas)
CREATE TABLE IF NOT EXISTS financeiro_categorias_plano (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo fin_tipo_transacao NOT NULL,
    fixo BOOLEAN DEFAULT FALSE, -- Se é custo fixo ou variável
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Metas de Operadores (Loteria)
CREATE TABLE IF NOT EXISTS financeiro_metas_operadores (
    id SERIAL PRIMARY KEY,
    loja_id UUID REFERENCES lojas(id),
    valor_venda_alvo DECIMAL(10, 2) NOT NULL, -- Ex: 10000.00
    premio_bonus DECIMAL(10, 2) NOT NULL,    -- Ex: 600.00
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Seed de Categorias Iniciais (Baseado na Planilha do Cliente)
INSERT INTO financeiro_categorias_plano (nome, tipo, fixo, ordem) VALUES
('Ágio Bolão (35%)', 'receita', FALSE, 1),
('Jogos (8,61%)', 'receita', FALSE, 2),
('Comissões Diversas', 'receita', FALSE, 3),
('Aluguel', 'despesa', TRUE, 4),
('Contador', 'despesa', TRUE, 5),
('Internet', 'despesa', TRUE, 6),
('Energia/Luz', 'despesa', TRUE, 7),
('Salários Equipe', 'despesa', TRUE, 8),
('Material Escritório', 'despesa', FALSE, 9),
('Manutenção Loja', 'despesa', FALSE, 10);

-- 7. Seed de Metas Iniciais (Conforme ROTEIRO_ENTREVISTA.md)
INSERT INTO financeiro_metas_operadores (valor_venda_alvo, premio_bonus, descricao) VALUES
(10000.00, 600.00, 'Meta Nível 1'),
(20000.00, 700.00, 'Meta Nível 2'),
(25000.00, 800.00, 'Meta Nível 3'),
(30000.00, 1000.00, 'Meta Nível Master');

-- 8. Ativar RLS
ALTER TABLE financeiro_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_categorias_plano ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_metas_operadores ENABLE ROW LEVEL SECURITY;

-- Políticas Simples (Acesso total para autenticados por enquanto)
CREATE POLICY "Acesso total contas_bancarias" ON financeiro_contas_bancarias FOR ALL USING (true);
CREATE POLICY "Acesso total categorias_plano" ON financeiro_categorias_plano FOR ALL USING (true);
CREATE POLICY "Acesso total metas_operadores" ON financeiro_metas_operadores FOR ALL USING (true);
