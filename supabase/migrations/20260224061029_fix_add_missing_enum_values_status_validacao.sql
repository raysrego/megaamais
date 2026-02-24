/*
  # Correção Crítica - Enum status_validacao_gerencial (Valores Faltando)

  1. Problema Identificado
    - Enum só tem: 'pendente', 'aprovado', 'rejeitado'
    - Código usa: 'discrepante', 'batido', 'divergente', 'fechado'
    - Resultado: Erro "invalid input value for enum"
    
  2. Alterações
    - Adicionar valores faltantes ao enum
    - Valores: discrepante, batido, divergente, fechado
    
  3. Uso
    - discrepante/divergente: Fechamento com diferença
    - batido: Fechamento conferido e correto
    - fechado: Fechamento realizado, aguardando validação
*/

-- Adicionar novos valores ao enum (se não existirem)
DO $$ 
BEGIN
    -- Adicionar 'discrepante'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'status_validacao_gerencial' 
        AND e.enumlabel = 'discrepante'
    ) THEN
        ALTER TYPE status_validacao_gerencial ADD VALUE 'discrepante';
    END IF;

    -- Adicionar 'batido'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'status_validacao_gerencial' 
        AND e.enumlabel = 'batido'
    ) THEN
        ALTER TYPE status_validacao_gerencial ADD VALUE 'batido';
    END IF;

    -- Adicionar 'divergente'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'status_validacao_gerencial' 
        AND e.enumlabel = 'divergente'
    ) THEN
        ALTER TYPE status_validacao_gerencial ADD VALUE 'divergente';
    END IF;

    -- Adicionar 'fechado'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'status_validacao_gerencial' 
        AND e.enumlabel = 'fechado'
    ) THEN
        ALTER TYPE status_validacao_gerencial ADD VALUE 'fechado';
    END IF;
END $$;