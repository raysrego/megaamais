-- Migration: Create financeiro tables
-- Description: Gestão de Contas a Pagar e Receber

-- Enum para tipo de transação
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_tipo_transacao') THEN
        CREATE TYPE fin_tipo_transacao AS ENUM ('receita', 'despesa');
    END IF;
END $$;

-- Enum para status da conta
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_status_conta') THEN
        CREATE TYPE fin_status_conta AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
    END IF;
END $$;

-- Tabela de Contas (Receitas e Despesas)
CREATE TABLE IF NOT EXISTS financeiro_contas (
    id BIGSERIAL PRIMARY KEY,
    tipo fin_tipo_transacao NOT NULL,
    descricao TEXT NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    categoria TEXT NOT NULL, -- Ex: 'Aluguel', 'Vendas', 'Impostos'
    
    -- Datas
    data_vencimento DATE NOT NULL,
    data_pagamento DATE, -- NULL se não pago
    
    status fin_status_conta DEFAULT 'pendente',
    
    -- Recorrência (Simples)
    recorrente BOOLEAN DEFAULT FALSE,
    frequencia TEXT, -- 'mensal', 'semanal', 'anual'
    
    -- Auditoria
    usuario_id UUID REFERENCES auth.users(id), -- Quem cadastrou
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    observacoes TEXT
);

-- Índices para relatórios
CREATE INDEX IF NOT EXISTS idx_fin_vencimento ON financeiro_contas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_status ON financeiro_contas(status);
CREATE INDEX IF NOT EXISTS idx_fin_tipo ON financeiro_contas(tipo);

-- RLS
ALTER TABLE financeiro_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total para autenticados" 
ON financeiro_contas FOR ALL 
TO authenticated 
USING (true);

-- View para Dashboard (Resumo Mensal por Categoria)
CREATE OR REPLACE VIEW financeiro_resumo_mensal AS
SELECT 
    to_char(data_vencimento, 'YYYY-MM') as mes_referencia,
    tipo,
    categoria,
    SUM(valor) as total_previsto,
    SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as total_realizado
FROM financeiro_contas
GROUP BY 1, 2, 3;

GRANT SELECT ON financeiro_resumo_mensal TO authenticated;
