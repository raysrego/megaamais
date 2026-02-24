-- ===================================================================
-- IMPORTAÇÃO DE DADOS FINANCEIROS - GRUPO B (FIXO VARIÁVEL)
-- Filial: Natureza
-- Data: 2026-02-12
-- Estratégia:
-- 1. Inserir Categorias (Recorrência 'VARIAVEL') -> Trigger gera Jan-Dez zerados
-- 2. Update nos lançamentos de Janeiro/2026 com os valores reais
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
    v_ano INTEGER := 2026;
    v_mes INTEGER := 1; -- Janeiro
BEGIN
    -- 1. Obter ID da Loja Natureza
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;

    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    RAISE NOTICE 'Importando Grupo B para Loja ID: %', v_loja_id;

    -- 2. Inserir Categorias (Trigger vai gerar lançamentos zerados)
    INSERT INTO public.financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id, ativo)
    VALUES 
    ('IOCS', 'despesa', TRUE, 'VARIAVEL', 10, 0, v_loja_id, TRUE),
    ('Luz', 'despesa', TRUE, 'VARIAVEL', 10, 0, v_loja_id, TRUE),
    ('GPS', 'despesa', TRUE, 'VARIAVEL', 20, 0, v_loja_id, TRUE),
    ('FGTS', 'despesa', TRUE, 'VARIAVEL', 20, 0, v_loja_id, TRUE),
    ('ISSQN', 'despesa', TRUE, 'VARIAVEL', 5, 0, v_loja_id, TRUE),
    ('TFL', 'despesa', TRUE, 'VARIAVEL', 5, 0, v_loja_id, TRUE),
    ('Folha de Pag.', 'despesa', TRUE, 'VARIAVEL', 7, 0, v_loja_id, TRUE)
    
    ON CONFLICT (item, loja_id) DO UPDATE SET
        tipo_recorrencia = 'VARIAVEL',
        fixo = TRUE; -- Garante que é tratado como fixo variável

    RAISE NOTICE 'Categorias Grupo B criadas.';

    -- 3. Atualizar VALORES REAIS de Janeiro/2026
    -- O trigger já deve ter criado os registros com valor 0. Vamos atualizar.

    -- IOCS: 250,00 (Venc 10/01)
    UPDATE public.financeiro_contas SET valor = 250.00, data_vencimento = '2026-01-10', status = 'pago'
    WHERE item = 'IOCS' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Luz: 1.182,58 (Venc 10/01)
    UPDATE public.financeiro_contas SET valor = 1182.58, data_vencimento = '2026-01-10', status = 'pago'
    WHERE item = 'Luz' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- GPS: 1.402,21 (Venc 20/01)
    UPDATE public.financeiro_contas SET valor = 1402.21, data_vencimento = '2026-01-20', status = 'pago'
    WHERE item = 'GPS' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- FGTS: 1.450,61 (Venc 20/01)
    UPDATE public.financeiro_contas SET valor = 1450.61, data_vencimento = '2026-01-20', status = 'pago'
    WHERE item = 'FGTS' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- ISSQN: 2.167,28 (Venc 05/01)
    UPDATE public.financeiro_contas SET valor = 2167.28, data_vencimento = '2026-01-05', status = 'pago'
    WHERE item = 'ISSQN' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- TFL: 14,65 (Venc 05/01)
    UPDATE public.financeiro_contas SET valor = 14.65, data_vencimento = '2026-01-05', status = 'pago'
    WHERE item = 'TFL' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    -- Folha de Pag.: 10.015,13 (Venc 07/01)
    UPDATE public.financeiro_contas SET valor = 10015.13, data_vencimento = '2026-01-07', status = 'pago'
    WHERE item = 'Folha de Pag.' AND loja_id = v_loja_id AND EXTRACT(MONTH FROM data_vencimento) = v_mes AND EXTRACT(YEAR FROM data_vencimento) = v_ano;

    RAISE NOTICE 'Valores de Janeiro/2026 atualizados para o Grupo B.';
END $$;
