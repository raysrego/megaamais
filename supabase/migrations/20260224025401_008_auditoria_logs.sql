/*
  # Módulo de Auditoria e Logs
  
  1. Novas Tabelas
    - `audit_logs`
      - Logs de auditoria de todas as operações
      - `id` (bigserial, PK)
      - `tabela` (text) - Nome da tabela afetada
      - `registro_id` (text) - ID do registro
      - `acao` (text) - INSERT, UPDATE, DELETE
      - `dados_antigos` (jsonb) - Estado anterior
      - `dados_novos` (jsonb) - Novo estado
      - `usuario_id` (uuid) - Quem fez a ação
      - `ip_address` (text)
      - `user_agent` (text)
      - `created_at` (timestamptz)
      
    - `rate_limit_log`
      - Controle de rate limiting
      - `id` (bigserial, PK)
      - `user_id` (uuid)
      - `action_type` (text) - Tipo de ação
      - `ip_address` (text)
      - `created_at` (timestamptz)
      
  2. Segurança
    - RLS habilitado
    - Apenas admin pode consultar logs
    - Logs são imutáveis (sem UPDATE/DELETE)
    
  3. Uso
    - Rastreamento completo de alterações
    - Análise de segurança
    - Debugging e troubleshooting
    - Rate limiting para criação de usuários e outras operações sensíveis
*/

-- Tabela de Logs de Auditoria
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

-- Tabela de Rate Limit
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela ON audit_logs(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_logs_registro_id ON audit_logs(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario_id ON audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_user_id ON rate_limit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_action_type ON rate_limit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_created_at ON rate_limit_log(created_at);

-- Função auxiliar para auditoria automática
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (tabela, registro_id, acao, dados_antigos, usuario_id)
        VALUES (TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', row_to_json(OLD), auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (tabela, registro_id, acao, dados_antigos, dados_novos, usuario_id)
        VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (tabela, registro_id, acao, dados_novos, usuario_id)
        VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', row_to_json(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Triggers de auditoria podem ser adicionados conforme necessidade
-- Exemplo de como adicionar trigger:
-- CREATE TRIGGER audit_vendas_boloes
--     AFTER INSERT OR UPDATE OR DELETE ON vendas_boloes
--     FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();