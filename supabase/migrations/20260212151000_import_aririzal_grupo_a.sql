-- ===================================================================
-- IMPORTAÇÃO DADOS FINANCEIROS - FILIAL ARIRIZAL
-- GRUPO A: Fixo Mensal (Categorias + Lançamentos Jan/2026)
-- CORREÇÃO: Adicionado campo 'descricao' obrigatório
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
    v_categoria_id BIGINT;
BEGIN
    -- 1. OBTER ID DA LOJA (Garantir Sincronia Empresas -> Lojas)
    -- Tenta pegar de lojas
    SELECT id INTO v_loja_id FROM public.lojas WHERE nome_fantasia ILIKE '%Aririzal%' LIMIT 1;
    
    -- Se nao existir em lojas, pega de empresas e insere
    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Aririzal%' LIMIT 1;
        
        IF v_loja_id IS NOT NULL THEN
            INSERT INTO public.lojas (id, nome_fantasia, ativo)
            SELECT id, nome_fantasia, ativo FROM public.empresas WHERE id = v_loja_id
            ON CONFLICT (id) DO NOTHING;
        ELSE
            RAISE EXCEPTION 'Filial Aririzal não encontrada em Empresas nem Lojas.';
        END IF;
    END IF;

    RAISE NOTICE 'Utilizando Loja ID: %', v_loja_id;

    -- ===============================================================
    -- 2. CADASTRAR CATEGORIAS E LANÇAR JANEIRO
    -- ===============================================================

    -- Função auxiliar para criar e lançar
    -- Parâmetros: Nome, Valor, DiaVencimento
    
    -- 2.1 Vale Transporte (Dia 01 - R$ 2.116,80)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Vale Transporte', 'despesa', TRUE, 'FIXA', 1, 2116.80, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Vale Transporte', 2116.80, 'despesa', '2026-01-01', 'pendente', TRUE, 'Vale Transporte (01/2026)');


    -- 2.2 Cofre Inteligente (Dia 07 - R$ 1.041,78)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Cofre Inteligente', 'despesa', TRUE, 'FIXA', 7, 1041.78, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Cofre Inteligente', 1041.78, 'despesa', '2026-01-07', 'pendente', TRUE, 'Cofre Inteligente (01/2026)');


    -- 2.3 Seguro Lot (Dia 07 - R$ 580,60)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Seguro Lot', 'despesa', TRUE, 'FIXA', 7, 580.60, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Seguro Lot', 580.60, 'despesa', '2026-01-07', 'pendente', TRUE, 'Seguro Lot (01/2026)');


    -- 2.4 SELOMA (Dia 10 - R$ 60,00)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'SELOMA', 'despesa', TRUE, 'FIXA', 10, 60.00, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'SELOMA', 60.00, 'despesa', '2026-01-10', 'pendente', TRUE, 'SELOMA (01/2026)');


    -- 2.5 Internet (Dia 10 - R$ 130,00)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Internet', 'despesa', TRUE, 'FIXA', 10, 130.00, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Internet', 130.00, 'despesa', '2026-01-10', 'pendente', TRUE, 'Internet (01/2026)');


    -- 2.6 Água (Dia 10 - R$ 60,00)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Água', 'despesa', TRUE, 'FIXA', 10, 60.00, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Água', 60.00, 'despesa', '2026-01-10', 'pendente', TRUE, 'Água (01/2026)');


    -- 2.7 Téc. Segurança (Dia 15 - R$ 50,00)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Téc. Segurança', 'despesa', TRUE, 'FIXA', 15, 50.00, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Téc. Segurança', 50.00, 'despesa', '2026-01-15', 'pendente', TRUE, 'Téc. Segurança (01/2026)');


    -- 2.8 ChatCase (Dia 15 - R$ 2.337,00)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'ChatCase', 'despesa', TRUE, 'FIXA', 15, 2337.00, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'ChatCase', 2337.00, 'despesa', '2026-01-15', 'pendente', TRUE, 'ChatCase (01/2026)');


    -- 2.9 Simples Nacional (Dia 20 - R$ 5.272,23)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Simples Nacional', 'despesa', TRUE, 'FIXA', 20, 5272.23, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Simples Nacional', 5272.23, 'despesa', '2026-01-20', 'pendente', TRUE, 'Simples Nacional (01/2026)');


    -- 2.10 Plano Corporativo TIM (Dia 25 - R$ 122,53)
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, ativo, arquivado)
    VALUES (v_loja_id, 'Plano Corporativo TIM', 'despesa', TRUE, 'FIXA', 25, 122.53, TRUE, FALSE)
    RETURNING id INTO v_categoria_id;

    INSERT INTO public.financeiro_contas (loja_id, item_financeiro_id, item, valor, tipo, data_vencimento, status, recorrente, descricao)
    VALUES (v_loja_id, v_categoria_id, 'Plano Corporativo TIM', 122.53, 'despesa', '2026-01-25', 'pendente', TRUE, 'Plano Corporativo TIM (01/2026)');


    RAISE NOTICE 'Grupo A cadastrado com sucesso!';
END $$;
