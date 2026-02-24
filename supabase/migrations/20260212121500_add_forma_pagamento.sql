-- ===================================================================
-- MIGRATION: ADICIONAR FORMA DE PAGAMENTO E BAIXAR JANEIRO (GRUPO A)
-- Objetivo: 
-- 1. Criar coluna 'forma_pagamento' (se não existir).
-- 2. Identificar e Baixar contas do Grupo A de Janeiro/2026 como 'Depósito Bancário'.
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
    v_count INTEGER;
BEGIN
    -- 1. ADICIONAR COLUNA (Se não existir)
    -- Optamos por TEXT para flexibilidade (Depósito, PIX, Dinheiro, etc)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'financeiro_contas' AND column_name = 'forma_pagamento') THEN
        
        ALTER TABLE public.financeiro_contas ADD COLUMN forma_pagamento TEXT;
        RAISE NOTICE 'Coluna forma_pagamento criada com sucesso.';
    ELSE
        RAISE NOTICE 'Coluna forma_pagamento já existia.';
    END IF;

    -- 2. OBTER ID DA LOJA NATUREZA
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;
    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    -- 3. ATUALIZAR GRUPO A (JANEIRO/2026) -> PAGO / DEPÓSITO BANCÁRIO
    -- Lista de itens do Grupo A
    UPDATE public.financeiro_contas
    SET 
        status = 'pago',
        forma_pagamento = 'Depósito Bancário',
        data_pagamento = data_vencimento -- Assume pago no vencimento
    WHERE 
        loja_id = v_loja_id
        AND EXTRACT(MONTH FROM data_vencimento) = 1
        AND EXTRACT(YEAR FROM data_vencimento) = 2026
        AND item IN (
            'SELOMA', 
            'Plano Corporativo TIM', 
            'Internet', 
            'Simples Nacional', 
            'Vale Transporte', 
            'Téc. Segurança', 
            'Cofre Inteligente', 
            'ChatCase', 
            'Seguro Lot', 
            'Água' 
        );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Total de contas do Grupo A baixadas em Janeiro: %', v_count;

END $$;
