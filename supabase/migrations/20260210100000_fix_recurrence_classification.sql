-- ==========================================
-- MIGRATION: 20260210100000_fix_recurrence_classification.sql
-- v2.5.13 - Correção Definitiva de Classificação de Recorrência
-- ==========================================
-- Objetivo:
-- 1. Reclassificar Aluguel para FIXA (Fixo Mensal)
-- 2. Confirmar Folha e FGTS como VARIAVEL (Fixo Variável) 
-- 3. Limpar lançamentos legados gerados pela versão antiga da função
-- 4. Reprocessar recorrências para gerar apenas FIXA corretamente
-- ==========================================

-- 1. RECLASSIFICAÇÃO: Aluguel → FIXA (Fixo Mensal)
UPDATE financeiro_itens_plano
SET tipo_recorrencia = 'FIXA',
    fixo = TRUE
WHERE LOWER(item) = 'aluguel'
  AND (tipo_recorrencia != 'FIXA' OR tipo_recorrencia IS NULL);

-- 2. CONFIRMAÇÃO: Folha e FGTS → VARIAVEL (Fixo Variável)
-- (Apenas garante que estão corretos, sem mudar se já estiverem certos)
UPDATE financeiro_itens_plano
SET tipo_recorrencia = 'VARIAVEL',
    fixo = TRUE
WHERE LOWER(item) IN ('folha', 'fgts')
  AND (tipo_recorrencia != 'VARIAVEL' OR tipo_recorrencia IS NULL);

-- 3. LIMPEZA: Remover lançamentos PENDENTES futuros de itens NÃO-FIXA
-- (Esses foram gerados pela versão antiga da função que processava FIXA e VARIAVEL)
DELETE FROM financeiro_contas fc
USING financeiro_itens_plano fip
WHERE fc.item_financeiro_id = fip.id
  AND fip.tipo_recorrencia != 'FIXA'  -- Remove VARIAVEL e NENHUMA
  AND fc.status = 'pendente'
  AND fc.recorrente = TRUE;

-- Também limpa por nome (fallback para legado sem ID vinculado)
DELETE FROM financeiro_contas
WHERE item_financeiro_id IS NULL
  AND recorrente = TRUE
  AND status = 'pendente'
  AND LOWER(item) IN (
    SELECT LOWER(item) FROM financeiro_itens_plano 
    WHERE tipo_recorrencia IN ('VARIAVEL', 'NENHUMA')
  );

-- 4. REPROCESSAR: Gerar lançamentos apenas para FIXA
-- (A função processar_recorrencias_financeiras já faz isso corretamente)
SELECT * FROM processar_recorrencias_financeiras();

NOTIFY pgrst, 'reload config';
