-- ===================================================================
-- Ajuste Final de Segregação e Itens Vitais
-- Data: 2026-02-04
-- Objetivo: Corrigir erro de coluna, migrar dados para Natureza e seedar vitais
-- ===================================================================

-- 1. GARANTIR COLUNA LOJA_ID
ALTER TABLE public.financeiro_itens_plano 
ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.empresas(id);

-- 2. POPULAR COM NATUREZA ANTES DE TORNAR OBRIGATÓRIA (Evita erro 23502)
DO $$
DECLARE
    v_natureza_id UUID;
BEGIN
    SELECT id INTO v_natureza_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;
    IF v_natureza_id IS NULL THEN
        SELECT id INTO v_natureza_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    UPDATE public.financeiro_itens_plano SET loja_id = v_natureza_id WHERE loja_id IS NULL;
END $$;

-- 3. AGORA SIM, TORNAR OBRIGATÓRIA
ALTER TABLE public.financeiro_itens_plano 
ALTER COLUMN loja_id SET NOT NULL;

-- 4. CRIAR CONSTRAINT ÚNICA COMPOSTA (Necessária para o ON CONFLICT)
-- Remove a antiga se existir
ALTER TABLE public.financeiro_itens_plano DROP CONSTRAINT IF EXISTS financeiro_itens_plano_item_key;
ALTER TABLE public.financeiro_itens_plano DROP CONSTRAINT IF EXISTS financeiro_itens_plano_item_loja_key;

-- Adiciona a nova
ALTER TABLE public.financeiro_itens_plano 
ADD CONSTRAINT financeiro_itens_plano_item_loja_key UNIQUE (item, loja_id);

-- 5. REORGANIZAÇÃO DE DATOS E SEED DE VITAIS
DO $$
DECLARE
    v_natureza_id UUID;
    v_empresa RECORD;
BEGIN
    -- Busca o ID da loja Natureza na tabela EMPRESAS
    SELECT id INTO v_natureza_id FROM public.empresas WHERE nome_fantasia ILIKE '%Natureza%' LIMIT 1;
    
    -- Fallback se não encontrar
    IF v_natureza_id IS NULL THEN
        SELECT id INTO v_natureza_id FROM public.empresas WHERE ativo = TRUE LIMIT 1;
    END IF;

    -- A. Mover todos os itens "comuns" para a Natureza
    UPDATE public.financeiro_itens_plano
    SET loja_id = v_natureza_id
    WHERE item NOT IN ('Ágio Bolão (35%)', 'Jogos (8,61%)', 'Encalhe de Jogos');

    -- B. Garantir itens vitais em TODAS as filiais ativas
    FOR v_empresa IN SELECT id FROM public.empresas WHERE ativo = TRUE LOOP
        
        -- Ágio Bolão
        INSERT INTO public.financeiro_itens_plano (item, tipo, fixo, ordem, loja_id)
        VALUES ('Ágio Bolão (35%)', 'receita', FALSE, 1, v_empresa.id)
        ON CONFLICT (item, loja_id) DO NOTHING;
        
        -- Jogos
        INSERT INTO public.financeiro_itens_plano (item, tipo, fixo, ordem, loja_id)
        VALUES ('Jogos (8,61%)', 'receita', FALSE, 2, v_empresa.id)
        ON CONFLICT (item, loja_id) DO NOTHING;

        -- Encalhe
        INSERT INTO public.financeiro_itens_plano (item, tipo, fixo, ordem, loja_id)
        VALUES ('Encalhe de Jogos', 'despesa', FALSE, 20, v_empresa.id)
        ON CONFLICT (item, loja_id) DO NOTHING;

    END LOOP;

    -- C. Limpeza: Remover itens repetidos/comuns de outras lojas (ficam apenas na Natureza)
    DELETE FROM public.financeiro_itens_plano
    WHERE loja_id != v_natureza_id
    AND item NOT IN ('Ágio Bolão (35%)', 'Jogos (8,61%)', 'Encalhe de Jogos');

END $$;

-- 4. ATUALIZAR VIEW DE DASHBOARD SE UTILIZAR ESSA TABELA
-- (Geralmente essa tabela é o plano de contas, não as movimentações, então está ok)
