/*
  # Módulo de Caixa Operacional
  
  1. Novas Tabelas
    - `caixa_sessoes`
      - Sessões de caixa TFL (Terminal das Loterias)
      - `id` (bigserial, PK)
      - `operador_id` (uuid) - FK para auth.users
      - `terminal_id` (text) - Legado
      - `terminal_id_ref` (bigint) - FK para terminais
      - `loja_id` (uuid) - Multi-tenant
      - `data_abertura`, `data_fechamento` (timestamptz)
      - `valor_inicial`, `valor_final_declarado`, `valor_final_calculado` (numeric)
      - `status` (caixa_status)
      - Dados TFL: `tfl_vendas`, `tfl_premios`, `tfl_contas`, `tfl_saldo_projetado`, `tfl_pix_total`
      - Totalizadores: `total_pix_manual`, `total_sangrias`, `total_depositos_filial`
      - `saldo_liquido_final` (numeric) - Calculado
      - Validação Gerencial: `status_validacao`, `validado_por_id`, `observacoes_gerente`
      
    - `caixa_movimentacoes`
      - Movimentações dentro de uma sessão
      - `id` (bigserial, PK)
      - `sessao_id` (bigint) - FK para caixa_sessoes
      - `tipo` (text) - venda, sangria, suprimento, pagamento, estorno, pix, trocados, deposito, boleto
      - `valor` (numeric)
      - `descricao` (text)
      - `metodo_pagamento` (text)
      - `classificacao_pix` (text) - Para PIX manuais
      - `item_financeiro_id` (integer) - FK para itens_plano
      - `comprovante_url` (text)
      - Soft delete e auditoria
      
    - `caixa_bolao_sessoes`
      - Sessões específicas para venda de bolões
      - `id` (serial, PK)
      - `responsavel_id` (uuid) - FK para usuarios
      - `tipo_responsavel` (text) - op_admin ou gerente
      - `data_abertura`, `data_fechamento` (timestamptz)
      - `total_vendido`, `total_dinheiro`, `total_pix` (numeric)
      - `dinheiro_informado`, `pix_informado` (numeric) - Valores declarados
      - `status` (text) - aberto ou fechado
      - `status_validacao` (status_validacao_gerencial)
      - `validado_por_id` (uuid)
      
    - `cofre_movimentacoes`
      - Gestão do cofre (sangrias e depósitos)
      - `id` (bigserial, PK)
      - `tipo` (text) - entrada_sangria, saida_deposito, ajuste_entrada, ajuste_saida
      - `valor` (numeric)
      - `operador_id` (uuid) - FK para auth.users
      - `origem_sangria_id` (bigint) - FK para caixa_movimentacoes
      - `destino_banco` (text)
      - `comprovante_doc` (text)
      - `loja_id` (uuid) - Multi-tenant
      - `status` (text)
      - Soft delete
      
  2. Segurança
    - RLS habilitado em todas as tabelas
    - Multi-tenant por loja_id
    - Validação gerencial para fechamentos
    
  3. Regras de Negócio
    - Cálculo de saldo líquido: tfl_saldo_projetado - tfl_pix_total - total_pix_manual - total_sangrias - total_depositos_filial
    - Sangrias geram entrada automática no cofre
    - Validação gerencial obrigatória para fechamentos
*/

