-- ==========================================
-- MIGRATION: 20260209194500_update_cost_classification.sql
-- Objetivo: Atualizar as definições de Custo Fixo/Variável conforme nova regra
-- 1. FIXA (Fixo Mensal): Custo Fixo (fixo=TRUE) -> Previsível
-- 2. VARIAVEL (Fixo Variável): Custo Fixo (fixo=TRUE) -> Valor Manual <-- MUDANÇA (Antes era FALSE)
-- 3. NENHUMA (Variável/Eventual): Custo Variável (fixo=FALSE)
-- ==========================================

-- 1. Atualizar classificação de "VARIAVEL" para "Custo Fixo" (fixo=TRUE)
UPDATE financeiro_itens_plano
SET fixo = TRUE
WHERE tipo_recorrencia = 'VARIAVEL';

-- 2. Garantir que "NENHUMA" seja "Custo Variável"
UPDATE financeiro_itens_plano
SET fixo = FALSE
WHERE tipo_recorrencia = 'NENHUMA';

-- 3. Garantir que "FIXA" seja "Custo Fixo"
UPDATE financeiro_itens_plano
SET fixo = TRUE
WHERE tipo_recorrencia = 'FIXA';

NOTIFY pgrst, 'reload config';
