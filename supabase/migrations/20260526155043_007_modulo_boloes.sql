/*
  # Módulo de Bolões e Prestação de Contas
*/

CREATE TABLE IF NOT EXISTS boloes (
    id BIGSERIAL PRIMARY KEY,
    produto_id BIGINT REFERENCES produtos(id) ON DELETE RESTRICT,
    loja_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    concurso TEXT NOT NULL,
    data_sorteio DATE NOT NULL,
    qtd_jogos INTEGER NOT NULL DEFAULT 1,
    dezenas INTEGER NOT NULL,
    valor_cota_base NUMERIC NOT NULL CHECK (valor_cota_base > 0),
    taxa_administrativa NUMERIC NOT NULL DEFAULT 35.00 CHECK (taxa_administrativa >= 0 AND taxa_administrativa <= 100),
    qtd_cotas INTEGER NOT NULL CHECK (qtd_cotas > 0),
    preco_venda_cota NUMERIC NOT NULL CHECK (preco_venda_cota > 0),
    cotas_vendidas INTEGER NOT NULL DEFAULT 0,
    status bolao_status DEFAULT 'disponivel',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS prestacoes_contas (
    id BIGSERIAL PRIMARY KEY,
    loja_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    responsavel_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    valor_total NUMERIC NOT NULL CHECK (valor_total > 0),
    metodo_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
    data_hora TIMESTAMPTZ DEFAULT timezone('utc', now()),
    observacao TEXT
);

CREATE TABLE IF NOT EXISTS vendas_boloes (
    id BIGSERIAL PRIMARY KEY,
    bolao_id BIGINT REFERENCES boloes(id) ON DELETE RESTRICT,
    sessao_caixa_id BIGINT REFERENCES caixa_sessoes(id) ON DELETE SET NULL,
    caixa_bolao_sessao_id INTEGER REFERENCES caixa_bolao_sessoes(id) ON DELETE SET NULL,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    quantidade_cotas INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_cotas > 0),
    valor_total NUMERIC NOT NULL CHECK (valor_total > 0),
    metodo_pagamento metodo_pagamento_venda DEFAULT 'dinheiro',
    status_prestacao status_prestacao_venda DEFAULT 'pendente',
    prestacao_id BIGINT REFERENCES prestacoes_contas(id) ON DELETE SET NULL,
    liquidado_em TIMESTAMPTZ,
    liquidado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cofre_mov_id BIGINT REFERENCES cofre_movimentacoes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cotas_boloes (
    id BIGSERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    bolao_id BIGINT NOT NULL REFERENCES boloes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'vendida', 'bloqueada')),
    data_venda TIMESTAMPTZ,
    venda_id BIGINT REFERENCES vendas_boloes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS boloes_prestacao_contas (
    id BIGSERIAL PRIMARY KEY,
    bolao_id BIGINT REFERENCES boloes(id) ON DELETE CASCADE,
    valor_total_vendido NUMERIC NOT NULL,
    comissao_bruta NUMERIC NOT NULL,
    repasse_diretor NUMERIC NOT NULL,
    repasse_operadores NUMERIC NOT NULL,
    custo_encalhe NUMERIC DEFAULT 0,
    lucro_liquido_casa NUMERIC,
    status TEXT DEFAULT 'pendente',
    data_liquidacao TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE boloes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotas_boloes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestacoes_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas_boloes ENABLE ROW LEVEL SECURITY;
ALTER TABLE boloes_prestacao_contas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_boloes_loja_id ON boloes(loja_id);
CREATE INDEX IF NOT EXISTS idx_boloes_status ON boloes(status);
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_bolao_id ON cotas_boloes(bolao_id);
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_status ON cotas_boloes(status);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_bolao_id ON vendas_boloes(bolao_id);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_loja_id ON vendas_boloes(loja_id);
CREATE INDEX IF NOT EXISTS idx_prestacoes_contas_loja_id ON prestacoes_contas(loja_id);
