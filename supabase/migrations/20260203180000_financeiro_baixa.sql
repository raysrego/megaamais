-- Add payment details columns to financeiro_contas if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_contas' AND column_name = 'metodo_pagamento') THEN
        ALTER TABLE public.financeiro_contas ADD COLUMN metodo_pagamento text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_contas' AND column_name = 'comprovante_url') THEN
        ALTER TABLE public.financeiro_contas ADD COLUMN comprovante_url text;
    END IF;
END $$;

-- Ensure storage bucket 'comprovantes' exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload receipts
-- Note: Adjusting to separate Create/Select for clarity or using a broad one if simple
DROP POLICY IF EXISTS "Comprovantes Upload Publico" ON storage.objects;
CREATE POLICY "Comprovantes Upload Publico"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comprovantes');

-- Policy: Everyone (or at least Auth) can view receipts
DROP POLICY IF EXISTS "Comprovantes Leitura Publica" ON storage.objects;
CREATE POLICY "Comprovantes Leitura Publica"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comprovantes');
