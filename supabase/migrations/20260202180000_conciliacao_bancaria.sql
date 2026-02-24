-- ==========================================
-- MEGA B - CONCILIAÇÃO BANCÁRIA
-- Versão: 1.0 (2026-02-02)
-- Objetivo: Permitir conferência com extrato real
-- ==========================================

-- 1. Status de Conciliação
ALTER TABLE public.financeiro_transacoes_bancarias 
ADD COLUMN IF NOT EXISTS status_conciliacao TEXT DEFAULT 'pendente' CHECK (status_conciliacao IN ('pendente', 'conciliado', 'divergente')),
ADD COLUMN IF NOT EXISTS data_conciliacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS conciliavel BOOLEAN DEFAULT TRUE;

-- 2. Comentário para clareza
COMMENT ON COLUMN public.financeiro_transacoes_bancarias.status_conciliacao IS 'pendente: ainda não conferido no banco; conciliado: bate com o extrato; divergente: valor ou data não bate';

-- 3. Função para marcar conciliação (Simples)
CREATE OR REPLACE FUNCTION public.conciliar_transacao_bancaria(
    p_transacao_id BIGINT,
    p_usuario_id UUID
) RETURNS void AS $$
BEGIN
    UPDATE public.financeiro_transacoes_bancarias
    SET 
        status_conciliacao = 'conciliado',
        data_conciliacao = NOW()
    WHERE id = p_transacao_id;
END;
$$ LANGUAGE plpgsql;
