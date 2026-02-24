-- ==========================================
-- FIX: Corrigir tipo de dado na função processar_recorrencias_financeiras
-- Data: 2026-02-03
-- Problema: Casting incorreto para TEXT quando a coluna espera fin_tipo_transacao
-- ==========================================

CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_mes INTEGER;
    v_ano INTEGER;
    v_categoria RECORD;
    v_loja RECORD;
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

    -- Para cada loja ativa
    FOR v_loja IN 
        SELECT id FROM empresas WHERE ativo = TRUE
    LOOP
        -- Para cada item fixo (recorrente) no plano de contas
        FOR v_categoria IN 
            SELECT * FROM financeiro_itens_plano 
            WHERE fixo = TRUE AND ativo = TRUE
        LOOP
            -- Verificar se já existe lançamento deste item no mês atual PARA ESTA LOJA
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

                v_vencimento_final := DATE(v_ano || '-' || LPAD(v_mes::TEXT, 2, '0') || '-' || LPAD(v_dia_venc::TEXT, 2, '0'));

                -- Inserir recorrência PARA ESTA LOJA ESPECÍFICA
                -- FIX: Remover ::TEXT para manter o tipo ENUM fin_tipo_transacao
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
                    v_categoria.tipo,  -- FIX: Removido ::TEXT
                    v_categoria.item || ' (Automático - ' || v_mes || '/' || v_ano || ')',
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

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.processar_recorrencias_financeiras IS 
'Processa automaticamente lançamentos recorrentes mensais para TODAS as lojas ativas. CORRIGIDO: tipo agora usa ENUM fin_tipo_transacao diretamente.';
