-- ===================================================================
-- Fix: Robustez Processamento Recorrências (Multi-Filial)
-- Data: 2026-02-04
-- Objetivo: Garantir que recorrências geradas respeitem a loja_id do item
-- ===================================================================

CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_mes INTEGER;
    v_ano INTEGER;
    v_categoria RECORD;
    v_valor_final NUMERIC;
    v_dia_venc INTEGER;
    v_vencimento_final DATE;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_mes := EXTRACT(MONTH FROM NOW());
    v_ano := EXTRACT(YEAR FROM NOW());
    v_start_date := DATE(v_ano || '-' || LPAD(v_mes::TEXT, 2, '0') || '-01');
    v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Para cada item fixo (recorrente) no plano de contas
    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE fixo = TRUE AND ativo = TRUE
    LOOP
        -- Verificar se já existe lançamento deste item para ESTA LOJA no mês atual
        IF NOT EXISTS (
            SELECT 1 FROM financeiro_contas
            WHERE item = v_categoria.item
              AND loja_id = v_categoria.loja_id
              AND data_vencimento >= v_start_date
              AND data_vencimento <= v_end_date
        ) THEN
            -- Valor padrão do item ou último valor usado na loja
            SELECT valor INTO v_valor_final
            FROM financeiro_contas
            WHERE item = v_categoria.item
              AND loja_id = v_categoria.loja_id
            ORDER BY data_vencimento DESC
            LIMIT 1;

            v_valor_final := COALESCE(v_valor_final, v_categoria.valor_padrao, 0);
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            -- Ajuste de dia do mês
            IF v_dia_venc > EXTRACT(DAY FROM v_end_date) THEN
                v_dia_venc := EXTRACT(DAY FROM v_end_date);
            END IF;

            v_vencimento_final := DATE(v_ano || '-' || LPAD(v_mes::TEXT, 2, '0') || '-' || LPAD(v_dia_venc::TEXT, 2, '0'));

            -- Inserir recorrência específica da loja do item
            INSERT INTO financeiro_contas (
                tipo, 
                descricao, 
                valor, 
                item, 
                data_vencimento, 
                status, 
                recorrente, 
                loja_id
            ) VALUES (
                v_categoria.tipo,
                v_categoria.item || ' (' || v_mes || '/' || v_ano || ')',
                v_valor_final,
                v_categoria.item,
                v_vencimento_final,
                'pendente',
                TRUE,
                v_categoria.loja_id
            );

            v_processadas := v_processadas + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.processar_recorrencias_financeiras IS 
'Processa automaticamente lançamentos recorrentes mensais respeitando rigorosamente a segregação por filial definida no plano de contas.';
