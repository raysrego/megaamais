-- ===================================================================
-- LIMPEZA DE MOVIMENTAÇÕES - GRUPO B (PREPARAÇÃO PARA LANÇAMENTO MANUAL)
-- Objetivo: Remover qualquer lançamento criado automaticamente para o Grupo B
--           mantendo apenas as CATEGORIAS para uso no Saneamento.
-- ===================================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- 1. Remover lançamentos (movimentações) do Grupo B em 2026
    --    (IOCS, Luz, GPS, FGTS, ISSQN, TFL, Folha de Pag.)
    
    DELETE FROM public.financeiro_contas 
    WHERE item IN ('IOCS', 'Luz', 'GPS', 'FGTS', 'ISSQN', 'TFL', 'Folha de Pag.')
      AND data_vencimento >= '2026-01-01';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Movimentações do Grupo B removidas: %', v_count;

    -- 2. Garantir que as CATEGORIAS continuam lá e ativas
    PERFORM * FROM public.financeiro_itens_plano 
    WHERE item IN ('IOCS', 'Luz', 'GPS', 'FGTS', 'ISSQN', 'TFL', 'Folha de Pag.')
      AND ativo = TRUE;

    RAISE NOTICE 'Categorias verificadas e mantidas. O caminho está limpo para lançamento manual.';
END $$;
