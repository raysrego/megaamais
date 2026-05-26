/*
  # Auditoria, Logs, TFL e demais tabelas
  Creates audit_logs, rate_limit_log, fechamento_tfl, fechamento_caixa_ia, categorias_operacionais.
*/

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
    dados_antigos JSONB,
    dados_novos JSONB,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fechamento_caixa_ia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id uuid,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    tipo_documento text NOT NULL DEFAULT 'DESCONHECIDO',
    data_documento date,
    terminal text,
    dados_extraidos jsonb DEFAULT '{}',
    imagem_url text,
    status_processamento text NOT NULL DEFAULT 'processado',
    erro_mensagem text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fechamento_tfl (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id uuid,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    data_referencia date,
    terminal text,
    total_creditos numeric(14,2) DEFAULT 0,
    total_debitos numeric(14,2) DEFAULT 0,
    saldo_final numeric(14,2) DEFAULT 0,
    dados_extraidos jsonb DEFAULT '{}',
    arquivo_nome text,
    status_auditoria text NOT NULL DEFAULT 'pendente',
    observacoes_auditoria text,
    auditado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    auditado_em timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias_operacionais (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    descricao TEXT,
    icone TEXT DEFAULT 'circle',
    cor TEXT DEFAULT '#64748b',
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conciliacao_extratos (
    id BIGSERIAL PRIMARY KEY,
    loja_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    total_entradas_ofx NUMERIC DEFAULT 0,
    total_pix_sistema NUMERIC DEFAULT 0,
    total_depositos_cofre NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliado', 'divergente')),
    observacoes TEXT,
    conciliado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    conciliado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamento_caixa_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamento_tfl ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacao_extratos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela ON audit_logs(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario_id ON audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fechamento_tfl_loja_idx ON fechamento_tfl(loja_id);
CREATE INDEX IF NOT EXISTS idx_fechamento_tfl_status_idx ON fechamento_tfl(status_auditoria);
CREATE INDEX IF NOT EXISTS idx_fechamento_caixa_ia_loja_idx ON fechamento_caixa_ia(loja_id);
CREATE INDEX IF NOT EXISTS idx_categorias_operacionais_empresa ON categorias_operacionais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_conciliacao_extratos_loja ON conciliacao_extratos(loja_id);
