-- Migration: Motor de Encalhe Automático
-- Description: Adiciona status necessários e categorias para o motor de encalhe.

-- 1. Adicionar status ao ENUM bolao_status
-- Nota: ALTER TYPE ADD VALUE não pode ser executado dentro de um bloco TRANSACTION em versões antigas do Postgres, 
-- mas o Supabase suporta bem.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'bolao_status' AND e.enumlabel = 'sorteio_realizado') THEN
        ALTER TYPE bolao_status ADD VALUE 'sorteio_realizado';
    END IF;
END $$;

-- 2. Garantir que a categoria de Encalhe exista no Plano de Contas
INSERT INTO financeiro_categorias_plano (nome, tipo, fixo, ordem)
SELECT 'Encalhe de Jogos', 'despesa', FALSE, 20
WHERE NOT EXISTS (
    SELECT 1 FROM financeiro_categorias_plano WHERE nome = 'Encalhe de Jogos'
);

-- 3. Adicionar comentário para documentar os novos status de cota (já que cotas_boloes.status é TEXT)
COMMENT ON COLUMN cotas_boloes.status IS 'Status da cota: disponivel, vendida, encalhe_casa';

-- 4. Função auxiliar para identificar bolões vencidos (para o motor)
CREATE OR REPLACE FUNCTION get_boloes_vencidos()
RETURNS SETOF boloes AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM boloes 
    WHERE status = 'disponivel' 
    AND data_sorteio < CURRENT_DATE; -- Consideramos vencido se a data do sorteio já passou
END;
$$ LANGUAGE plpgsql;
