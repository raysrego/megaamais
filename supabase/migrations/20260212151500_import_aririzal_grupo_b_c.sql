-- ===================================================================
-- IMPORTAÇÃO DADOS FINANCEIROS - FILIAL ARIRIZAL
-- GRUPO B e C: Cadastros Apenas (Para Lançamento Manual)
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
BEGIN
    -- 1. OBTER ID DA LOJA
    SELECT id INTO v_loja_id FROM public.lojas WHERE nome_fantasia ILIKE '%Aririzal%' LIMIT 1;
    IF v_loja_id IS NULL THEN
        RAISE EXCEPTION 'Filial Aririzal não encontrada. Rode o script do Grupo A primeiro.';
    END IF;

    -- ===============================================================
    -- GRUPO B: FIXO VARIÁVEL (tipo_recorrencia = 'VARIAVEL', fixo = TRUE)
    -- ===============================================================
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, ativo, arquivado)
    VALUES 
        (v_loja_id, 'IOC', 'despesa', TRUE, 'VARIAVEL', TRUE, FALSE),
        (v_loja_id, 'Luz', 'despesa', TRUE, 'VARIAVEL', TRUE, FALSE),
        (v_loja_id, 'GPS', 'despesa', TRUE, 'VARIAVEL', TRUE, FALSE),
        (v_loja_id, 'FGTS', 'despesa', TRUE, 'VARIAVEL', TRUE, FALSE),
        (v_loja_id, 'ISSQN', 'despesa', TRUE, 'VARIAVEL', TRUE, FALSE),
        (v_loja_id, 'TFL', 'despesa', TRUE, 'VARIAVEL', TRUE, FALSE),
        (v_loja_id, 'Folha de Pag.', 'despesa', TRUE, 'VARIAVEL', TRUE, FALSE);

    RAISE NOTICE 'Grupo B cadastrado.';

    -- ===============================================================
    -- GRUPO C: VARIÁVEL (tipo_recorrencia = 'NENHUMA', fixo = FALSE)
    -- ===============================================================
    INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, ativo, arquivado)
    VALUES 
        (v_loja_id, 'Almoço de Carlos Ed.', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Mateus Supermercados', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Mega Flex', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Eletricista', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Alvará 2026', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Patrícia', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Triunfo Papeis', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'MKP', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'André/Any', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Boleto André/Luciana', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Pag. de Metas', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'André/Kalisson', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE),
        (v_loja_id, 'Cartão Guilherme', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE);
        
    -- OBS: 'Encalhe' verificado se ja existe
    IF NOT EXISTS (SELECT 1 FROM public.financeiro_itens_plano WHERE item = 'Encalhe' AND loja_id = v_loja_id) THEN
         INSERT INTO public.financeiro_itens_plano (loja_id, item, tipo, fixo, tipo_recorrencia, ativo, arquivado)
         VALUES (v_loja_id, 'Encalhe', 'despesa', FALSE, 'NENHUMA', TRUE, FALSE);
    END IF;

    RAISE NOTICE 'Grupo C cadastrado.';
END $$;
