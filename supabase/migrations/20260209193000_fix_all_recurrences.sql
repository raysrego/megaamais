-- ==========================================
-- MIGRATION: 20260209193000_fix_all_recurrences.sql
-- Objetivo: 
-- 1. Forçar reload do schema cache (corrigir erro de coluna não encontrada)
-- 2. Popular item_financeiro_id em lançamentos passados (Sincronização)
-- 3. Corrigir lógica de recorrência para gerar apenas FIXA (VARIAVEL deve ser manual)
-- ==========================================

-- 1. Reload Schema Cache
NOTIFY pgrst, 'reload config';

-- 2. Popular item_financeiro_id (Vínculo Retroativo)
-- Isso garante que "os ajustes que eu fizer no cadastro deles, reflitam nas movimentações"
UPDATE financeiro_contas fc
SET item_financeiro_id = fip.id
FROM financeiro_itens_plano fip
WHERE fc.item = fip.item 
  AND fc.item_financeiro_id IS NULL;

-- 3. Limpar Lançamentos Futuros incorretos (Variáveis zeradas geradas automaticamente pelo código anterior)
DELETE FROM financeiro_contas
WHERE valor = 0 
  AND status = 'pendente'
  AND item_financeiro_id IN (
      SELECT id FROM financeiro_itens_plano WHERE tipo_recorrencia = 'VARIAVEL'
  );

-- 4. Atualizar Função de Recorrência (Lógica Correta: Apenas FIXA gera automático)
CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_item RECORD;
    v_data_vencimento DATE;
    v_data_base DATE := CURRENT_DATE;
    v_count INTEGER := 0;
    v_exists BOOLEAN;
BEGIN
    -- Loop POR APENAS ITENS FIXOS (Recorrência Automática)
    FOR v_item IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE tipo_recorrencia = 'FIXA' -- MUDANÇA CRITICA: Apenas Fixa
          AND ativo = TRUE
    LOOP
        -- Calcular data de vencimento
        BEGIN
            v_data_vencimento := MAKE_DATE(
                EXTRACT(YEAR FROM v_data_base)::INTEGER,
                EXTRACT(MONTH FROM v_data_base)::INTEGER,
                LEAST(v_item.dia_vencimento, 28)
            );
        EXCEPTION WHEN others THEN
            v_data_vencimento := MAKE_DATE(
                EXTRACT(YEAR FROM v_data_base)::INTEGER,
                EXTRACT(MONTH FROM v_data_base)::INTEGER,
                1
            );
        END;

        -- Verificar existência
        SELECT EXISTS (
            SELECT 1 FROM financeiro_contas 
            WHERE item = v_item.item -- Comparação por nome para compatibilidade
              AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM v_data_base)
              AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM v_data_base)
              AND recorrente = TRUE
        ) INTO v_exists;

        -- Criar se não existir
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
                item_financeiro_id
            ) VALUES (
                v_item.tipo,
                v_item.item, -- Descrição padrão = Nome do Item
                v_item.valor_padrao, -- Valor fixo
                v_item.item,
                v_data_vencimento,
                'pendente',
                TRUE,
                'mensal',
                NULL,
                v_item.id
            );
            
            v_count := v_count + 1;
        END IF;

    END LOOP;

    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;
