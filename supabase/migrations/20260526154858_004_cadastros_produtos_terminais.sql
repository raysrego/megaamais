/*
  # Cadastros - Produtos, Categorias e Terminais
*/

CREATE TABLE IF NOT EXISTS categorias_produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    icone TEXT NOT NULL DEFAULT 'box',
    cor TEXT DEFAULT '#64748b',
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS produtos (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE,
    cor TEXT NOT NULL DEFAULT '#000000',
    cor_destaque TEXT,
    icone TEXT NOT NULL DEFAULT 'Clover',
    dias_sorteio INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
    min_dezenas INTEGER NOT NULL DEFAULT 6,
    max_dezenas INTEGER NOT NULL DEFAULT 15,
    horario_fechamento TEXT NOT NULL DEFAULT '19:00',
    ativo BOOLEAN DEFAULT true,
    empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
    categoria_id INTEGER REFERENCES categorias_produtos(id) ON DELETE SET NULL,
    gerencia_estoque BOOLEAN DEFAULT false,
    preco_padrao NUMERIC DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS loja_produtos (
    id BIGSERIAL PRIMARY KEY,
    loja_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    saldo_estoque INTEGER DEFAULT 0,
    preco_venda NUMERIC,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(loja_id, produto_id)
);

CREATE TABLE IF NOT EXISTS terminais (
    id BIGSERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT,
    modelo TEXT,
    status terminal_status DEFAULT 'ativo',
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE categorias_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminais ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_id ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_slug ON produtos(slug);
CREATE INDEX IF NOT EXISTS idx_loja_produtos_loja_id ON loja_produtos(loja_id);
CREATE INDEX IF NOT EXISTS idx_terminais_loja_id ON terminais(loja_id);
CREATE INDEX IF NOT EXISTS idx_terminais_codigo ON terminais(codigo);

INSERT INTO categorias_produtos (nome, icone, cor) VALUES
    ('Loterias', 'Clover', '#10b981'),
    ('Serviços', 'Package', '#3b82f6'),
    ('Produtos', 'ShoppingBag', '#f59e0b')
ON CONFLICT DO NOTHING;

INSERT INTO produtos (nome, slug, cor, cor_destaque, icone, dias_sorteio, min_dezenas, max_dezenas, categoria_id) VALUES
    ('Mega-Sena', 'mega-sena', '#209869', '#27ae60', 'Clover', '{3,6}', 6, 20, 1),
    ('Lotofácil', 'lotofacil', '#930089', '#c026d3', 'Sparkles', '{1,2,3,4,5,6}', 15, 20, 1),
    ('Quina', 'quina', '#260085', '#6366f1', 'Star', '{1,2,3,4,5,6}', 5, 15, 1),
    ('Lotomania', 'lotomania', '#f77f00', '#f97316', 'Trophy', '{2,5}', 50, 50, 1),
    ('Timemania', 'timemania', '#00ff48', '#22c55e', 'Shield', '{2,4,6}', 10, 10, 1),
    ('Dupla Sena', 'dupla-sena', '#a61324', '#dc2626', 'Zap', '{2,4,6}', 6, 15, 1),
    ('Dia de Sorte', 'dia-de-sorte', '#cb852b', '#eab308', 'Sun', '{2,4,6}', 7, 15, 1),
    ('Super Sete', 'super-sete', '#a8cf45', '#84cc16', 'Hexagon', '{1,3,5}', 7, 7, 1),
    ('+Milionária', 'mais-milionaria', '#003171', '#1e40af', 'Crown', '{3,6}', 6, 12, 1)
ON CONFLICT (slug) DO NOTHING;
