-- Criar tabela de parâmetros financeiros
CREATE TABLE IF NOT EXISTS financeiro_parametros (
    chave TEXT PRIMARY KEY,
    valor NUMERIC NOT NULL,
    descricao TEXT,
    unidade TEXT DEFAULT 'percentual', -- percentual, valor, dias
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE financeiro_parametros ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Leitura pública de parâmetros" ON financeiro_parametros
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso total para Master" ON financeiro_parametros
    FOR ALL TO authenticated USING (
        public.is_master()
    );

-- Inserir valores padrão (Regras MegaB)
INSERT INTO financeiro_parametros (chave, valor, descricao, unidade)
VALUES 
    ('taxa_comissao_bolao', 35, 'Taxa de comissão bruta sobre a venda de bolões', 'percentual'),
    ('divisao_diretor', 70, 'Cota de lucro do Diretor (sobre a comissão bruta)', 'percentual'),
    ('pool_operadores', 30, 'Pool de premiação dos operadores (sobre a comissão bruta)', 'percentual'),
    ('custo_encalhe_casa', 65, 'Custo assumido pela casa sobre o encalhe de bolões', 'percentual')
ON CONFLICT (chave) DO NOTHING;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_financeiro_parametros_updated_at
    BEFORE UPDATE ON financeiro_parametros
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
