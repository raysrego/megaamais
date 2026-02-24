-- ===================================================================
-- CORREÇÃO: MODALIDADE (LINKAGE) E BAIXA DE ITENS ESPECÍFICOS
-- 1. Corrige a "Modalidade Variável" vinculando as contas às categorias por nome.
-- 2. Atualiza CEFOR, CONTADORA, ALUGUEL e TIM para 'Pago/Depósito' em Janeiro.
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
    v_count_linked INTEGER;
    v_count_paid INTEGER;
BEGIN
    -- 1. OBTER ID DA LOJA
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;
    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    -- ===============================================================
    -- 2. CORREÇÃO DA MODALIDADE (VÍNCULO)
    -- O sistema exibe "Variável" quando não encontra a categoria vinculada.
    -- Vamos vincular pelo NOME tudo que estiver solto.
    -- ===============================================================
    UPDATE public.financeiro_contas c
    SET item_financeiro_id = i.id
    FROM public.financeiro_itens_plano i
    WHERE c.item = i.item 
      AND c.loja_id = i.loja_id
      AND c.item_financeiro_id IS NULL;

    GET DIAGNOSTICS v_count_linked = ROW_COUNT;
    RAISE NOTICE 'Transações vinculadas às categorias (Corrigindo Modalidade): %', v_count_linked;


    -- ===============================================================
    -- 3. GARANTIR QUE SÃO FIXO MENSAL NA CATEGORIA
    -- ===============================================================
    UPDATE public.financeiro_itens_plano
    SET tipo_recorrencia = 'FIXA', fixo = TRUE
    WHERE item IN ('CEFOR', 'CONTADORA', 'ALUGUEL', 'Plano Corporativo TIM')
      AND loja_id = v_loja_id;


    -- ===============================================================
    -- 4. BAIXAR ITENS DE JANEIRO (Depósito Bancário)
    -- ===============================================================
    UPDATE public.financeiro_contas
    SET 
        status = 'pago',
        forma_pagamento = 'Depósito Bancário',
        data_pagamento = data_vencimento
    WHERE 
        loja_id = v_loja_id
        AND EXTRACT(MONTH FROM data_vencimento) = 1
        AND EXTRACT(YEAR FROM data_vencimento) = 2026
        AND item IN ('CEFOR', 'CONTADORA', 'ALUGUEL', 'Plano Corporativo TIM');

    GET DIAGNOSTICS v_count_paid = ROW_COUNT;
    RAISE NOTICE 'Itens específicos baixados em Janeiro: %', v_count_paid;

END $$;
