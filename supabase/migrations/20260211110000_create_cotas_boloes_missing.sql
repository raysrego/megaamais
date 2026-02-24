-- Migration: Create cotas_boloes table (Missing from recovery)
-- Description: Tabela para gerenciar as cotas individuais geradas a partir de um bolão.

-- Enum para status da cota
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cota_status') THEN
        CREATE TYPE cota_status AS ENUM ('disponivel', 'reservada', 'vendida');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.cotas_boloes (
    id BIGSERIAL PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL, -- Identificador amigável (ex: AB-1234)
    bolao_id BIGINT NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
    status cota_status DEFAULT 'disponivel',
    
    -- Dados da venda (preenchidos quando status = 'vendida')
    data_venda TIMESTAMP WITH TIME ZONE,
    valor_venda DECIMAL(10, 2),
    forma_pagamento TEXT, -- dinheiro, pix, cartao, etc.
    comprador_nome TEXT,   -- Opcional, para identificar quem comprou
    comprador_telefone TEXT,
    
    usuario_vendedor_id UUID REFERENCES auth.users(id), -- Quem vendeu
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_bolao ON public.cotas_boloes(bolao_id);
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_status ON public.cotas_boloes(status);
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_uid ON public.cotas_boloes(uid);

-- RLS
ALTER TABLE public.cotas_boloes ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Leitura: Todos podem ver (necessário para listar cotas disponíveis)
CREATE POLICY "Todos podem ver cotas_boloes" ON public.cotas_boloes
    FOR SELECT
    USING (true);

-- 2. Inserção: Autenticados podem inserir (ao criar bolão)
CREATE POLICY "Autenticados podem criar cotas_boloes" ON public.cotas_boloes
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 3. Atualização: Autenticados podem atualizar (ao vender)
CREATE POLICY "Autenticados podem atualizar cotas_boloes" ON public.cotas_boloes
    FOR UPDATE
    USING (auth.role() = 'authenticated');
