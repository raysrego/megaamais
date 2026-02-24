-- FIX: Corrigir cast de tipo na função processar_recorrencias_financeiras
-- O campo 'tipo' em financeiro_contas é enum fin_tipo_transacao, não TEXT

CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_ano_atual INTEGER;
    v_mes_atual INTEGER;
    v_mes_loop INTEGER;
    v_categoria RECORD;
    v_vencimento_date DATE;
    v_dia_venc INTEGER;
BEGIN
    v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);
    v_mes_atual := EXTRACT(MONTH FROM CURRENT_DATE);

    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE tipo_recorrencia = 'FIXA' 
          AND ativo = TRUE
    LOOP
        FOR v_mes_loop IN v_mes_atual..12 LOOP
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            BEGIN
                v_vencimento_date := MAKE_DATE(v_ano_atual, v_mes_loop, v_dia_venc);
            EXCEPTION WHEN others THEN
                v_vencimento_date := (MAKE_DATE(v_ano_atual, v_mes_loop, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
            END;

            IF NOT EXISTS (
                SELECT 1 FROM financeiro_contas
                WHERE item_financeiro_id = v_categoria.id
                  AND EXTRACT(MONTH FROM data_vencimento) = v_mes_loop
                  AND EXTRACT(YEAR FROM data_vencimento) = v_ano_atual
                  AND recorrente = TRUE
            ) THEN
                INSERT INTO financeiro_contas (
                    tipo,
                    descricao,
                    valor,
                    item,
                    data_vencimento,
                    status,
                    recorrente,
                    frequencia,
                    loja_id,
                    item_financeiro_id
                ) VALUES (
                    v_categoria.tipo::fin_tipo_transacao,  -- FIX: cast para enum correto
                    v_categoria.item,
                    v_categoria.valor_padrao,
                    v_categoria.item,
                    v_vencimento_date,
                    'pendente',
                    TRUE,
                    'mensal',
                    v_categoria.loja_id,
                    v_categoria.id
                );

                v_processadas := v_processadas + 1;
            END IF;

        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;
