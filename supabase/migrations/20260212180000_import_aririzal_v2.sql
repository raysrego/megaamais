-- Migration: Import Aririzal Financial Data V2
-- Description: Cadastra itens financeiros (categorias) e lança despesas fixas para a filial Aririzal.

DO $$
DECLARE
    v_loja_id UUID;
    v_item_id INTEGER;
    v_mes INTEGER := 1; -- Janeiro
    v_ano INTEGER := 2026;
    v_data_venc DATE;
BEGIN
    -- 1. GARANTIR QUE A FILIAL ARIRIZAL EXISTE EM EMPRESAS (Tabela Real)
    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE nome_fantasia ILIKE '%Aririzal%') THEN
        INSERT INTO public.empresas (nome_fantasia, cidade, uf, ativo)
        VALUES ('Lotérica Aririzal', 'São Luís', 'MA', TRUE);
        RAISE NOTICE 'Empresa (Filial) Aririzal criada automaticamente.';
    END IF;

    -- 2. IDENTIFICAR ID DA EMPRESA
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Aririzal%' LIMIT 1;

    IF v_loja_id IS NULL THEN
        RAISE EXCEPTION 'Loja Aririzal não encontrada!';
    END IF;

    -- ==================================================================================
    -- GRUPO 1: FIXO MENSAL (Cadastrar Categoria + Lançar Janeiro)
    -- ==================================================================================
    
    -- Helper para cadastrar e lançar
    -- Aluguel / 2.907,75 / Dia 05 (Assumido)
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Aluguel', 'despesa', TRUE, 'FIXA', 5, 2907.75, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao, dia_vencimento = EXCLUDED.dia_vencimento
    RETURNING id INTO v_item_id;

    -- Lançamento Janeiro 2026
    v_data_venc := make_date(v_ano, v_mes, 5);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Aluguel', 'Aluguel (01/2026)', 'despesa', 2907.75, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- Contadora / 759,00 / Dia 05 (Assumido)
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Contadora', 'despesa', TRUE, 'FIXA', 5, 759.00, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao
    RETURNING id INTO v_item_id;

    v_data_venc := make_date(v_ano, v_mes, 5);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Contadora', 'Contadora (01/2026)', 'despesa', 759.00, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- Cefor / 2.800,00 / Dia 05 (Assumido)
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Cefor', 'despesa', TRUE, 'FIXA', 5, 2800.00, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao
    RETURNING id INTO v_item_id;

    v_data_venc := make_date(v_ano, v_mes, 5);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Cefor', 'Cefor (01/2026)', 'despesa', 2800.00, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- Fixtel (Internet) / 110,00 / todo dia 10
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Fixtel (Internet)', 'despesa', TRUE, 'FIXA', 10, 110.00, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao, dia_vencimento = EXCLUDED.dia_vencimento
    RETURNING id INTO v_item_id;

    v_data_venc := make_date(v_ano, v_mes, 10);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Fixtel (Internet)', 'Fixtel (Internet) (01/2026)', 'despesa', 110.00, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- Téc. Segurança / 50,00 / todo dia 15
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Téc. Segurança', 'despesa', TRUE, 'FIXA', 15, 50.00, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao, dia_vencimento = EXCLUDED.dia_vencimento
    RETURNING id INTO v_item_id;

    v_data_venc := make_date(v_ano, v_mes, 15);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Téc. Segurança', 'Téc. Segurança (01/2026)', 'despesa', 50.00, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- Cofre Inteligente / 1.041,78 / todo dia 07
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Cofre Inteligente', 'despesa', TRUE, 'FIXA', 7, 1041.78, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao, dia_vencimento = EXCLUDED.dia_vencimento
    RETURNING id INTO v_item_id;

    v_data_venc := make_date(v_ano, v_mes, 7);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Cofre Inteligente', 'Cofre Inteligente (01/2026)', 'despesa', 1041.78, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- Propaganda Muro / 150,00 / todo dia 05
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Propaganda Muro', 'despesa', TRUE, 'FIXA', 5, 150.00, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao, dia_vencimento = EXCLUDED.dia_vencimento
    RETURNING id INTO v_item_id;

    v_data_venc := make_date(v_ano, v_mes, 5);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Propaganda Muro', 'Propaganda Muro (01/2026)', 'despesa', 150.00, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- Tokio Marine / 727,49 / todo dia 07
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id)
    VALUES ('Tokio Marine', 'despesa', TRUE, 'FIXA', 7, 727.49, v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET valor_padrao = EXCLUDED.valor_padrao, dia_vencimento = EXCLUDED.dia_vencimento
    RETURNING id INTO v_item_id;

    v_data_venc := make_date(v_ano, v_mes, 7);
    IF NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE loja_id = v_loja_id AND item_financeiro_id = v_item_id AND data_vencimento = v_data_venc) THEN
        INSERT INTO financeiro_contas (loja_id, item_financeiro_id, item, descricao, tipo, valor, data_vencimento, status, recorrente, frequencia)
        VALUES (v_loja_id, v_item_id, 'Tokio Marine', 'Tokio Marine (01/2026)', 'despesa', 727.49, v_data_venc, 'pendente', TRUE, 'mensal');
    END IF;

    -- ==================================================================================
    -- GRUPO 2: FIXO VARIÁVEL (Apenas Cadastrar Categoria)
    -- ==================================================================================
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, loja_id) VALUES
    ('Água', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('IOCS', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('IOC', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('Luz', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('GPS', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('FGTS', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('ISSQN', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('TFL', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('Folha de Pag.', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('Simples Nacional', 'despesa', TRUE, 'VARIAVEL', v_loja_id),
    ('Vale Transporte', 'despesa', TRUE, 'VARIAVEL', v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET tipo_recorrencia = 'VARIAVEL', fixo = TRUE;

    -- ==================================================================================
    -- GRUPO 3: VARIÁVEL (Apenas Cadastrar Categoria)
    -- ==================================================================================
    INSERT INTO financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, loja_id) VALUES
    ('Mateus Supermercados', 'despesa', FALSE, 'NENHUMA', v_loja_id),
    ('Alvará 2026', 'despesa', FALSE, 'NENHUMA', v_loja_id),
    ('MKP', 'despesa', FALSE, 'NENHUMA', v_loja_id),
    ('Pag. de Metas', 'despesa', FALSE, 'NENHUMA', v_loja_id),
    ('Bagatela', 'despesa', FALSE, 'NENHUMA', v_loja_id)
    ON CONFLICT (item, loja_id) DO UPDATE SET tipo_recorrencia = 'NENHUMA', fixo = FALSE;

END $$;
