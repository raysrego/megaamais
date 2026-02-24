/**
 * ============================================
 * APLICAR NO SUPABASE CLOUD (SQL EDITOR)
 * ============================================
 * 
 * PASSO A PASSO:
 * 1. Acesse https://supabase.com/dashboard
 * 2. Selecione seu projeto MegaB
 * 3. Vá em "SQL Editor" (menu lateral esquerdo)
 * 4. Cole TODO este código
 * 5. Clique em "RUN" (canto inferior direito)
 * 6. Aguarde confirmação "Success!"
 */

-- ==========================================
-- HABILITAR SUPABASE REALTIME
-- ==========================================

-- 1. Verificar se a publicação existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
        RAISE NOTICE '✅ Publicação supabase_realtime criada';
    ELSE
        RAISE NOTICE 'ℹ️  Publicação supabase_realtime já existe';
    END IF;
END $$;

-- 2. Adicionar tabela financeiro_contas à replicação
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE financeiro_contas;
    RAISE NOTICE '✅ financeiro_contas adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  financeiro_contas já está no Realtime';
END $$;

-- 3. Adicionar tabela caixa_sessoes à replicação
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE caixa_sessoes;
    RAISE NOTICE '✅ caixa_sessoes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  caixa_sessoes já está no Realtime';
END $$;

-- 4. Adicionar tabela boloes à replicação
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE boloes;
    RAISE NOTICE '✅ boloes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  boloes já está no Realtime';
END $$;

-- 5. Adicionar tabela vendas_boloes à replicação
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendas_boloes;
    RAISE NOTICE '✅ vendas_boloes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  vendas_boloes já está no Realtime';
END $$;

-- 6. Adicionar tabela cofre_movimentacoes à replicação
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE cofre_movimentacoes;
    RAISE NOTICE '✅ cofre_movimentacoes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  cofre_movimentacoes já está no Realtime';
END $$;

-- ==========================================
-- VERIFICAR TABELAS HABILITADAS
-- ==========================================
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ==========================================
-- MENSAGEM FINAL
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ REALTIME HABILITADO COM SUCESSO!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📡 Tabelas configuradas para replicação:';
    RAISE NOTICE '   - financeiro_contas';
    RAISE NOTICE '   - caixa_sessoes';
    RAISE NOTICE '   - boloes';
    RAISE NOTICE '   - vendas_boloes';
    RAISE NOTICE '   - cofre_movimentacoes';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Próximo passo:';
    RAISE NOTICE '   1. Recarregue as abas do navegador (F5)';
    RAISE NOTICE '   2. Abra o Console (F12)';
    RAISE NOTICE '   3. Deve aparecer: "✅ [REALTIME] Conectado com sucesso!"';
    RAISE NOTICE '';
END $$;
