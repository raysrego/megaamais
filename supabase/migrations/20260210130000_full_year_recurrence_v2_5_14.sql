-- ==========================================
-- MIGRATION: 20260210130000_full_year_recurrence_v2_5_14.sql
-- v2.5.14 - Correção: Gerar recorrências FIXAS para TODO O ANO
-- ==========================================
-- Problema: Função só gera do mês atual até Dezembro (perde meses passados)
-- Solução: Loop de Janeiro (1) a Dezembro (12), independente do mês atual
-- ==========================================

CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_ano_atual INTEGER;
    v_mes_loop INTEGER;
    v_categoria RECORD;
    v_vencimento_date DATE;
    v_dia_venc INTEGER;
BEGIN
    v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);

    -- Buscar APENAS itens com tipo_recorrencia = 'FIXA'
    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE tipo_recorrencia = 'FIXA' 
          AND ativo = TRUE
    LOOP
        -- ✅ FIX CRÍTICO: Gerar de Janeiro (1) a Dezembro (12)
        -- Antes era: v_mes_atual..12 (perdia meses passados)
        FOR v_mes_loop IN 1..12 LOOP
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            -- Tentar criar data, com fallback para último dia do mês
            BEGIN
                v_vencimento_date := MAKE_DATE(v_ano_atual, v_mes_loop, v_dia_venc);
            EXCEPTION WHEN others THEN
                -- Se dia 31 em Fevereiro, usar último dia válido
                v_vencimento_date := (MAKE_DATE(v_ano_atual, v_mes_loop, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
            END;

            -- Evitar duplicatas (checar se já existe lançamento deste item no mês/ano)
            IF NOT EXISTS (
                SELECT 1 FROM financeiro_contas
                WHERE item_financeiro_id = v_categoria.id
                  AND EXTRACT(MONTH FROM data_vencimento) = v_mes_loop
                  AND EXTRACT(YEAR FROM data_vencimento) = v_ano_atual
                  AND recorrente = TRUE
            ) THEN
                -- Inserir lançamento recorrente
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
                    v_categoria.tipo::fin_tipo_transacao,
                    v_categoria.item || ' (' || to_char(v_vencimento_date, 'MM/YYYY') || ')',
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

COMMENT ON FUNCTION public.processar_recorrencias_financeiras IS
'v2.5.14: Gera lançamentos recorrentes de tipo_recorrencia=FIXA para TODO O ANO (Jan-Dez), 
evitando duplicatas. Antes gerava só do mês atual até Dezembro.';

-- Executar imediatamente para preencher ano atual
SELECT processar_recorrencias_financeiras();

NOTIFY pgrst, 'reload config';
