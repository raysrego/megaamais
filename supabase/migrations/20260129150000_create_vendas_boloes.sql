-- Migration: Create vendas_boloes table
-- Description: Tabela para registrar cada venda de cota individualmente, vinculando ao bolão, vendedor e sessão de caixa.

-- Enum para método de pagamento específico da venda (pode ser redundante com movimentação, mas bom para histórico de venda)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metodo_pagamento_venda') THEN
        CREATE TYPE metodo_pagamento_venda AS ENUM ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS vendas_boloes (
    id BIGSERIAL PRIMARY KEY,
    bolao_id BIGINT REFERENCES boloes(id),
    sessao_caixa_id BIGINT REFERENCES caixa_sessoes(id), -- Vínculo obrigatório com o caixa aberto
    usuario_id UUID REFERENCES auth.users(id), -- Quem vendeu
    quantidade_cotas INTEGER NOT NULL DEFAULT 1,
    valor_total DECIMAL(10, 2) NOT NULL,
    metodo_pagamento metodo_pagamento_venda DEFAULT 'dinheiro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_bolao_id ON vendas_boloes(bolao_id);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_sessao_id ON vendas_boloes(sessao_caixa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_created_at ON vendas_boloes(created_at);

-- RLS
ALTER TABLE vendas_boloes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedores podem ver suas proprias vendas" 
ON vendas_boloes FOR SELECT 
TO authenticated 
USING (auth.uid() = usuario_id);

CREATE POLICY "Vendedores podem registrar vendas" 
ON vendas_boloes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Gestores podem ver todas as vendas" 
ON vendas_boloes FOR ALL 
TO authenticated 
USING (true); -- TODO: Refinar para perfil gestor futuramente
