-- ==========================================
-- MIGRATION: 20260209190000_update_processar_recorrencias.sql
-- Objetivo: Atualizar a função para incluir o item_financeiro_id ao gerar contas
-- ==========================================

CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_item RECORD;
    v_data_vencimento DATE;
    v_data_base DATE := CURRENT_DATE;
    v_count INTEGER := 0;
    v_exists BOOLEAN;
BEGIN
    -- Loop por todos os itens ativos que são FIXA ou VARIAVEL
    FOR v_item IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE (tipo_recorrencia = 'FIXA' OR tipo_recorrencia = 'VARIAVEL')
          AND ativo = TRUE
    LOOP
        -- Calcular data de vencimento para o mês atual
        -- Se hoje é dia 15 e vencimento é 10, gera para o PRÓXIMO mês? 
        -- Regra simplificada: Gera para o mês atual se ainda não existir
        
        BEGIN
            v_data_vencimento := MAKE_DATE(
                EXTRACT(YEAR FROM v_data_base)::INTEGER,
                EXTRACT(MONTH FROM v_data_base)::INTEGER,
                LEAST(v_item.dia_vencimento, 28) -- Proteção para meses curtos
            );
        EXCEPTION WHEN others THEN
            -- Fallback para dia 1 se der erro de data
            v_data_vencimento := MAKE_DATE(
                EXTRACT(YEAR FROM v_data_base)::INTEGER,
                EXTRACT(MONTH FROM v_data_base)::INTEGER,
                1
            );
        END;

        -- Verificar se já existe lançamento deste item para este mês/ano
        SELECT EXISTS (
            SELECT 1 FROM financeiro_contas 
            WHERE item = v_item.item 
              AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM v_data_base)
              AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM v_data_base)
              AND recorrente = TRUE
        ) INTO v_exists;

        -- Se não existe, criar
        IF NOT v_exists THEN
            INSERT INTO financeiro_contas (
                tipo,
                descricao,
                valor,
                item,
                data_vencimento,
                status,
                recorrente,
                frequencia,
                usuario_id,
                item_financeiro_id -- NOVO CAMPO
            ) VALUES (
                v_item.tipo,
                CASE 
                    WHEN v_item.tipo_recorrencia = 'VARIAVEL' THEN v_item.item || ' (A Definir)'
                    ELSE v_item.item 
                END,
                CASE 
                    WHEN v_item.tipo_recorrencia = 'VARIAVEL' THEN 0.00 -- Valor zerado para variável
                    ELSE v_item.valor_padrao 
                END,
                v_item.item,
                v_data_vencimento,
                'pendente', -- Status inicial
                TRUE,
                'mensal',
                NULL, -- Sistema
                v_item.id -- VINCULO COM O PLANO
            );
            
            v_count := v_count + 1;
        END IF;

    END LOOP;

    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;
