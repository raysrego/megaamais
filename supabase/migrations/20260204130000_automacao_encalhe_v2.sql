-- ===================================================================
-- SPRINT 5: AUTOMAÇÃO DE ENCALHE & SEGURANÇA MULTI-LOJA
-- Data: 2026-02-04
-- Objetivo: Robustecer o processamento de encalhe para ser multi-loja safe 
--           e criar rotina de processamento em lote.
-- ===================================================================

-- 1. REFATORAR RPC ATÔMICA (Mais segura e completa)
CREATE OR REPLACE FUNCTION public.processar_encalhe_bolao(
    p_bolao_id BIGINT
) RETURNS JSON AS $$
DECLARE
    v_bolao RECORD;
    v_qtd_encalhe INTEGER;
    v_taxa_encalhe NUMERIC;
    v_custo_base NUMERIC;
    v_valor_total_despesa NUMERIC;
    v_loja_id UUID;
BEGIN
    -- 1. Buscar e bloquear bolão (FOR UPDATE)
    SELECT * INTO v_bolao
    FROM boloes
    WHERE id = p_bolao_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
    END IF;

    v_loja_id := v_bolao.loja_id;

    -- 2. Validar Estado
    IF v_bolao.status = 'finalizado' OR v_bolao.status = 'cancelado' THEN
         RETURN json_build_object(
            'success', true,
            'already_processed', true,
            'encalhe', 0
        );
    END IF;

    -- Validar Data (Opcional: permitir forçar execução, mas bom ter logica de segurança)
    -- Se data_sorteio >= Hoje, teoricamente ainda pode vender. 
    -- Mas se a função foi chamada, assumimos que é para fechar.
    -- Vamos manter flexível para testes manuais via Admin, mas a batch vai filtrar por data.

    -- 3. Calcular Encalhe
    v_qtd_encalhe := v_bolao.qtd_cotas - v_bolao.cotas_vendidas;

    -- 4. Atualizar Status do Bolão
    UPDATE boloes
    SET status = 'finalizado' -- 'sorteio_realizado' era ambíguo, 'finalizado' é melhor
    WHERE id = p_bolao_id;

    -- 5. Se houver encalhe, processar despesa
    IF v_qtd_encalhe > 0 THEN
        -- A. Marcar cotas como encalhe da casa
        UPDATE cotas_boloes
        SET status = 'encalhe_casa'
        WHERE bolao_id = p_bolao_id
          AND status = 'disponivel';

        -- B. Calcular Valor da Despesa (Custo)
        -- Busca taxa configurada ou usa default 65% (Custo da Aposta na Lotérica)
        SELECT COALESCE((SELECT valor::numeric FROM financeiro_parametros WHERE chave = 'custo_encalhe_casa' LIMIT 1), 65) 
        INTO v_taxa_encalhe;
        
        v_taxa_encalhe := v_taxa_encalhe / 100.0;
        
        -- Custo Base = Preço de Venda * Taxa de Custo (Ex: R$ 10,00 * 0.65 = R$ 6,50 custo real)
        v_custo_base := v_bolao.preco_venda_cota * v_taxa_encalhe;
        v_valor_total_despesa := v_custo_base * v_qtd_encalhe;

        -- C. Inserir Despesa no Financeiro (Com Loja ID Correta!)
        INSERT INTO financeiro_contas (
            tipo,
            descricao,
            valor,
            item,
            data_vencimento,
            data_pagamento,
            status,
            recorrente,
            metodo_pagamento,
            loja_id -- CRÍTICO: Vincular despesa à loja do bolão
        ) VALUES (
            'despesa',
            format('Encalhe Automático - Concurso %s (%s) - %s cotas', v_bolao.concurso, v_bolao.id, v_qtd_encalhe),
            v_valor_total_despesa,
            'Encalhe de Jogos',
            CURRENT_DATE,
            NOW(),
            'pago',
            FALSE,
            'sistema', -- Método especial para não confundir com caixa físico
            v_loja_id
        );
    ELSE
        v_valor_total_despesa := 0;
    END IF;

    RETURN json_build_object(
        'success', true,
        'already_processed', false,
        'encalhe', v_qtd_encalhe,
        'valor_despesa', v_valor_total_despesa,
        'loja_id', v_loja_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Security Definer para garantir permissão de escrita em financeiro

-- 2. NOVA RPC: PROCESSAMENTO EM LOTE (BATCH)
CREATE OR REPLACE FUNCTION public.processar_encalhes_vencidos()
RETURNS JSON AS $$
DECLARE
    v_bolao_rec RECORD;
    v_count_processed INTEGER := 0;
    v_count_errors INTEGER := 0;
    v_total_despesa NUMERIC := 0;
    v_result JSON;
BEGIN
    -- Loop por todos os bolões vencidos (Sorteio < Hoje) E ainda 'disponivel'
    FOR v_bolao_rec IN 
        SELECT id FROM boloes 
        WHERE status = 'disponivel' 
        AND data_sorteio < CURRENT_DATE
    LOOP
        -- Chama a função atômica para cada um
        v_result := public.processar_encalhe_bolao(v_bolao_rec.id);
        
        IF (v_result->>'success')::boolean THEN
            v_count_processed := v_count_processed + 1;
            v_total_despesa := v_total_despesa + (v_result->>'valor_despesa')::numeric;
        ELSE
            v_count_errors := v_count_errors + 1;
        END IF;
    END LOOP;

    RETURN json_build_object(
        'processed', v_count_processed,
        'errors', v_count_errors,
        'total_despesa_generated', v_total_despesa
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION public.processar_encalhe_bolao TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_encalhes_vencidos TO authenticated;
