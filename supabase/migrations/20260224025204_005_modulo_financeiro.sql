/*
  # Módulo Financeiro Completo
  
  1. Novas Tabelas
    - `financeiro_bancos`
      - Cadastro de bancos
      - `id` (serial, PK)
      - `codigo` (text, unique) - Código do banco
      - `nome` (text) - Nome do banco
      
    - `financeiro_contas_bancarias`
      - Contas bancárias da empresa
      - `id` (uuid, PK)
      - `nome` (text) - Nome da conta
      - `tipo` (text) - Tipo de conta
      - `saldo_inicial`, `saldo_atual` (numeric)
      - `banco_id` (integer) - FK para bancos
      - `agencia`, `conta_numero` (text)
      - `is_padrao_pix` (boolean)
      - `loja_id` (uuid) - Multi-tenant
      
    - `financeiro_itens_plano`
      - Catálogo de categorias financeiras (substitui items)
      - `id` (serial, PK)
      - `item` (text) - Nome da categoria
      - `tipo` (fin_tipo_conta) - receita ou despesa
      - `fixo` (boolean) - Se é despesa fixa
      - `dia_vencimento` (integer) - Dia do mês
      - `valor_padrao` (numeric)
      - `tipo_recorrencia` (varchar) - FIXO_MENSAL, FIXO_VARIAVEL, VARIAVEL
      - `loja_id` (uuid) - Multi-tenant
      - `arquivado` (boolean)
      
    - `financeiro_contas`
      - Transações financeiras (receitas e despesas)
      - `id` (bigserial, PK)
      - `tipo` (fin_tipo_conta)
      - `descricao` (text)
      - `valor` (numeric) - Valor planejado
      - `valor_realizado` (numeric) - Valor efetivo
      - `item` (text) - Categoria
      - `data_vencimento`, `data_pagamento` (date)
      - `status` (fin_status_conta)
      - `metodo_pagamento` (fin_metodo_pagamento)
      - `comprovante_url` (text) - URL do Storage
      - `item_financeiro_id` (integer) - FK para itens_plano
      - `origem_tipo`, `origem_id` (text, bigint) - Rastreamento
      - `loja_id` (uuid) - Multi-tenant
      - `usuario_id` (uuid) - Criador
      - Campos de auditoria (created_by, updated_by, deleted_at, deleted_by)
      
    - `financeiro_transacoes_bancarias`
      - Transações bancárias para conciliação
      - `id` (bigserial, PK)
      - `conta_id` (uuid) - FK para contas_bancarias
      - `tipo` (text) - entrada ou saida
      - `valor` (numeric)
      - `item`, `descricao` (text)
      - `data_transacao` (timestamptz)
      - `status_conciliacao` (text) - pendente, conciliado, divergente
      - `venda_id`, `encalhe_id`, `cofre_mov_id` (bigint) - Rastreamento
      - `loja_id` (uuid) - Multi-tenant
      
    - `financeiro_parametros`
      - Parâmetros configuráveis do sistema
      - `chave` (text, PK) - Nome do parâmetro
      - `valor` (numeric) - Valor do parâmetro
      - `descricao` (text)
      - `unidade` (text) - percentual, valor, etc
      
    - `financeiro_repasses`
      - Registro de repasses de comissões
      - `id` (bigserial, PK)
      - `loja_id` (uuid)
      - `periodo_mes_ano` (text) - MM/AAAA
      - `tipo` (text) - Tipo de repasse
      - `valor_comissao_bruta` (numeric)
      - `valor_liquido_pago` (numeric)
      - `status` (text)
      - `data_pagamento` (timestamptz)
      
  2. Segurança
    - RLS habilitado em todas as tabelas
    - Soft delete com deleted_at
    - Auditoria de criação e atualização
    
  3. Storage
    - Bucket `comprovantes` para upload de arquivos
    
  4. Filosofia "Excel Turbo"
    - Lançamentos manuais
    - Sem recorrência automática (REMOVIDO na v2.5.22)
    - Função "Replicar Mês" ao invés de automação
*/

-- Tabela de Bancos
CREATE TABLE IF NOT EXISTS financeiro_bancos (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE,
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS financeiro_contas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    saldo_inicial NUMERIC DEFAULT 0,
    saldo_atual NUMERIC DEFAULT 0,
    banco_id INTEGER REFERENCES financeiro_bancos(id) ON DELETE SET NULL,
    agencia TEXT,
    conta_numero TEXT,
    is_padrao_pix BOOLEAN DEFAULT false,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Tabela de Itens do Plano de Contas (Catálogo)
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
    tipo_recorrencia VARCHAR DEFAULT 'VARIAVEL', -- FIXO_MENSAL, FIXO_VARIAVEL, VARIAVEL
    arquivado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Contas Financeiras (Transações)
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

-- Tabela de Transações Bancárias
CREATE TABLE IF NOT EXISTS financeiro_transacoes_bancarias (
    id BIGSERIAL PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES financeiro_contas_bancarias(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor NUMERIC NOT NULL,
    item TEXT NOT NULL,
    descricao TEXT,
    data_transacao TIMESTAMPTZ DEFAULT now(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    venda_id BIGINT,
    encalhe_id BIGINT,
    cofre_mov_id BIGINT, -- FK adicionada depois
    status_conciliacao TEXT DEFAULT 'pendente' CHECK (status_conciliacao IN ('pendente', 'conciliado', 'divergente')),
    data_conciliacao TIMESTAMPTZ,
    conciliavel BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Parâmetros Financeiros
CREATE TABLE IF NOT EXISTS financeiro_parametros (
    chave TEXT PRIMARY KEY,
    valor NUMERIC NOT NULL,
    descricao TEXT,
    unidade TEXT DEFAULT 'percentual',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Repasses
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

-- Habilitar RLS
ALTER TABLE financeiro_bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_itens_plano ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_transacoes_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_repasses ENABLE ROW LEVEL SECURITY;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_loja_id ON financeiro_contas(loja_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_data_vencimento ON financeiro_contas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_item_id ON financeiro_contas(item_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_status ON financeiro_contas(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_tipo ON financeiro_contas(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_deleted_at ON financeiro_contas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_financeiro_itens_loja_arquivado_ordem ON financeiro_itens_plano(loja_id, arquivado, ordem);
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_bancarias_loja_id ON financeiro_contas_bancarias(loja_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_transacoes_conta_id ON financeiro_transacoes_bancarias(conta_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_transacoes_status ON financeiro_transacoes_bancarias(status_conciliacao);

-- Inserir bancos populares
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

-- Inserir parâmetros padrão
INSERT INTO financeiro_parametros (chave, valor, descricao, unidade) VALUES
    ('taxa_administrativa_padrao', 35.00, 'Taxa administrativa padrão para bolões (%)', 'percentual'),
    ('comissao_operador', 30.00, 'Percentual de comissão do operador sobre lucro (%)', 'percentual'),
    ('comissao_casa', 70.00, 'Percentual da casa sobre lucro (%)', 'percentual')
ON CONFLICT (chave) DO NOTHING;

-- Criar bucket de Storage para comprovantes (se não existir)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;