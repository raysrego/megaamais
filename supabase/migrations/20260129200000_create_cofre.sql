-- Migration: Create cofre tables
-- Description: Gestão do cofre físico da lotérica (entradas de sangrias e saídas para depósito)

-- Enum para tipos de movimentação do cofre
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cofre_tipo_movimentacao') THEN
        CREATE TYPE cofre_tipo_movimentacao AS ENUM ('entrada_sangria', 'saida_deposito', 'ajuste_entrada', 'ajuste_saida');
    END IF;
END $$;

-- Tabela de Movimentações do Cofre
CREATE TABLE IF NOT EXISTS cofre_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    tipo cofre_tipo_movimentacao NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    data_movimentacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Rastreabilidade
    usuario_id UUID REFERENCES auth.users(id) NOT NULL, -- Quem realizou a ação no cofre
    
    -- Referências
    origem_sangria_id BIGINT REFERENCES caixa_movimentacoes(id), -- Se for entrada de sangria
    destino_banco TEXT, -- Se for depósito (qual banco/conta)
    comprovante_doc TEXT, -- Código do envelope ou comprovante bancário
    
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cofre_data ON cofre_movimentacoes(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_cofre_sangria ON cofre_movimentacoes(origem_sangria_id);

-- RLS
ALTER TABLE cofre_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Políticas: Apenas usuários autenticados (melhorar futuramente para apenas Gerentes)
CREATE POLICY "Gerentes podem ver toda movimentação de cofre" 
ON cofre_movimentacoes FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Gerentes podem inserir no cofre" 
ON cofre_movimentacoes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = usuario_id);

-- View para Saldo Atual (Facilitador)
CREATE OR REPLACE VIEW cofre_saldo_atual AS
SELECT 
    COALESCE(SUM(CASE 
        WHEN tipo IN ('entrada_sangria', 'ajuste_entrada') THEN valor 
        WHEN tipo IN ('saida_deposito', 'ajuste_saida') THEN -valor 
        ELSE 0 
    END), 0) as saldo
FROM cofre_movimentacoes;

-- Permissão de leitura na View
GRANT SELECT ON cofre_saldo_atual TO authenticated;

-- View para Sangrias Pendentes de Conferência
-- Lista movimentações do tipo 'sangria' do CAIXA que ainda não estão no COFRE
CREATE OR REPLACE VIEW cofre_sangrias_pendentes AS
SELECT 
    cm.id as sangria_id,
    cm.valor,
    cm.created_at as data_hora,
    cs.terminal_id, -- Nome do terminal (ex: TFL-01)
    cs.usuario_id as operador_id,
    -- Dados para identificação visual
    cm.descricao as observacao_caixa
FROM caixa_movimentacoes cm
JOIN caixa_sessoes cs ON cm.sessao_id = cs.id
WHERE cm.tipo = 'sangria'
AND NOT EXISTS (
    SELECT 1 FROM cofre_movimentacoes cof 
    WHERE cof.origem_sangria_id = cm.id
);

-- Permissão de leitura na View
GRANT SELECT ON cofre_sangrias_pendentes TO authenticated;
