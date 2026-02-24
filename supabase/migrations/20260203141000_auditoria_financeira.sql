-- ==========================================
-- SPRINT 3 - AUDITORIA FINANCEIRA
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Rastrear todas alterações em tabelas financeiras
-- ==========================================

-- 1. ADICIONAR CAMPOS DE AUDITORIA EM TABELAS FINANCEIRAS
ALTER TABLE financeiro_contas 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE cofre_movimentacoes
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE vendas_boloes
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
-- deleted_at e deleted_by já foram criados na Sprint 1

ALTER TABLE caixa_movimentacoes
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 2. FUNÇÃO DE TRIGGER PARA AUDITORIA AUTOMÁTICA
CREATE OR REPLACE FUNCTION public.set_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_by = auth.uid();
        IF TG_TABLE_NAME <> 'caixa_movimentacoes' THEN
            NEW.created_at = COALESCE(NEW.created_at, NOW());
        END IF;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_by = auth.uid();
        NEW.updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APLICAR TRIGGERS NAS TABELAS FINANCEIRAS
DROP TRIGGER IF EXISTS financeiro_contas_audit ON financeiro_contas;
CREATE TRIGGER financeiro_contas_audit
    BEFORE INSERT OR UPDATE ON financeiro_contas
    FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

DROP TRIGGER IF EXISTS cofre_movimentacoes_audit ON cofre_movimentacoes;
CREATE TRIGGER cofre_movimentacoes_audit
    BEFORE INSERT OR UPDATE ON cofre_movimentacoes
    FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

DROP TRIGGER IF EXISTS vendas_boloes_audit ON vendas_boloes;
CREATE TRIGGER vendas_boloes_audit
    BEFORE INSERT OR UPDATE ON vendas_boloes
    FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

DROP TRIGGER IF EXISTS caixa_movimentacoes_audit ON caixa_movimentacoes;
CREATE TRIGGER caixa_movimentacoes_audit
    BEFORE INSERT OR UPDATE ON caixa_movimentacoes
    FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

-- 4. TABELA DE LOG DE AUDITORIA (Para operações críticas)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id BIGINT,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES auth.users(id),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- 5. FUNÇÃO PARA LOG DE ALTERAÇÕES CRÍTICAS
CREATE OR REPLACE FUNCTION public.log_critical_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
        auth.uid()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. APLICAR LOG EM OPERAÇÕES CRÍTICAS
DROP TRIGGER IF EXISTS log_financeiro_contas_changes ON financeiro_contas;
CREATE TRIGGER log_financeiro_contas_changes
    AFTER INSERT OR UPDATE OR DELETE ON financeiro_contas
    FOR EACH ROW EXECUTE FUNCTION log_critical_change();

-- 7. RLS para audit_log (apenas admin vê)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_access" ON audit_log;
CREATE POLICY "admin_audit_log_access" ON audit_log
    FOR ALL TO authenticated
    USING (public.is_master());

GRANT SELECT ON audit_log TO authenticated;

-- 8. COMENTÁRIOS
COMMENT ON TABLE audit_log IS 'Log de auditoria para rastreamento de alterações críticas no sistema financeiro.';
COMMENT ON FUNCTION set_audit_fields IS 'Trigger function que preenche automaticamente campos created_by e updated_by.';
COMMENT ON FUNCTION log_critical_change IS 'Trigger function que registra alterações em tabelas críticas no audit_log.';
