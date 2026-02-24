-- ===================================================================
-- Sincronização de Loja em Vendas e Cotas
-- Data: 2026-02-04
-- Objetivo: Facilitar isolamento e performance de auditoria
-- ===================================================================

-- 1. ADICIONAR LOJA_ID EM VENDAS_BOLOES
ALTER TABLE public.vendas_boloes 
ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id);

-- 2. POPULAR LOJA_ID EM VENDAS EXISTENTES VIA SESSÃO DE CAIXA
UPDATE public.vendas_boloes v
SET loja_id = cs.loja_id
FROM public.caixa_sessoes cs
WHERE v.sessao_caixa_id = cs.id;

-- 3. ATUALIZAR FUNÇÃO REGISTRAR_VENDA_BOLAO PARA SALVAR LOJA_ID
CREATE OR REPLACE FUNCTION public.registrar_venda_bolao(
    p_bolao_id BIGINT,
    p_sessao_caixa_id BIGINT,
    p_usuario_id UUID,
    p_quantidade_cotas INTEGER,
    p_valor_total NUMERIC,
    p_metodo_pagamento TEXT
) RETURNS BIGINT AS $$
DECLARE
    v_venda_id BIGINT;
    v_cota_ids BIGINT[];
    v_valor_unitario NUMERIC;
    v_loja_id UUID;
BEGIN
    -- Obter loja_id da sessão de caixa
    SELECT loja_id INTO v_loja_id FROM public.caixa_sessoes WHERE id = p_sessao_caixa_id;

    -- Validações iniciais
    IF p_quantidade_cotas <= 0 THEN
        RAISE EXCEPTION 'Quantidade de cotas deve ser maior que zero';
    END IF;

    IF p_valor_total <= 0 THEN
        RAISE EXCEPTION 'Valor total deve ser maior que zero';
    END IF;

    -- Validar se a sessão de caixa está aberta
    IF NOT EXISTS (
        SELECT 1 FROM caixa_sessoes 
        WHERE id = p_sessao_caixa_id 
        AND status = 'aberto'
    ) THEN
        RAISE EXCEPTION 'Sessão de caixa não está aberta';
    END IF;

    -- 1. Bloquear cotas disponíveis
    SELECT ARRAY_AGG(id) INTO v_cota_ids
    FROM (
        SELECT id 
        FROM cotas_boloes
        WHERE bolao_id = p_bolao_id 
          AND status = 'disponivel'
        ORDER BY id
        LIMIT p_quantidade_cotas
        FOR UPDATE SKIP LOCKED
    ) sub;

    IF v_cota_ids IS NULL OR ARRAY_LENGTH(v_cota_ids, 1) < p_quantidade_cotas THEN
        RAISE EXCEPTION 'Cotas insuficientes disponíveis.';
    END IF;

    v_valor_unitario := p_valor_total / p_quantidade_cotas;

    -- 2. Atualizar status das cotas
    UPDATE cotas_boloes
    SET 
        status = 'vendida', 
        data_venda = NOW(), 
        valor_venda = v_valor_unitario,
        forma_pagamento = p_metodo_pagamento
    WHERE id = ANY(v_cota_ids);

    -- 3. Incrementar contador do bolão
    UPDATE boloes
    SET cotas_vendidas = cotas_vendidas + p_quantidade_cotas
    WHERE id = p_bolao_id;

    -- 4. Registrar venda com LOJA_ID
    INSERT INTO vendas_boloes (
        bolao_id, 
        sessao_caixa_id, 
        usuario_id, 
        loja_id, -- NOVA COLUNA
        quantidade_cotas, 
        valor_total, 
        metodo_pagamento
    )
    VALUES (
        p_bolao_id, 
        p_sessao_caixa_id, 
        p_usuario_id, 
        v_loja_id, -- VALOR OBTIDO DA SESSÃO
        p_quantidade_cotas, 
        p_valor_total, 
        p_metodo_pagamento::metodo_pagamento_venda
    )
    RETURNING id INTO v_venda_id;

    -- 5. Registrar movimentação no caixa
    INSERT INTO caixa_movimentacoes (
        sessao_id, 
        tipo, 
        valor, 
        descricao, 
        metodo_pagamento, 
        referencia_id
    )
    VALUES (
        p_sessao_caixa_id, 
        'venda_bolao', 
        p_valor_total, 
        'Venda de Bolão #' || p_bolao_id || ' (' || p_quantidade_cotas || ' cotas)', 
        p_metodo_pagamento, 
        'venda_' || v_venda_id
    );

    -- 6. Atualizar valor_final_calculado da sessão
    UPDATE caixa_sessoes
    SET valor_final_calculado = valor_final_calculado + p_valor_total
    WHERE id = p_sessao_caixa_id;

    RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql;
