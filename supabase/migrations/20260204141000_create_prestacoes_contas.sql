-- Migration: Create Prestacoes Contas
-- Description: Tabela para registrar o recebimento de valores das vendas livres pelos Op. Masters/Gerentes.

BEGIN;

CREATE TABLE IF NOT EXISTS prestacoes_contas (
    id BIGSERIAL PRIMARY KEY,
    loja_id UUID NOT NULL, -- Segregação por filial
    operador_id UUID REFERENCES auth.users(id) NOT NULL, -- Quem está prestando contas
    responsavel_id UUID REFERENCES auth.users(id) NOT NULL, -- Quem recebeu (Op. Master/Gerente)
    valor_total DECIMAL(10, 2) NOT NULL CHECK (valor_total > 0),
    metodo_pagamento text NOT NULL DEFAULT 'dinheiro', -- dinheiro, pix
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    observacao TEXT
);

-- Indexação
CREATE INDEX IF NOT EXISTS idx_prestacoes_loja ON prestacoes_contas(loja_id);
CREATE INDEX IF NOT EXISTS idx_prestacoes_operador ON prestacoes_contas(operador_id);
CREATE INDEX IF NOT EXISTS idx_prestacoes_data ON prestacoes_contas(data_hora);

-- RLS
ALTER TABLE prestacoes_contas ENABLE ROW LEVEL SECURITY;

-- Policy: Operador vê suas próprias prestações
CREATE POLICY "Operador vê suas prestacoes" 
ON prestacoes_contas FOR SELECT 
TO authenticated 
USING (auth.uid() = operador_id);

-- Policy: Responsável (Op. Master) vê as que recebeu
CREATE POLICY "Responsavel vê recebimentos" 
ON prestacoes_contas FOR SELECT 
TO authenticated 
USING (auth.uid() = responsavel_id);

-- Policy: Master/Gerente vê tudo da sua loja
CREATE POLICY "Gestores veem prestacoes da loja" 
ON prestacoes_contas FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM perfis 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'gerente', 'op_admin'))
    )
);

-- Policy: Apenas Gestores podem criar (confirmar recebimento)
CREATE POLICY "Gestores registram prestacao" 
ON prestacoes_contas FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM perfis 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'gerente', 'op_admin'))
    )
);

-- Adicionar FK em vendas_boloes (criada no passo anterior)
ALTER TABLE vendas_boloes
ADD CONSTRAINT fk_vendas_prestacao
FOREIGN KEY (prestacao_id)
REFERENCES prestacoes_contas(id);

COMMIT;
