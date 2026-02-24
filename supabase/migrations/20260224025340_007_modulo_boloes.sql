/*
  # Módulo de Bolões e Prestação de Contas
  
  1. Novas Tabelas
    - `boloes`
      - Bolões criados
      - `id` (bigserial, PK)
      - `produto_id` (bigint) - FK para produtos
      - `loja_id` (uuid) - Multi-tenant
      - `concurso` (text) - Número do concurso
      - `data_sorteio` (date)
      - `qtd_jogos` (integer) - Quantidade de jogos
      - `dezenas` (integer) - Quantidade de dezenas
      - `valor_cota_base` (numeric) - Valor base da cota
      - `taxa_administrativa` (numeric) - % de taxa
      - `qtd_cotas` (integer) - Total de cotas
      - `preco_venda_cota` (numeric) - Preço final da cota
      - `cotas_vendidas` (integer) - Contador de vendas
      - `status` (bolao_status)
      
    - `cotas_boloes`
      - Cotas individuais de cada bolão
      - `id` (bigserial, PK)
      - `uid` (text, unique) - Identificador único B{bolaoId}-{indice}-{random4}
      - `bolao_id` (bigint) - FK para boloes
      - `status` (text) - disponivel, vendida, bloqueada
      - `data_venda` (timestamptz)
      - `venda_id` (bigint) - FK para vendas_boloes
      
    - `prestacoes_contas`
      - Prestações de contas dos operadores
      - `id` (bigserial, PK)
      - `loja_id` (uuid)
      - `operador_id` (uuid) - FK para auth.users
      - `responsavel_id` (uuid) - Quem recebeu
      - `valor_total` (numeric)
      - `metodo_pagamento` (text)
      - `data_hora` (timestamptz)
      - `observacao` (text)
      
    - `vendas_boloes`
      - Registro de vendas de bolões
      - `id` (bigserial, PK)
      - `bolao_id` (bigint) - FK para boloes
      - `sessao_caixa_id` (bigint) - FK para caixa_sessoes
      - `caixa_bolao_sessao_id` (integer) - FK para caixa_bolao_sessoes
      - `usuario_id` (uuid) - Vendedor
      - `loja_id` (uuid)
      - `quantidade_cotas` (integer)
      - `valor_total` (numeric)
      - `metodo_pagamento` (metodo_pagamento_venda)
      - `status_prestacao` (status_prestacao_venda)
      - `prestacao_id` (bigint) - FK para prestacoes_contas
      - `liquidado_em`, `liquidado_por` (timestamptz, uuid)
      - `cofre_mov_id` (bigint) - FK para cofre_movimentacoes
      - Soft delete
      
    - `boloes_prestacao_contas`
      - Prestação de contas por bolão (resultado final)
      - `id` (bigserial, PK)
      - `bolao_id` (bigint) - FK para boloes
      - `valor_total_vendido` (numeric)
      - `comissao_bruta` (numeric)
      - `repasse_diretor` (numeric)
      - `repasse_operadores` (numeric)
      - `custo_encalhe` (numeric)
      - `lucro_liquido_casa` (numeric)
      - `status` (text)
      - `data_liquidacao` (timestamptz)
      
  2. Segurança
    - RLS habilitado em todas as tabelas
    - Multi-tenant por loja_id
    - Soft delete em vendas
    
  3. Regras de Negócio
    - Cada bolão tem N cotas individuais com UID único
    - Vendas são atômicas (via RPC)
    - Encalhe gera despesa financeira automaticamente
    - Prestação de contas liquida vendas pendentes
    - Comissão: 30% do lucro para operadores, 70% para casa
*/

-- Tabela de Bolões
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

-- Tabela de Prestações de Contas (deve vir antes de vendas_boloes)
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

-- Tabela de Vendas de Bolões
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

-- Tabela de Cotas de Bolões
CREATE TABLE IF NOT EXISTS cotas_boloes (
    id BIGSERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE, -- Formato: B{bolaoId}-{indice}-{random4}
    bolao_id BIGINT NOT NULL REFERENCES boloes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'vendida', 'bloqueada')),
    data_venda TIMESTAMPTZ,
    venda_id BIGINT REFERENCES vendas_boloes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Tabela de Prestação de Contas de Bolões (resultado final)
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

-- Habilitar RLS
ALTER TABLE boloes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotas_boloes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestacoes_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas_boloes ENABLE ROW LEVEL SECURITY;
ALTER TABLE boloes_prestacao_contas ENABLE ROW LEVEL SECURITY;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_boloes_produto_id ON boloes(produto_id);
CREATE INDEX IF NOT EXISTS idx_boloes_loja_id ON boloes(loja_id);
CREATE INDEX IF NOT EXISTS idx_boloes_status ON boloes(status);
CREATE INDEX IF NOT EXISTS idx_boloes_data_sorteio ON boloes(data_sorteio);
CREATE INDEX IF NOT EXISTS idx_boloes_concurso ON boloes(concurso);
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_bolao_id ON cotas_boloes(bolao_id);
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_status ON cotas_boloes(status);
CREATE INDEX IF NOT EXISTS idx_cotas_boloes_uid ON cotas_boloes(uid);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_bolao_id ON vendas_boloes(bolao_id);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_usuario_id ON vendas_boloes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_loja_id ON vendas_boloes(loja_id);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_status_prestacao ON vendas_boloes(status_prestacao);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_deleted_at ON vendas_boloes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendas_boloes_created_at ON vendas_boloes(created_at);
CREATE INDEX IF NOT EXISTS idx_prestacoes_contas_operador_id ON prestacoes_contas(operador_id);
CREATE INDEX IF NOT EXISTS idx_prestacoes_contas_loja_id ON prestacoes_contas(loja_id);
CREATE INDEX IF NOT EXISTS idx_boloes_prestacao_bolao_id ON boloes_prestacao_contas(bolao_id);