/*
  # Add diferenca_caixa column to caixa_sessoes
  This column stores the declared cash difference at closing.
*/

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'caixa_sessoes' AND column_name = 'diferenca_caixa'
    ) THEN
        ALTER TABLE caixa_sessoes ADD COLUMN diferenca_caixa NUMERIC DEFAULT 0;
    END IF;
END $$;
