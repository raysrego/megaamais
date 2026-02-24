-- Migration: Fix Aririzal Revenues
-- Description: Insere categorias padrão de RECEITA para a filial Aririzal.
-- Motivo: A migração 20260204100000 moveu todas as categorias globais para Natureza, deixando Aririzal sem receitas.

DO $$
DECLARE
    v_loja_id UUID;
BEGIN
    -- 1. IDENTIFICAR EMPRESA ARIRIZAL
    SELECT id INTO v_loja_id FROM public.empresas WHERE nome_fantasia ILIKE '%Aririzal%' LIMIT 1;

    IF v_loja_id IS NULL THEN
        RAISE EXCEPTION 'Loja Aririzal não encontrada em empresas!';
    END IF;

    -- 2. INSERIR CATEGORIAS DE RECEITA PADRÃO
    INSERT INTO public.financeiro_itens_plano (item, tipo, fixo, tipo_recorrencia, loja_id, ativo)
    VALUES 
    ('Venda de Jogos', 'receita', FALSE, 'NENHUMA', v_loja_id, TRUE),
    ('Venda de Bolões', 'receita', FALSE, 'NENHUMA', v_loja_id, TRUE),
    ('Venda de Produtos', 'receita', FALSE, 'NENHUMA', v_loja_id, TRUE),
    ('Serviços Caixa', 'receita', FALSE, 'NENHUMA', v_loja_id, TRUE),
    ('Aporte de Sócio', 'receita', FALSE, 'NENHUMA', v_loja_id, TRUE),
    ('Estorno', 'receita', FALSE, 'NENHUMA', v_loja_id, TRUE),
    ('Outras Receitas', 'receita', FALSE, 'NENHUMA', v_loja_id, TRUE)
    
    ON CONFLICT (item, loja_id) DO NOTHING;

    RAISE NOTICE 'Categorias de Receita adicionadas para Aririzal.';

END $$;
