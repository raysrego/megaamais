-- ==========================================
-- SPRINT 1 - GAP #1: Venda de Bolão Atômica
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Garantir atomicidade em vendas de bolão
-- ==========================================

-- 1. FUNÇÃO TRANSACIONAL PARA REGISTRAR VENDA DE BOLÃO
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
BEGIN
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

    -- 1. Bloquear cotas disponíveis (FOR UPDATE SKIP LOCKED para evitar race condition)
    -- SKIP LOCKED garante que se outra transação já bloqueou, pulamos para a próxima
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

    -- Verificar se conseguimos bloquear cotas suficientes
    IF v_cota_ids IS NULL OR ARRAY_LENGTH(v_cota_ids, 1) < p_quantidade_cotas THEN
        RAISE EXCEPTION 'Cotas insuficientes disponíveis. Solicitado: %, Disponível: %', 
            p_quantidade_cotas, 
            COALESCE(ARRAY_LENGTH(v_cota_ids, 1), 0);
    END IF;

    -- Calcular valor unitário
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

    -- 4. Registrar venda
    INSERT INTO vendas_boloes (
        bolao_id, 
        sessao_caixa_id, 
        usuario_id, 
        quantidade_cotas, 
        valor_total, 
        metodo_pagamento
    )
    VALUES (
        p_bolao_id, 
        p_sessao_caixa_id, 
        p_usuario_id, 
        p_quantidade_cotas, 
        p_valor_total, 
        p_metodo_pagamento::metodo_pagamento_venda
    )
    RETURNING id INTO v_venda_id;

    -- 5. Registrar movimentação no caixa (SE o tipo existe)
    -- Verifica se o enum tem o valor antes de tentar inserir
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'movimentacao_tipo' 
        AND e.enumlabel = 'venda_bolao'
    ) THEN
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
    ELSE
        -- Fallback para 'venda' genérico
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
            'venda', 
            p_valor_total, 
            'Venda de Bolão #' || p_bolao_id || ' (' || p_quantidade_cotas || ' cotas)', 
            p_metodo_pagamento, 
            'venda_' || v_venda_id
        );
    END IF;

    -- 6. Atualizar valor_final_calculado da sessão
    UPDATE caixa_sessoes
    SET valor_final_calculado = valor_final_calculado + p_valor_total
    WHERE id = p_sessao_caixa_id;

    RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql;

-- 2. GRANT de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.registrar_venda_bolao TO authenticated;

-- 3. Comentário de documentação
COMMENT ON FUNCTION public.registrar_venda_bolao IS 
'Função transacional atômica para registrar venda de bolão.
Garante que cotas, contador do bolão e movimentação de caixa sejam atualizados em uma única transação.
Usa FOR UPDATE SKIP LOCKED para evitar race conditions em vendas simultâneas.';
