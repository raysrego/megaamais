-- ==========================================
-- PRÉ-REQUISITO - LIMPEZA DE DADOS INVÁLIDOS
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Corrigir dados existentes antes de aplicar constraints
-- ==========================================

-- IMPORTANTE: Execute esta migration ANTES da 20260203150000_constraints_integridade.sql

-- DESABILITAR TEMPORARIAMENTE OS TRIGGERS DE AUDITORIA
-- (pois eles tentam setar campos que podem não existir ainda)
-- USER = apenas triggers criados pelo usuário, não triggers de sistema
ALTER TABLE financeiro_contas DISABLE TRIGGER USER;
ALTER TABLE vendas_boloes DISABLE TRIGGER USER;
ALTER TABLE caixa_movimentacoes DISABLE TRIGGER USER;
ALTER TABLE cofre_movimentacoes DISABLE TRIGGER USER;

-- 1. IDENTIFICAR E CORRIGIR financeiro_contas com valor zero ou negativo
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Contar registros problemáticos
    SELECT COUNT(*) INTO v_count
    FROM financeiro_contas
    WHERE valor <= 0;
    
    RAISE NOTICE 'Encontrados % registros em financeiro_contas com valor <= 0', v_count;
    
    -- Opção 1: Deletar registros inválidos (se forem poucos e não importantes)
    -- DELETE FROM financeiro_contas WHERE valor <= 0;
    
    -- Opção 2: Corrigir para valor mínimo (mais seguro)
    UPDATE financeiro_contas
    SET valor = 0.01
    WHERE valor <= 0;
    
    RAISE NOTICE 'Registros corrigidos: %', v_count;
END $$;

-- 2. VERIFICAR E CORRIGIR cotas_vendidas que excedem qtd_cotas
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM boloes
    WHERE cotas_vendidas > qtd_cotas OR cotas_vendidas < 0;
    
    RAISE NOTICE 'Encontrados % bolões com cotas_vendidas inválidas', v_count;
    
    -- Ajustar para o máximo permitido
    UPDATE boloes
    SET cotas_vendidas = LEAST(cotas_vendidas, qtd_cotas)
    WHERE cotas_vendidas > qtd_cotas;
    
    -- Corrigir negativos
    UPDATE boloes
    SET cotas_vendidas = 0
    WHERE cotas_vendidas < 0;
END $$;

-- 3. CORRIGIR valores de caixa negativos (onde não deveriam ser)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM caixa_sessoes
    WHERE valor_inicial < 0;
    
    RAISE NOTICE 'Encontradas % sessões de caixa com valor_inicial negativo', v_count;
    
    UPDATE caixa_sessoes
    SET valor_inicial = 0
    WHERE valor_inicial < 0;
END $$;

-- 4. CORRIGIR vendas com quantidade ou valor zero/negativo
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM vendas_boloes
    WHERE quantidade_cotas <= 0 OR valor_total <= 0;
    
    RAISE NOTICE 'Encontradas % vendas com valores inválidos', v_count;
    
    -- Estas são mais críticas - marcar como deletadas ao invés de corrigir
    UPDATE vendas_boloes
    SET deleted_at = NOW(),
        deleted_by = (SELECT id FROM auth.users LIMIT 1) -- Usar primeiro admin
    WHERE quantidade_cotas <= 0 OR valor_total <= 0;
END $$;

-- 5. CORRIGIR bolões com preços inválidos
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM boloes
    WHERE preco_venda_cota <= 0 OR valor_cota_base <= 0;
    
    RAISE NOTICE 'Encontrados % bolões com preços inválidos', v_count;
    
    -- Corrigir para valor mínimo
    UPDATE boloes
    SET preco_venda_cota = 1.00
    WHERE preco_venda_cota <= 0;
    
    UPDATE boloes
    SET valor_cota_base = 0.50
    WHERE valor_cota_base <= 0;
END $$;

