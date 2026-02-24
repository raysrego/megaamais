-- ==========================================
-- SPRINT 3 - ENCALHE ATÔMICO VIA RPC
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Garantir atomicidade no processamento de encalhe
-- ==========================================

CREATE OR REPLACE FUNCTION public.processar_encalhe_bolao(
    p_bolao_id BIGINT
) RETURNS JSON AS $$
DECLARE
    v_bolao RECORD;
    v_qtd_encalhe INTEGER;
    v_taxa_encalhe NUMERIC;
    v_custo_base NUMERIC;
    v_valor_total_despesa NUMERIC;
BEGIN
    -- 1. Buscar e bloquear bolão
    SELECT * INTO v_bolao
    FROM boloes
    WHERE id = p_bolao_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bolão ID % não encontrado', p_bolao_id;
    END IF;

    -- Verificar se já foi processado
    IF v_bolao.status = 'sorteio_realizado' THEN
        RETURN json_build_object(
            'success', true,
            'already_processed', true,
            'encalhe', 0
        );
    END IF;

    -- 2. Calcular quantidade de encalhe
    v_qtd_encalhe := v_bolao.qtd_cotas - v_bolao.cotas_vendidas;

    -- 3. Atualizar status do bolão
    UPDATE boloes
    SET status = 'sorteio_realizado'
    WHERE id = p_bolao_id;

    -- 4. Se houver encalhe, processar
    IF v_qtd_encalhe > 0 THEN
        -- Marcar cotas disponíveis como encalhe
        UPDATE cotas_boloes
        SET status = 'encalhe_casa'
        WHERE bolao_id = p_bolao_id
          AND status = 'disponivel';

        -- Obter taxa de encalhe dos parâmetros
        SELECT COALESCE(valor, 65) INTO v_taxa_encalhe
        FROM financeiro_parametros
        WHERE chave = 'custo_encalhe_casa';

        v_taxa_encalhe := v_taxa_encalhe / 100;
        v_custo_base := v_bolao.preco_venda_cota * v_taxa_encalhe;
        v_valor_total_despesa := v_custo_base * v_qtd_encalhe;

        -- Lançar despesa financeira
        INSERT INTO financeiro_contas (
            tipo,
            descricao,
            valor,
            item,
            data_vencimento,
            data_pagamento,
            status,
            recorrente,
            metodo_pagamento
        ) VALUES (
            'despesa',
            format('Encalhe Automático - Bolão #%s (%s) - %s cotas', p_bolao_id, v_bolao.concurso, v_qtd_encalhe),
            v_valor_total_despesa,
            'Encalhe de Jogos',
            CURRENT_DATE,
            NOW(),
            'pago',
            FALSE,
            'dinheiro'
        );
    END IF;

    -- 5. Retornar resultado
    RETURN json_build_object(
        'success', true,
        'already_processed', false,
        'encalhe', v_qtd_encalhe,
        'valor_despesa', COALESCE(v_valor_total_despesa, 0)
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao processar encalhe: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant de execução
GRANT EXECUTE ON FUNCTION public.processar_encalhe_bolao TO authenticated;

COMMENT ON FUNCTION public.processar_encalhe_bolao IS 
'Processa encalhe de bolão de forma atômica, atualizando status do bolão, cotas e registrando despesa financeira automaticamente.';
