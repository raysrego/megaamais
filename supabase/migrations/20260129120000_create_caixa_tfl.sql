-- Migration: Create caixa tables
-- Description: Criação das tabelas de sessões de caixa e movimentações financeiras para os terminais (TFL).

-- Enum para status da sessão de caixa
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'caixa_status') THEN
        CREATE TYPE caixa_status AS ENUM ('aberto', 'fechado', 'conferido', 'discrepante');
    END IF;
END $$;

-- Tabela de Sessões de Caixa (Abertura/Fechamento por Operador)
CREATE TABLE IF NOT EXISTS caixa_sessoes (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id),
    terminal_id TEXT, -- Identificador opcional do TFL físico
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_fechamento TIMESTAMP WITH TIME ZONE,
    valor_inicial DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    valor_final_declarado DECIMAL(10, 2),
    valor_final_calculado DECIMAL(10, 2) DEFAULT 0.00,
    status caixa_status DEFAULT 'aberto',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enum para tipos de movimentação
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movimentacao_tipo') THEN
        CREATE TYPE movimentacao_tipo AS ENUM ('venda', 'sangria', 'suprimento', 'pagamento', 'estorno');
    END IF;
END $$;

-- Tabela de Movimentações (Entradas e Saídas)
CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    sessao_id BIGINT REFERENCES caixa_sessoes(id) ON DELETE CASCADE,
    tipo movimentacao_tipo NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    descricao TEXT,
    metodo_pagamento TEXT DEFAULT 'dinheiro', -- dinheiro, pix, cartao
    referencia_id TEXT, -- ID de venda ou bolão associado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_usuario ON caixa_sessoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_status ON caixa_sessoes(status);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_sessao ON caixa_movimentacoes(sessao_id);

-- RLS (Row Level Security)
ALTER TABLE caixa_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Políticas simples: Gestores veem tudo, operadores veem as próprias sessões (a serem refinadas conforme o perfil do usuário)
CREATE POLICY "Usuários podem ver suas próprias sessões de caixa" 
ON caixa_sessoes FOR SELECT 
TO authenticated 
USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem criar suas sessões de caixa" 
ON caixa_sessoes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem atualizar suas próprias sessões (fechamento)" 
ON caixa_sessoes FOR UPDATE 
TO authenticated 
USING (auth.uid() = usuario_id);

-- Movimentações seguem a permissão da sessão
CREATE POLICY "Usuários podem ver as movimentações das suas sessões" 
ON caixa_movimentacoes FOR SELECT 
TO authenticated 
USING (EXISTS (
    SELECT 1 FROM caixa_sessoes 
    WHERE caixa_sessoes.id = caixa_movimentacoes.sessao_id 
    AND caixa_sessoes.usuario_id = auth.uid()
));

CREATE POLICY "Usuários podem inserir movimentações nas suas sessões abertas" 
ON caixa_movimentacoes FOR INSERT 
TO authenticated 
WITH CHECK (EXISTS (
    SELECT 1 FROM caixa_sessoes 
    WHERE caixa_sessoes.id = sessao_id 
    AND caixa_sessoes.usuario_id = auth.uid()
    AND caixa_sessoes.status = 'aberto'
));
