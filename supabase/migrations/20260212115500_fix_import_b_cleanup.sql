-- ===================================================================
-- CORREÇÃO E LIMPEZA GERAL
-- 1. Remove dados legados/indesejados (FIXEL, TOKIO)
-- 2. Força a geração de recorrências para o Grupo B (Variável)
-- 3. Reaplica os valores reais de Janeiro/2026
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
    v_ano INTEGER := 2026;
    v_mes INTEGER := 1; -- Janeiro
    v_total_removido INTEGER;
    v_total_gerado INTEGER;
BEGIN
    -- ===============================================================
    -- 1. LIMPEZA DOS "FANTASMAS" (FIXEL, TOKIO)
    -- ===============================================================
    
    -- Primeiro remove da tabela de contas (filhos)
    DELETE FROM public.financeiro_contas 
    WHERE item ILIKE '%FIXEL%' OR item ILIKE '%TOKIO%';
    
    -- Depois remove da tabela de itens (pais)
    DELETE FROM public.financeiro_itens_plano 
    WHERE item ILIKE '%FIXEL%' OR item ILIKE '%TOKIO%';
    
    GET DIAGNOSTICS v_total_removido = ROW_COUNT;
    RAISE NOTICE 'Itens legados removidos: %', v_total_removido;


    -- ===============================================================
    -- 2. CORREÇÃO GRUPO B (GERAR RECORRÊNCIAS)
    -- O Trigger automático só estava pegando 'FIXA'. Vamos forçar a geração.
    -- ===============================================================
    
    -- Chama a função que varre todos os itens (FIXA e VARIAVEL) e gera o que falta
    SELECT * INTO v_total_gerado FROM public.processar_recorrencias_financeiras();
    
    RAISE NOTICE 'Recorrências processadas/geradas: %', v_total_gerado;


    -- ===============================================================
    -- 3. RE-APLICAR VALORES REAIS DE JANEIRO (GRUPO B)
    -- Como acabamos de gerar os registros (que nascem zerados), precisamos atualizar.
    -- ===============================================================

    -- Obter ID da Loja Natureza (Empresas)
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;
    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    -- Update: IOCS
    UPDATE public.financeiro_contas SET valor = 250.00, data_vencimento = '2026-01-10', status = 'pago'
    WHERE item = 'IOCS' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Update: Luz
    UPDATE public.financeiro_contas SET valor = 1182.58, data_vencimento = '2026-01-10', status = 'pago'
    WHERE item = 'Luz' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Update: GPS
    UPDATE public.financeiro_contas SET valor = 1402.21, data_vencimento = '2026-01-20', status = 'pago'
    WHERE item = 'GPS' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Update: FGTS
    UPDATE public.financeiro_contas SET valor = 1450.61, data_vencimento = '2026-01-20', status = 'pago'
    WHERE item = 'FGTS' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Update: ISSQN
    UPDATE public.financeiro_contas SET valor = 2167.28, data_vencimento = '2026-01-05', status = 'pago'
    WHERE item = 'ISSQN' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Update: TFL
    UPDATE public.financeiro_contas SET valor = 14.65, data_vencimento = '2026-01-05', status = 'pago'
    WHERE item = 'TFL' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Update: Folha de Pag.
    UPDATE public.financeiro_contas SET valor = 10015.13, data_vencimento = '2026-01-07', status = 'pago'
    WHERE item = 'Folha de Pag.' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    RAISE NOTICE 'Correção concluída com sucesso!';
END $$;
