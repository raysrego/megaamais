-- ===================================================================
-- LIMPEZA TOTAL DE FINANCEIRO E CATEGORIAS NÃO VITAIS
-- Data: 2026-02-05
-- Objetivo: Clean Slate completo no financeiro conforme solicitado.
--           Remove todas as movimentações e deixa apenas categorias de sistema.
-- ===================================================================

-- 1. LIMPAR TODAS AS MOVIMENTAÇÕES FINANCEIRAS (CONTAS A PAGAR/RECEBER)
TRUNCATE TABLE public.financeiro_contas CASCADE;

-- 2. LIMPAR CATEGORIAS (ITENS DO PLANO) - MANTENDO APENAS AS VITAIS DE SISTEMA
-- As vitais são usadas por automações de fechamento de caixa/bolão.
DELETE FROM public.financeiro_itens_plano
WHERE item NOT IN (
    'Ágio Bolão (35%)', 
    'Jogos (8,61%)', 
    'Encalhe de Jogos'
    -- Se houver outras vitais de sistema futuro, adicione aqui.
    -- Exemplos comuns em sistemas de loteria que podem ser necessários:
    -- 'Comissão Operador', 'Diferença de Caixa', etc.
    -- Mas por segurança e pedido estrito, mantemos apenas as hardcoded conhecidas.
);

-- 3. RESETAR SEQUÊNCIAS SE NECESSÁRIO (Opcional, mas limpa IDs)
ALTER SEQUENCE IF EXISTS financeiro_contas_id_seq RESTART WITH 1;
