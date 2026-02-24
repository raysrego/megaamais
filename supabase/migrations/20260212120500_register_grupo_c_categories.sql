-- ===================================================================
-- CADASTRO DE CATEGORIAS - GRUPO C (VARIÁVEIS / EVENTUAIS)
-- Filial: Natureza
-- Objetivo: Apenas cadastrar os itens no Plano de Contas.
--           Recorrência = 'NENHUMA' (Não gera lançamentos automáticos)
-- Correção: Removido 'Encalhe' (já existente no sistema).
-- ===================================================================

DO $$
DECLARE
    v_loja_id UUID;
BEGIN
    -- 1. Obter ID da Loja Natureza (Tabela EMPRESAS)
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;

    -- Fallback
    IF v_loja_id IS NULL THEN
        SELECT id INTO v_loja_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    RAISE NOTICE 'Cadastrando Grupo C para Loja ID: %', v_loja_id;

    -- 2. Inserir Categorias Eventuais (Sem Encalhe)
    INSERT INTO public.financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, dia_vencimento, valor_padrao, loja_id, ativo)
    VALUES 
    ('Almoço de Carlos Ed.', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Mateus Supermercados', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Mega Flex', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Eletriscista', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Alvará 2026', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Patrícia', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Triunfo Papeis', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('MKP', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('André / Any', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Boleto André/ Luciana', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Pag. de Metas', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('André/Kalisson', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE),
    ('Cartão Guilherme', 'despesa', FALSE, 'NENHUMA', NULL, 0, v_loja_id, TRUE)
    
    ON CONFLICT (item, loja_id) DO UPDATE SET
        tipo_recorrencia = 'NENHUMA',
        fixo = FALSE,
        ativo = TRUE;

    RAISE NOTICE 'Categorias do Grupo C (Eventuais) cadastradas com sucesso.';
END $$;
