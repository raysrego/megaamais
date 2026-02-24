-- ===================================================================
-- IMPORTAÇÃO DE DADOS FINANCEIROS - GRUPO A (FIXO MENSAL)
-- Filial: Natureza
-- Data: 2026-02-12
-- Correção: Busca ID na tabela 'empresas' (onde os dados reais estão)
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
BEGIN
    -- 1. Obter ID da Loja Natureza (Tabela EMPRESAS)
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;

    -- Fallback se não encontrar (pega a primeira ativa)
    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
        RAISE NOTICE 'Loja Natureza não encontrada por nome em empresas. Usando ID da primeira ativa: %', v_loja_id;
    ELSE
        RAISE NOTICE 'Loja Natureza encontrada em empresas. ID: %', v_loja_id;
    END IF;

    -- 2. Inserir Categorias FIXAS (Grupo A)
    -- O Trigger automatico vai gerar os lançamentos de 2026.

    INSERT INTO public.financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id, ativo)
    VALUES 
    ('SELOMA', 'despesa', TRUE, 'FIXA', 10, 60.00, v_loja_id, TRUE),
    ('Plano Corporativo TIM', 'despesa', TRUE, 'FIXA', 25, 122.53, v_loja_id, TRUE),
    ('Internet', 'despesa', TRUE, 'FIXA', 10, 130.00, v_loja_id, TRUE),
    ('Simples Nacional', 'despesa', TRUE, 'FIXA', 20, 5272.23, v_loja_id, TRUE),
    ('Vale Transporte', 'despesa', TRUE, 'FIXA', 1, 2116.80, v_loja_id, TRUE),
    ('Téc. Segurança', 'despesa', TRUE, 'FIXA', 15, 50.00, v_loja_id, TRUE),
    ('Cofre Inteligente', 'despesa', TRUE, 'FIXA', 7, 1041.78, v_loja_id, TRUE),
    ('ChatCase', 'despesa', TRUE, 'FIXA', 15, 2337.00, v_loja_id, TRUE),
    ('Seguro Lot', 'despesa', TRUE, 'FIXA', 7, 580.60, v_loja_id, TRUE),
    ('Água', 'despesa', TRUE, 'FIXA', 10, 60.00, v_loja_id, TRUE)
    
    ON CONFLICT (item, loja_id) DO UPDATE SET
        valor_padrao = EXCLUDED.valor_padrao,
        dia_vencimento = EXCLUDED.dia_vencimento,
        tipo_recorrencia = 'FIXA',
        fixo = TRUE;

    RAISE NOTICE 'Grupo A importado com sucesso. Lançamentos de 2026 gerados.';
END $$;
