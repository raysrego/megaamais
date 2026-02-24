-- ===================================================================
-- AJUSTE FINAL: OLHO VIVO + CORREÇÃO VISUAL "VARIÁVEL"
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
    v_count_linked INTEGER;
    v_count_olho INTEGER;
BEGIN
    -- 1. OBTER ID DA LOJA
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;
    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    -- ===============================================================
    -- 2. CORREÇÃO "MODALIDADE VARIÁVEL" (VÍNCULO)
    -- O sistema exibe "Variável" sempre que o lançamento não tem o ID da categoria.
    -- Vamos garantir que TODOS os lançamentos tenham esse vínculo.
    -- ===============================================================
    UPDATE public.financeiro_contas c
    SET item_financeiro_id = i.id
    FROM public.financeiro_itens_plano i
    WHERE c.item = i.item 
      AND c.loja_id = i.loja_id
      AND c.item_financeiro_id IS NULL;  -- Só quem ainda está sem vínculo

    GET DIAGNOSTICS v_count_linked = ROW_COUNT;
    RAISE NOTICE 'Modalidade corrigida para % lançamentos.', v_count_linked;

    -- ===============================================================
    -- 3. AJUSTE: OLHO VIVO
    -- Garantir categoria FIXA e Baixar Janeiro
    -- ===============================================================
    
    -- A. Atualizar Categoria
    UPDATE public.financeiro_itens_plano
    SET tipo_recorrencia = 'FIXA', fixo = TRUE
    WHERE item = 'OLHO VIVO' AND loja_id = v_loja_id;

    -- B. Baixar Janeiro 2026 como PAGO (Depósito Bancário)
    UPDATE public.financeiro_contas
    SET 
        status = 'pago',
        forma_pagamento = 'Depósito Bancário',
        data_pagamento = data_vencimento
    WHERE 
        loja_id = v_loja_id
        AND EXTRACT(MONTH FROM data_vencimento) = 1
        AND EXTRACT(YEAR FROM data_vencimento) = 2026
        AND item = 'OLHO VIVO';

    GET DIAGNOSTICS v_count_olho = ROW_COUNT;
    RAISE NOTICE 'Olho Vivo baixado em Janeiro: %', v_count_olho;

END $$;
