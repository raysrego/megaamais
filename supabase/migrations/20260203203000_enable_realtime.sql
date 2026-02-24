-- ==========================================
-- SPRINT 7: HABILITAR SUPABASE REALTIME
-- ==========================================
-- Objetivo: Ativar replicação em tempo real para tabelas críticas
-- Permite websocket push notifications instantâneas

-- 1. HABILITAR REALTIME NA TABELA FINANCEIRO_CONTAS
-- Notificações instantâneas quando contas são criadas/atualizadas
ALTER PUBLICATION supabase_realtime ADD TABLE financeiro_contas;

-- 2. HABILITAR REALTIME NA TABELA CAIXA_SESSOES
-- Notificações quando caixas são abertas/fechadas
ALTER PUBLICATION supabase_realtime ADD TABLE caixa_sessoes;

-- 3. HABILITAR REALTIME NA TABELA BOLOES
-- Notificações quando bolões são criados/atualizados
ALTER PUBLICATION supabase_realtime ADD TABLE boloes;

-- 4. HABILITAR REALTIME NA TABELA VENDAS_BOLOES
-- Notificações instantâneas de vendas
ALTER PUBLICATION supabase_realtime ADD TABLE vendas_boloes;

-- 5. HABILITAR REALTIME NA TABELA COFRE_MOVIMENTACOES
-- Notificações de movimentações de cofre
ALTER PUBLICATION supabase_realtime ADD TABLE cofre_movimentacoes;

-- ==========================================
-- LOG DE ATIVAÇÃO
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '✅ Supabase Realtime habilitado para:';
    RAISE NOTICE '   - financeiro_contas (notificações de vencimento)';
    RAISE NOTICE '   - caixa_sessoes (abertura/fechamento)';
    RAISE NOTICE '   - boloes (criação/atualização)';
    RAISE NOTICE '   - vendas_boloes (vendas em tempo real)';
    RAISE NOTICE '   - cofre_movimentacoes (movimentações)';
    RAISE NOTICE '';
    RAISE NOTICE '🔌 Clientes conectados receberão notificações instantâneas via websocket!';
END $$;
