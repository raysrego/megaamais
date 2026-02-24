-- ==========================================
-- MIGRATION: 20260209195000_fix_and_update_costs.sql
-- Objetivo: Corrigir erro de coluna inexistente e aplicar classificação de custos
-- ==========================================

-- 1. Garantir que a coluna existe (Defesa contra erro 42703)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'financeiro_itens_plano' 
        AND column_name = 'tipo_recorrencia'
    ) THEN
        ALTER TABLE financeiro_itens_plano 
        ADD COLUMN tipo_recorrencia VARCHAR(20) DEFAULT 'NENHUMA';
    END IF;
END $$;

-- 2. Atualizar classificação conforme regra de negócio
-- VARIAVEL agora é 'Fixo Variável' -> Contabilmente FIXO
UPDATE financeiro_itens_plano
SET fixo = TRUE
WHERE tipo_recorrencia = 'VARIAVEL';

-- NENHUMA agora é 'Variável Eventual' -> Contabilmente VARIÁVEL
UPDATE financeiro_itens_plano
SET fixo = FALSE
WHERE tipo_recorrencia = 'NENHUMA';

-- FIXA contina sendo 'Fixo Mensal' -> Contabilmente FIXO
UPDATE financeiro_itens_plano
SET fixo = TRUE
WHERE tipo_recorrencia = 'FIXA';

-- 3. Recarregar Schema Cache
NOTIFY pgrst, 'reload config';
