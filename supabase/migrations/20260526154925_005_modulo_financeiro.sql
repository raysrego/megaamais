/*
  # Módulo Financeiro Completo
  Creates all financial tables: banks, bank accounts, financial items, transactions, parameters.
*/

CREATE TABLE IF NOT EXISTS financeiro_bancos (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE,
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financeiro_contas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'corrente',
    saldo_inicial NUMERIC DEFAULT 0,
    saldo_atual NUMERIC DEFAULT 0,
    banco_id INTEGER REFERENCES financeiro_bancos(id) ON DELETE SET NULL,
    agencia TEXT,
    conta_numero TEXT,
    is_padrao_pix BOOLEAN DEFAULT false,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS financeiro_itens_plano (
    id SERIAL PRIMARY KEY,
    item TEXT NOT NULL,
    tipo fin_tipo_conta NOT NULL,
    fixo BOOLEAN DEFAULT false,
    dia_vencimento INTEGER CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
    valor_padrao NUMERIC DEFAULT 0,
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    loja_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo_recorrencia VARCHAR DEFAULT 'VARIAVEL',
    arquivado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financeiro_contas (
    id BIGSERIAL PRIMARY KEY,
    tipo fin_tipo_conta NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC NOT NULL CHECK (valor > 0),
    item TEXT NOT NULL,
    data_vencimento DATE,
    data_pagamento DATE,
    status fin_status_conta DEFAULT 'pendente',
    recorrente BOOLEAN DEFAULT false,
    frequencia TEXT,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    metodo_pagamento fin_metodo_pagamento DEFAULT 'dinheiro',
    comprovante_url TEXT,
    valor_realizado NUMERIC DEFAULT 0,
    item_financeiro_id INTEGER REFERENCES financeiro_itens_plano(id) ON DELETE SET NULL,
    origem_tipo TEXT,
    origem_id BIGINT,
    forma_pagamento TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    observacoes TEXT
);

CREATE TABLE IF NOT EXISTS financeiro_transacoes_bancarias (
    id BIGSERIAL PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES financeiro_contas_bancarias(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor NUMERIC NOT NULL,
    item TEXT NOT NULL DEFAULT '',
    descricao TEXT,
    data_transacao TIMESTAMPTZ DEFAULT now(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    venda_id BIGINT,
    encalhe_id BIGINT,
    cofre_mov_id BIGINT,
    status_conciliacao TEXT DEFAULT 'pendente' CHECK (status_conciliacao IN ('pendente', 'conciliado', 'divergente')),
    data_conciliacao TIMESTAMPTZ,
    conciliavel BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financeiro_parametros (
    chave TEXT PRIMARY KEY,
    valor NUMERIC NOT NULL,
    descricao TEXT,
    unidade TEXT DEFAULT 'percentual',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financeiro_repasses (
    id BIGSERIAL PRIMARY KEY,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    periodo_mes_ano TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valor_comissao_bruta NUMERIC NOT NULL,
    valor_liquido_pago NUMERIC NOT NULL,
    status TEXT DEFAULT 'pendente',
    data_pagamento TIMESTAMPTZ,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE financeiro_bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_itens_plano ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_transacoes_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_repasses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_loja_id ON financeiro_contas(loja_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_data_vencimento ON financeiro_contas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_status ON financeiro_contas(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_deleted_at ON financeiro_contas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_bancarias_loja_id ON financeiro_contas_bancarias(loja_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_transacoes_conta_id ON financeiro_transacoes_bancarias(conta_id);

INSERT INTO financeiro_bancos (codigo, nome) VALUES
    ('001', 'Banco do Brasil'),
    ('033', 'Santander'),
    ('104', 'Caixa Econômica Federal'),
    ('237', 'Bradesco'),
    ('341', 'Itaú Unibanco'),
    ('260', 'Nu Pagamentos (Nubank)'),
    ('077', 'Banco Inter'),
    ('290', 'Pagseguro'),
    ('323', 'Mercado Pago'),
    ('380', 'PicPay')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO financeiro_parametros (chave, valor, descricao, unidade) VALUES
    ('taxa_administrativa_padrao', 35.00, 'Taxa administrativa padrão para bolões (%)', 'percentual'),
    ('comissao_operador', 30.00, 'Percentual de comissão do operador sobre lucro (%)', 'percentual'),
    ('comissao_casa', 70.00, 'Percentual da casa sobre lucro (%)', 'percentual')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;
