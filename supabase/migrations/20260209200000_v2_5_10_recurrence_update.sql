-- ==========================================
-- MIGRATION: 20260209200000_v2_5_10_recurrence_update.sql
-- Objetivo:
-- 1. Limpar lançamentos futuros/pendentes automáticos inválidos (Variável/Fixo Variável)
-- 2. Atualizar função de recorrência para gerar projeção anual
-- 3. Trigger para manter futuro sincronizado com cadastro
-- ==========================================

-- 1. Limpeza de Dados PENDENTES Inválidos
-- Remove lançamentos PENDENTES futuros (>= hoje) que sejam de itens VARIAVEIS ou NENHUMA
-- (Pois estes devem ser lançados manualmente agora)
DELETE FROM financeiro_contas fc
USING financeiro_itens_plano fip
WHERE fc.item_financeiro_id = fip.id
  AND (fip.tipo_recorrencia = 'VARIAVEL' OR fip.tipo_recorrencia = 'NENHUMA')
  AND fc.status = 'pendente'
  AND fc.data_vencimento >= CURRENT_DATE
  AND fc.recorrente = TRUE; -- Apenas os gerados automaticamente

-- 2. Atualizar Função de Recorrência (Projeção Anual)
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

    -- Loop APENAS para itens FIXA (Automáticos)
    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE tipo_recorrencia = 'FIXA' 
          AND ativo = TRUE
    LOOP
        -- Loop pelos meses restantes do ano (Mês Atual até 12)
        FOR v_mes_loop IN v_mes_atual..12 LOOP
            
            -- Calcular data de vencimento
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            -- Ajustar dia para o fim do mês se necessário (ex: dia 31 em mês de 30 dias)
            -- Truque: criar data no dia 1 do mês seguinte e subtrair dias se exceder
            BEGIN
                v_vencimento_date := MAKE_DATE(v_ano_atual, v_mes_loop, v_dia_venc);
            EXCEPTION WHEN others THEN
                -- Se falhar (ex: 31 de Abril), pega o último dia do mês
                v_vencimento_date := (MAKE_DATE(v_ano_atual, v_mes_loop, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
            END;

            -- Verificar se já existe lançamento deste item neste mês/ano
            -- (Independente do dia exato, para evitar duplicidade se mudar o dia de vencimento)
            IF NOT EXISTS (
                SELECT 1 FROM financeiro_contas
                WHERE item_financeiro_id = v_categoria.id
                  AND EXTRACT(MONTH FROM data_vencimento) = v_mes_loop
                  AND EXTRACT(YEAR FROM data_vencimento) = v_ano_atual
                  AND recorrente = TRUE
            ) THEN
                -- Inserir Lançamento Projetado
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
                    v_categoria.tipo::TEXT,
                    v_categoria.item, -- Descrição simples, frontend pode enriquecer se quiser
                    v_categoria.valor_padrao,
                    v_categoria.item,
                    v_vencimento_date,
                    'pendente',
                    TRUE,
                    'mensal',
                    v_categoria.loja_id, -- Respeita a loja configurada no item (ou null se global)
                    v_categoria.id
                );

                v_processadas := v_processadas + 1;
            END IF;

        END LOOP; -- Fim loop meses
    END LOOP; -- Fim loop categorias

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger para Atualização de Valor Futuro
-- Se alterar valor_padrao no cadastro, reflete nos pendentes futuros
CREATE OR REPLACE FUNCTION trg_update_future_recurrences_fn()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o valor padrão mudou
    IF NEW.valor_padrao <> OLD.valor_padrao THEN
        UPDATE financeiro_contas
        SET valor = NEW.valor_padrao
        WHERE item_financeiro_id = NEW.id
          AND status = 'pendente'
          AND data_vencimento >= CURRENT_DATE
          AND recorrente = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_future_recurrences ON financeiro_itens_plano;

CREATE TRIGGER trg_update_future_recurrences
AFTER UPDATE OF valor_padrao ON financeiro_itens_plano
FOR EACH ROW
EXECUTE FUNCTION trg_update_future_recurrences_fn();

NOTIFY pgrst, 'reload config';