-- 6. CORRIGIR taxa administrativa inválida
DO $$
BEGIN
    UPDATE boloes
    SET taxa_administrativa = 0
    WHERE taxa_administrativa < 0;
    
    UPDATE boloes
    SET taxa_administrativa = 100
    WHERE taxa_administrativa > 100;
END $$;

-- 7. CORRIGIR produtos com dezenas inválidas
DO $$
BEGIN
    UPDATE produtos
    SET min_dezenas = 1
    WHERE min_dezenas <= 0;
    
    UPDATE produtos
    SET max_dezenas = min_dezenas
    WHERE max_dezenas < min_dezenas;
END $$;

-- 8. CORRIGIR cofre com valores inválidos
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM cofre_movimentacoes
    WHERE valor <= 0;
    
    RAISE NOTICE 'Encontradas % movimentações de cofre com valor <= 0', v_count;
    
    -- Cofre pode ter valores negativos para saídas, mas não zero
    UPDATE cofre_movimentacoes
    SET valor = 0.01
    WHERE valor = 0;
    
    -- Garantir que saídas sejam positivas (o tipo já indica entrada/saída)
    UPDATE cofre_movimentacoes
    SET valor = ABS(valor)
    WHERE valor < 0;
END $$;

-- 9. GARANTIR NOT NULLs importantes antes de aplicar constraint
DO $$
BEGIN
    -- Marcar cotas órfãs para exclusão se existirem
    UPDATE cotas_boloes
    SET status = 'cancelada'
    WHERE bolao_id IS NULL;
    
    -- Deletar cotas sem bolão (não deveriam existir)
    DELETE FROM cotas_boloes WHERE bolao_id IS NULL;
    
    -- Corrigir status NULL
    UPDATE cotas_boloes
    SET status = 'disponivel'
    WHERE status IS NULL;
END $$;

-- 10. RELATÓRIO FINAL
DO $$
DECLARE
    v_financeiro_invalid INTEGER;
    v_boloes_invalid INTEGER;
    v_vendas_invalid INTEGER;
    v_caixa_invalid INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_financeiro_invalid FROM financeiro_contas WHERE valor <= 0;
    SELECT COUNT(*) INTO v_boloes_invalid FROM boloes WHERE qtd_cotas <= 0 OR preco_venda_cota <= 0;
    SELECT COUNT(*) INTO v_vendas_invalid FROM vendas_boloes WHERE quantidade_cotas <= 0 OR valor_total <= 0;
    SELECT COUNT(*) INTO v_caixa_invalid FROM caixa_sessoes WHERE valor_inicial < 0;
    
    RAISE NOTICE '=== RELATÓRIO DE LIMPEZA ===';
    RAISE NOTICE 'Financeiro com valor inválido: %', v_financeiro_invalid;
    RAISE NOTICE 'Bolões com dados inválidos: %', v_boloes_invalid;
    RAISE NOTICE 'Vendas com dados inválidos: %', v_vendas_invalid;
    RAISE NOTICE 'Caixas com valor inicial negativo: %', v_caixa_invalid;
    
    IF v_financeiro_invalid > 0 OR v_boloes_invalid > 0 OR v_vendas_invalid > 0 OR v_caixa_invalid > 0 THEN
        RAISE EXCEPTION 'Ainda existem dados inválidos após limpeza. Verifique manualmente.';
    ELSE
        RAISE NOTICE 'Todos os dados foram corrigidos com sucesso!';
    END IF;
END $$;

-- REABILITAR OS TRIGGERS DE AUDITORIA
ALTER TABLE financeiro_contas ENABLE TRIGGER USER;
ALTER TABLE vendas_boloes ENABLE TRIGGER USER;
ALTER TABLE caixa_movimentacoes ENABLE TRIGGER USER;
ALTER TABLE cofre_movimentacoes ENABLE TRIGGER USER;

-- Migration de limpeza concluída com sucesso
