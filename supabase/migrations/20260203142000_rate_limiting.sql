-- ==========================================
-- SPRINT 3 - RATE LIMITING & PROTEÇÕES
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Prevenir abuso de criação de usuários e operações sensíveis
-- ==========================================

-- 1. TABELA DE CONTROLE DE RATE LIMITING
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'create_user', 'reset_password', etc
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action ON rate_limit_log(user_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_action ON rate_limit_log(ip_address, action_type, created_at DESC);

-- 2. FUNÇÃO DE VERIFICAÇÃO DE RATE LIMIT
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_max_attempts INTEGER DEFAULT 5,
    p_window_minutes INTEGER DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
    v_attempt_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Contar tentativas no período
    SELECT COUNT(*) INTO v_attempt_count
    FROM rate_limit_log
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND created_at >= v_window_start;
    
    -- Se exceder o limite, retornar FALSE
    IF v_attempt_count >= p_max_attempts THEN
        RETURN FALSE;
    END IF;
    
    -- Registrar tentativa
    INSERT INTO rate_limit_log (user_id, action_type)
    VALUES (p_user_id, p_action_type);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;

-- 3. PROTEÇÃO CONTRA CRIAÇÃO EXCESSIVA DE USUÁRIOS
-- Esta será usada no admin.ts via Server Action

-- 4. LIMPEZA AUTOMÁTICA DE LOGS ANTIGOS (Função auxiliar)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Remove registros com mais de 7 dias
    DELETE FROM rate_limit_log
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. RLS para rate_limit_log
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rate_limit_access" ON rate_limit_log;
CREATE POLICY "admin_rate_limit_access" ON rate_limit_log
    FOR ALL TO authenticated
    USING (public.is_master());

GRANT SELECT ON rate_limit_log TO authenticated;

-- 6. COMENTÁRIOS
COMMENT ON TABLE rate_limit_log IS 'Controle de rate limiting para ações sensíveis do sistema.';
COMMENT ON FUNCTION public.check_rate_limit IS 'Verifica se o usuário excedeu o limite de tentativas em um período de tempo.';
COMMENT ON FUNCTION public.cleanup_rate_limit_logs IS 'Remove logs antigos de rate limiting (executar periodicamente).';
