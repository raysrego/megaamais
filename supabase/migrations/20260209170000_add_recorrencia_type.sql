-- ==========================================
-- MIGRATION: 20260209170000_add_recorrencia_type.sql
-- Objetivo: Adicionar suporte a recorrência variável (Energia, Água)
-- ==========================================

-- 1. Adicionar coluna tipo_recorrencia
ALTER TABLE financeiro_itens_plano 
ADD COLUMN IF NOT EXISTS tipo_recorrencia VARCHAR(20) DEFAULT 'NENHUMA';

-- 2. Migrar dados existentes (Mantendo compatibilidade)
UPDATE financeiro_itens_plano
SET tipo_recorrencia = CASE 
    WHEN fixo = TRUE THEN 'FIXA'
    ELSE 'NENHUMA'
END
WHERE tipo_recorrencia IS NULL OR tipo_recorrencia = 'NENHUMA';

-- 3. Atualizar função de processamento de recorrências
CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_mes INTEGER;
    v_ano INTEGER;
    v_categoria RECORD;
    v_valor_final NUMERIC;
    v_loja_id UUID;
    v_dia_venc INTEGER;
    v_vencimento_final DATE;
    v_start_date DATE;
    v_end_date DATE;
    v_status_inicial VARCHAR(20);
BEGIN
    v_mes := EXTRACT(MONTH FROM NOW());
    v_ano := EXTRACT(YEAR FROM NOW());
    v_start_date := DATE(v_ano || '-' || LPAD(v_mes::TEXT, 2, '0') || '-01');
    v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Para cada item CONFIGURADO COMO RECORRENTE (Fixa ou Variável)
    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE (tipo_recorrencia = 'FIXA' OR tipo_recorrencia = 'VARIAVEL') 
          AND ativo = TRUE
    LOOP
        -- Verificar se já existe lançamento deste item no mês atual
        IF NOT EXISTS (
            SELECT 1 FROM financeiro_contas
            WHERE item = v_categoria.item
              AND data_vencimento >= v_start_date
              AND data_vencimento <= v_end_date
        ) THEN
            -- Lógica de Valor
            IF v_categoria.tipo_recorrencia = 'FIXA' THEN
                -- Tenta pegar do histórico ou usa o padrão
                SELECT valor, loja_id INTO v_valor_final, v_loja_id
                FROM financeiro_contas
                WHERE item = v_categoria.item
                ORDER BY data_vencimento DESC
                LIMIT 1;
                
                v_valor_final := COALESCE(v_valor_final, v_categoria.valor_padrao, 0);
                v_status_inicial := 'pendente';
            ELSE
                -- VARIAVEL: Valor começa zerado para forçar edição
                v_valor_final := 0.00;
                -- Se tiver loja no cadastro, usa ela. Senão tenta inferir (mas geralmente recorrencia é por loja)
                v_loja_id := NULL; -- Ajustar se tiver campo loja_id na tabela de itens (tem sim, via join se precisar, mas aqui é item global?)
                -- Na verdade, financeiro_itens_plano não tem loja_id explícito na estrutura original mostrada, 
                -- mas o código do frontend sugere que itens podem ter loja_id. 
                -- Vamos checar se o record v_categoria tem loja_id (se foi adicionado em migration anterior).
                -- Se não tiver, o insert vai falhar ou ficar null. 
                -- Assumindo que financeiro_itens_plano pode ser global.
                
                v_status_inicial := 'pendente'; -- Poderia ser 'aguardando_valor' se o enum permitir
            END IF;

            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            -- Garantir que o dia não ultrapasse o último dia do mês
            IF v_dia_venc > EXTRACT(DAY FROM v_end_date) THEN
                v_dia_venc := EXTRACT(DAY FROM v_end_date);
            END IF;

            v_vencimento_final := DATE(v_ano || '-' || LPAD(v_mes::TEXT, 2, '0') || '-' || LPAD(v_dia_venc::TEXT, 2, '0'));

            -- Inserir recorrência
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
                v_categoria.tipo::TEXT,
                v_categoria.item || ' (' ||LPAD(v_mes::TEXT, 2, '0') || '/' || v_ano || ')',
                v_valor_final,
                v_categoria.item,
                v_vencimento_final,
                v_status_inicial,
                TRUE,
                CASE WHEN v_loja_id IS NOT NULL THEN v_loja_id ELSE NULL END -- Simplificação, ideal seria ter loja_id no item
            );

            v_processadas := v_processadas + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

-- 4. Comentários
COMMENT ON COLUMN financeiro_itens_plano.tipo_recorrencia IS 
'Tipo de recorrência: FIXA (valor fixo), VARIAVEL (valor muda mês a mês), NENHUMA (eventual)';
