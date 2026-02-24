-- ==========================================
-- MIGRATION: 20260210150000_smart_sync_recurrences_v2_5_15.sql
-- v2.5.15 - FIX: Sincronização automática de Datas e Valores
-- ==========================================

-- 1. LIMPEZA: Remover índices e funções antigas para garantir nova estrutura
DROP INDEX IF EXISTS idx_financeiro_contas_sync_unique;

-- 2. CRIAR ÍNDICE ÚNICO ROBUSTO
-- Este índice define o que é um lançamento "único" por mês para uma categoria recorrente
CREATE UNIQUE INDEX idx_financeiro_contas_sync_unique 
ON public.financeiro_contas (
    item_financeiro_id, 
    loja_id, 
    (EXTRACT(MONTH FROM data_vencimento)), 
    (EXTRACT(YEAR FROM data_vencimento))
) 
WHERE (recorrente = TRUE AND status = 'pendente');

-- 3. ATUALIZAR FUNÇÃO COM ON CONFLICT CORRETO
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

    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE tipo_recorrencia = 'FIXA' 
          AND ativo = TRUE
          AND arquivado = FALSE
    LOOP
        FOR v_mes_loop IN 1..12 LOOP
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            BEGIN
                v_vencimento_date := MAKE_DATE(v_ano_atual, v_mes_loop, v_dia_venc);
            EXCEPTION WHEN others THEN
                -- Tratar meses com menos de 31 dias
                v_vencimento_date := (MAKE_DATE(v_ano_atual, v_mes_loop, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
            END;

            -- ✅ INSERT com ON CONFLICT alinhado ao Índice
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
            )
            ON CONFLICT (
                item_financeiro_id, 
                loja_id, 
                (EXTRACT(MONTH FROM data_vencimento)), 
                (EXTRACT(YEAR FROM data_vencimento))
            ) WHERE (recorrente = TRUE AND status = 'pendente')
            DO UPDATE SET
                valor = EXCLUDED.valor,
                data_vencimento = EXCLUDED.data_vencimento,
                descricao = EXCLUDED.descricao;

            v_processadas := v_processadas + 1;
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

-- 4. RE-EXECUTAR SYNC
SELECT processar_recorrencias_financeiras();
