/*
  # Fix vender_cotas_bolao Function

  1. Drop Old Function
    - Remove existing function with old signature
    
  2. Create New Function
    - `vender_cotas_bolao` with correct signature and JSON return type
    - Supports both individual and bulk sales
    - Handles comprovante URLs
    - Integrates with caixa_sessoes and caixa_bolao_sessoes
*/

-- Drop the old function if it exists (with any signature variations)
DROP FUNCTION IF EXISTS vender_cotas_bolao(bigint, integer, numeric, text, uuid, uuid, bigint, text, bigint);
DROP FUNCTION IF EXISTS vender_cotas_bolao(bigint, integer, numeric, text, uuid, uuid);
DROP FUNCTION IF EXISTS vender_cotas_bolao;

-- Create the new function with correct signature
CREATE OR REPLACE FUNCTION vender_cotas_bolao(
    p_bolao_id BIGINT,
    p_quantidade INTEGER,
    p_valor_total NUMERIC,
    p_metodo_pagamento TEXT,
    p_usuario_id UUID,
    p_loja_id UUID,
    p_sessao_caixa_id BIGINT DEFAULT NULL,
    p_comprovante_url TEXT DEFAULT NULL,
    p_cota_id BIGINT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_venda_id BIGINT;
    v_cotas_disponiveis INTEGER;
    v_cota_record RECORD;
    v_cotas_marcadas INTEGER := 0;
    v_caixa_bolao_sessao_id INTEGER;
BEGIN
    -- Validate availability
    IF p_cota_id IS NOT NULL THEN
        -- Check if specific cota is available
        SELECT COUNT(*) INTO v_cotas_disponiveis
        FROM cotas_boloes
        WHERE id = p_cota_id 
          AND bolao_id = p_bolao_id 
          AND status = 'disponivel';
        
        IF v_cotas_disponiveis = 0 THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Cota específica não disponível'
            );
        END IF;
    ELSE
        -- Check if enough cotas are available
        SELECT COUNT(*) INTO v_cotas_disponiveis
        FROM cotas_boloes
        WHERE bolao_id = p_bolao_id AND status = 'disponivel';
        
        IF v_cotas_disponiveis < p_quantidade THEN
            RETURN json_build_object(
                'success', false,
                'error', format('Cotas insuficientes. Disponíveis: %s, Solicitadas: %s', v_cotas_disponiveis, p_quantidade)
            );
        END IF;
    END IF;

    -- Get caixa_bolao_sessao_id if exists (user has an open bolao session)
    SELECT id INTO v_caixa_bolao_sessao_id
    FROM caixa_bolao_sessoes
    WHERE responsavel_id = p_usuario_id
      AND status = 'aberto'
    LIMIT 1;
    
    -- Create sale record
    INSERT INTO vendas_boloes (
        bolao_id, 
        sessao_caixa_id, 
        caixa_bolao_sessao_id,
        usuario_id, 
        loja_id,
        quantidade_cotas, 
        valor_total, 
        metodo_pagamento,
        comprovante_url
    ) VALUES (
        p_bolao_id, 
        p_sessao_caixa_id,
        v_caixa_bolao_sessao_id,
        p_usuario_id, 
        p_loja_id,
        p_quantidade, 
        p_valor_total, 
        p_metodo_pagamento::metodo_pagamento_venda,
        p_comprovante_url
    ) RETURNING id INTO v_venda_id;
    
    -- Mark cotas as sold
    IF p_cota_id IS NOT NULL THEN
        -- Sell specific cota
        UPDATE cotas_boloes
        SET status = 'vendida',
            data_venda = NOW(),
            venda_id = v_venda_id
        WHERE id = p_cota_id;
        
        v_cotas_marcadas := 1;
    ELSE
        -- Sell multiple cotas (pessimistic lock)
        FOR v_cota_record IN (
            SELECT id FROM cotas_boloes
            WHERE bolao_id = p_bolao_id AND status = 'disponivel'
            ORDER BY id
            LIMIT p_quantidade
            FOR UPDATE
        ) LOOP
            UPDATE cotas_boloes
            SET status = 'vendida',
                data_venda = NOW(),
                venda_id = v_venda_id
            WHERE id = v_cota_record.id;
            
            v_cotas_marcadas := v_cotas_marcadas + 1;
        END LOOP;
    END IF;
    
    -- Update bolao counter
    UPDATE boloes
    SET cotas_vendidas = cotas_vendidas + v_cotas_marcadas
    WHERE id = p_bolao_id;
    
    -- Register cash movement (if there's a session)
    IF p_sessao_caixa_id IS NOT NULL THEN
        INSERT INTO caixa_movimentacoes (
            sessao_id, 
            tipo, 
            valor, 
            descricao, 
            metodo_pagamento,
            comprovante_url
        ) VALUES (
            p_sessao_caixa_id, 
            'venda', 
            p_valor_total,
            format('Venda de bolão - %s cota(s)', v_cotas_marcadas),
            p_metodo_pagamento,
            p_comprovante_url
        );
    END IF;

    -- Update caixa_bolao_sessao totals if session exists
    IF v_caixa_bolao_sessao_id IS NOT NULL THEN
        UPDATE caixa_bolao_sessoes
        SET total_vendido = total_vendido + p_valor_total,
            total_dinheiro = CASE 
                WHEN p_metodo_pagamento = 'dinheiro' THEN total_dinheiro + p_valor_total
                ELSE total_dinheiro
            END,
            total_pix = CASE 
                WHEN p_metodo_pagamento = 'pix' THEN total_pix + p_valor_total
                ELSE total_pix
            END,
            updated_at = NOW()
        WHERE id = v_caixa_bolao_sessao_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'venda_id', v_venda_id,
        'cotas_vendidas', v_cotas_marcadas
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;