-- Tabela de Sessões de Caixa
CREATE TABLE IF NOT EXISTS caixa_sessoes (
    id BIGSERIAL PRIMARY KEY,
    operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    terminal_id TEXT, -- Legado
    terminal_id_ref BIGINT REFERENCES terminais(id) ON DELETE SET NULL,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    data_abertura TIMESTAMPTZ DEFAULT timezone('utc', now()),
    data_fechamento TIMESTAMPTZ,
    valor_inicial NUMERIC NOT NULL DEFAULT 0.00 CHECK (valor_inicial >= 0),
    valor_final_declarado NUMERIC CHECK (valor_final_declarado IS NULL OR valor_final_declarado >= 0),
    valor_final_calculado NUMERIC DEFAULT 0.00,
    saldo_final_sistema NUMERIC DEFAULT 0,
    diferenca_quebra NUMERIC DEFAULT 0,
    status caixa_status DEFAULT 'aberto',
    tem_fundo_caixa BOOLEAN DEFAULT true,
    observacoes TEXT,
    -- Dados TFL
    tfl_vendas NUMERIC DEFAULT 0,
    tfl_premios NUMERIC DEFAULT 0,
    tfl_contas NUMERIC DEFAULT 0,
    tfl_saldo_projetado NUMERIC DEFAULT 0,
    tfl_pix_total NUMERIC DEFAULT 0,
    tfl_comprovante_url TEXT,
    -- Totalizadores de Fechamento
    total_pix_manual NUMERIC DEFAULT 0,
    total_sangrias NUMERIC DEFAULT 0,
    total_depositos_filial NUMERIC DEFAULT 0,
    saldo_liquido_final NUMERIC,
    -- Validação Gerencial
    status_validacao status_validacao_gerencial DEFAULT 'pendente',
    validado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    data_validacao TIMESTAMPTZ,
    observacoes_gerente TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Tabela de Movimentações de Caixa
CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    sessao_id BIGINT REFERENCES caixa_sessoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- venda, sangria, suprimento, pagamento, estorno, pix, trocados, deposito, boleto
    valor NUMERIC NOT NULL CHECK (valor <> 0),
    descricao TEXT,
    metodo_pagamento TEXT DEFAULT 'dinheiro',
    referencia_id TEXT,
    classificacao_pix TEXT, -- Para PIX manuais
    item_financeiro_id INTEGER REFERENCES financeiro_itens_plano(id) ON DELETE SET NULL,
    comprovante_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela de Sessões de Caixa de Bolão
CREATE TABLE IF NOT EXISTS caixa_bolao_sessoes (
    id SERIAL PRIMARY KEY,
    responsavel_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_responsavel TEXT NOT NULL CHECK (tipo_responsavel IN ('op_admin', 'gerente')),
    data_abertura TIMESTAMPTZ DEFAULT now(),
    data_fechamento TIMESTAMPTZ,
    total_vendido NUMERIC DEFAULT 0,
    total_dinheiro NUMERIC DEFAULT 0,
    total_pix NUMERIC DEFAULT 0,
    dinheiro_informado NUMERIC,
    pix_informado NUMERIC,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
    status_validacao status_validacao_gerencial DEFAULT 'pendente',
    validado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    data_validacao TIMESTAMPTZ,
    observacoes TEXT,
    observacoes_gerente TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Movimentações do Cofre
CREATE TABLE IF NOT EXISTS cofre_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada_sangria', 'saida_deposito', 'ajuste_entrada', 'ajuste_saida')),
    valor NUMERIC NOT NULL CHECK (valor > 0),
    data_movimentacao TIMESTAMPTZ DEFAULT timezone('utc', now()),
    operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    origem_sangria_id BIGINT REFERENCES caixa_movimentacoes(id) ON DELETE SET NULL,
    destino_banco TEXT,
    comprovante_doc TEXT,
    observacoes TEXT,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'concluido',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Adicionar FK cruzada de transacoes_bancarias para cofre (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_cofre_mov_id'
    ) THEN
        ALTER TABLE financeiro_transacoes_bancarias 
        ADD CONSTRAINT fk_cofre_mov_id 
        FOREIGN KEY (cofre_mov_id) REFERENCES cofre_movimentacoes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE caixa_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_bolao_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofre_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_operador_id ON caixa_sessoes(operador_id);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_loja_id ON caixa_sessoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_status ON caixa_sessoes(status);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_status_validacao ON caixa_sessoes(status_validacao);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_data_abertura ON caixa_sessoes(data_abertura);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_sessao_id ON caixa_movimentacoes(sessao_id);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_tipo ON caixa_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_deleted_at ON caixa_movimentacoes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cofre_movimentacoes_loja_id ON cofre_movimentacoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_cofre_movimentacoes_tipo ON cofre_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_cofre_movimentacoes_deleted_at ON cofre_movimentacoes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_caixa_bolao_sessoes_responsavel_id ON caixa_bolao_sessoes(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_caixa_bolao_sessoes_status ON caixa_bolao_sessoes(status);