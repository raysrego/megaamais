/*
  # Módulo de Caixa Operacional
  Creates caixa_sessoes, caixa_movimentacoes, caixa_bolao_sessoes, cofre_movimentacoes tables.
*/

CREATE TABLE IF NOT EXISTS caixa_sessoes (
    id BIGSERIAL PRIMARY KEY,
    operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    terminal_id TEXT,
    terminal_id_ref BIGINT REFERENCES terminais(id) ON DELETE SET NULL,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    data_abertura TIMESTAMPTZ DEFAULT timezone('utc', now()),
    data_fechamento TIMESTAMPTZ,
    data_turno DATE,
    valor_inicial NUMERIC NOT NULL DEFAULT 0.00 CHECK (valor_inicial >= 0),
    valor_final_declarado NUMERIC,
    valor_final_calculado NUMERIC DEFAULT 0.00,
    saldo_final_sistema NUMERIC DEFAULT 0,
    diferenca_quebra NUMERIC DEFAULT 0,
    status caixa_status DEFAULT 'aberto',
    tem_fundo_caixa BOOLEAN DEFAULT true,
    observacoes TEXT,
    tfl_vendas NUMERIC DEFAULT 0,
    tfl_premios NUMERIC DEFAULT 0,
    tfl_contas NUMERIC DEFAULT 0,
    tfl_saldo_projetado NUMERIC DEFAULT 0,
    tfl_pix_total NUMERIC DEFAULT 0,
    tfl_comprovante_url TEXT,
    total_pix_manual NUMERIC DEFAULT 0,
    total_sangrias NUMERIC DEFAULT 0,
    total_depositos_filial NUMERIC DEFAULT 0,
    saldo_liquido_final NUMERIC,
    status_validacao status_validacao_gerencial DEFAULT 'pendente',
    validado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data_validacao TIMESTAMPTZ,
    observacoes_gerente TEXT,
    auditoria_status TEXT DEFAULT 'pendente',
    auditoria_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    auditoria_data TIMESTAMPTZ,
    auditoria_observacoes TEXT,
    resumo_entradas_pix NUMERIC DEFAULT 0,
    resumo_entradas_dinheiro NUMERIC DEFAULT 0,
    resumo_saidas_deposito NUMERIC DEFAULT 0,
    resumo_saidas_sangria NUMERIC DEFAULT 0,
    resumo_saidas_trocados NUMERIC DEFAULT 0,
    resumo_total_entradas NUMERIC DEFAULT 0,
    valor_enviado_cofre NUMERIC DEFAULT 0,
    pix_externo_informado NUMERIC DEFAULT 0,
    valor_para_conciliacao NUMERIC DEFAULT 0,
    total_pix NUMERIC DEFAULT 0,
    total_dinheiro NUMERIC DEFAULT 0,
    total_depositos NUMERIC DEFAULT 0,
    total_boletos NUMERIC DEFAULT 0,
    total_trocados NUMERIC DEFAULT 0,
    total_lancamentos NUMERIC DEFAULT 0,
    valor_na_conta NUMERIC DEFAULT 0,
    divergencia NUMERIC DEFAULT 0,
    saldo_no_caixa NUMERIC DEFAULT 0,
    operador_nome TEXT,
    fundo_caixa_devolvido BOOLEAN DEFAULT false,
    saldo_esperado NUMERIC DEFAULT 0,
    observacoes_operador TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    sessao_id BIGINT REFERENCES caixa_sessoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    valor NUMERIC NOT NULL CHECK (valor <> 0),
    descricao TEXT,
    metodo_pagamento TEXT DEFAULT 'dinheiro',
    referencia_id TEXT,
    classificacao_pix TEXT,
    item_financeiro_id INTEGER REFERENCES financeiro_itens_plano(id) ON DELETE SET NULL,
    comprovante_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    categoria_operacional_id INTEGER,
    categoria_produto_id INTEGER
);

CREATE TABLE IF NOT EXISTS caixa_bolao_sessoes (
    id SERIAL PRIMARY KEY,
    responsavel_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
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
    validado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data_validacao TIMESTAMPTZ,
    observacoes TEXT,
    observacoes_gerente TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cofre_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada_sangria', 'saida_deposito', 'ajuste_entrada', 'ajuste_saida', 'entrada_fechamento', 'transferencia_banco')),
    valor NUMERIC NOT NULL CHECK (valor > 0),
    data_movimentacao TIMESTAMPTZ DEFAULT timezone('utc', now()),
    operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    origem_sangria_id BIGINT REFERENCES caixa_movimentacoes(id) ON DELETE SET NULL,
    origem_sessao_id BIGINT REFERENCES caixa_sessoes(id) ON DELETE SET NULL,
    destino_banco TEXT,
    comprovante_doc TEXT,
    observacoes TEXT,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'concluido',
    conta_bancaria_id UUID REFERENCES financeiro_contas_bancarias(id) ON DELETE SET NULL,
    conta_bancaria_destino_id UUID REFERENCES financeiro_contas_bancarias(id) ON DELETE SET NULL,
    data_deposito DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE caixa_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_bolao_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofre_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_operador_id ON caixa_sessoes(operador_id);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_loja_id ON caixa_sessoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_auditoria_status ON caixa_sessoes(auditoria_status);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_data_turno ON caixa_sessoes(data_turno);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_sessao_id ON caixa_movimentacoes(sessao_id);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_tipo ON caixa_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_deleted_at ON caixa_movimentacoes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cofre_movimentacoes_loja_id ON cofre_movimentacoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_cofre_movimentacoes_tipo ON cofre_movimentacoes(tipo);
