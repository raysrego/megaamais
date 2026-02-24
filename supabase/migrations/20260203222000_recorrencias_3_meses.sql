-- ===================================================================
-- UPGRADE: Gerar Recorrências para 3 Meses (Atual + 2 Futuros)
-- Data: 2026-02-03
-- Objetivo: Permitir visibilidade de despesas fixas futuras
-- ===================================================================

CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_mes_base INTEGER;
    v_ano_base INTEGER;
    v_mes_atual INTEGER;
    v_ano_atual INTEGER;
    v_categoria RECORD;
    v_loja RECORD;
    v_valor_final NUMERIC;
    v_dia_venc INTEGER;
    v_vencimento_final DATE;
    v_start_date DATE;
    v_end_date DATE;
    v_offset_mes INTEGER;
BEGIN
    -- Mês e ano de hoje (base)
    v_mes_base := EXTRACT(MONTH FROM NOW());
    v_ano_base := EXTRACT(YEAR FROM NOW());

    -- Loop para processar 3 meses: atual (0), próximo (1) e seguinte (2)
    FOR v_offset_mes IN 0..2 LOOP
        -- Calcular mês/ano alvo
        v_mes_atual := v_mes_base + v_offset_mes;
        v_ano_atual := v_ano_base;
        
        -- Ajustar se ultrapassou dezembro
        WHILE v_mes_atual > 12 LOOP
            v_mes_atual := v_mes_atual - 12;
            v_ano_atual := v_ano_atual + 1;
        END LOOP;

        -- Definir período do mês alvo
        v_start_date := DATE(v_ano_atual || '-' || LPAD(v_mes_atual::TEXT, 2, '0') || '-01');
        v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

        -- Para cada loja ativa
        FOR v_loja IN 
            SELECT id FROM empresas WHERE ativo = TRUE
        LOOP
            -- Para cada item fixo (recorrente) no plano de contas
            FOR v_categoria IN 
                SELECT * FROM financeiro_itens_plano 
                WHERE fixo = TRUE AND ativo = TRUE
            LOOP
                -- Verificar se já existe lançamento deste item no mês alvo PARA ESTA LOJA
                IF NOT EXISTS (
                    SELECT 1 FROM financeiro_contas
                    WHERE item = v_categoria.item
                      AND data_vencimento >= v_start_date
                      AND data_vencimento <= v_end_date
                      AND loja_id = v_loja.id
                ) THEN
                    -- PRIORIZAR valor_padrao da categoria
                    v_valor_final := COALESCE(v_categoria.valor_padrao, 0);
                    
                    -- Se valor_padrao for 0 ou nulo, tentar buscar do histórico desta loja
                    IF v_valor_final = 0 THEN
                        SELECT valor INTO v_valor_final
                        FROM financeiro_contas
                        WHERE item = v_categoria.item
                          AND loja_id = v_loja.id
                        ORDER BY data_vencimento DESC
                        LIMIT 1;
                        
                        v_valor_final := COALESCE(v_valor_final, 0);
                    END IF;

                    v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
                    
                    -- Garantir que o dia não ultrapasse o último dia do mês
                    IF v_dia_venc > EXTRACT(DAY FROM v_end_date) THEN
                        v_dia_venc := EXTRACT(DAY FROM v_end_date);
                    END IF;

                    v_vencimento_final := DATE(v_ano_atual || '-' || LPAD(v_mes_atual::TEXT, 2, '0') || '-' || LPAD(v_dia_venc::TEXT, 2, '0'));

                    -- Inserir recorrência PARA ESTA LOJA ESPECÍFICA
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
                        v_categoria.item || ' (' || 
                            CASE v_offset_mes
                                WHEN 0 THEN 'Mês Atual'
                                WHEN 1 THEN 'Próximo Mês'
                                ELSE 'Em ' || (v_offset_mes) || ' meses'
                            END || 
                            ' - ' || v_mes_atual || '/' || v_ano_atual || ')',
                        v_valor_final,
                        v_categoria.item,
                        v_vencimento_final,
                        'pendente',
                        TRUE,
                        v_loja.id
                    );

                    v_processadas := v_processadas + 1;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP; -- Fim do loop de 3 meses

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.processar_recorrencias_financeiras IS 
'Processa automaticamente lançamentos recorrentes para os próximos 3 meses (atual + 2 futuros), permitindo visibilidade de despesas fixas futuras como em bancos digitais.';
