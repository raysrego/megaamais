-- =====================================================
-- REFATORAÇÃO FLUXO DE CAIXA - FUNDO + COMPROVANTES PIX
-- Data: 2026-02-03
-- =====================================================

-- 1. ADICIONAR CAMPO DE CONTROLE DE FUNDO DE CAIXA
ALTER TABLE public.caixa_sessoes
ADD COLUMN IF NOT EXISTS tem_fundo_caixa BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.caixa_sessoes.tem_fundo_caixa IS 
'Indica se o fundo de caixa de R$100 estava presente na abertura. Usado para ajustar cálculos no fechamento.';

-- 2. ADICIONAR CAMPO PARA COMPROVANTES PIX
ALTER TABLE public.caixa_movimentacoes
ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN public.caixa_movimentacoes.comprovante_url IS 
'URL do comprovante de PIX anexado pelo operador (Storage Supabase)';

COMMENT ON COLUMN public.caixa_movimentacoes.descricao IS 
'Descrição curta do que é o lançamento PIX (ex: "Boleto Cliente João")';

-- 3. CRIAR BUCKET PARA COMPROVANTES
-- Nota: O bucket deve ser criado via Supabase Dashboard em Storage
-- Este comentário documenta a necessidade:
-- Nome: comprovantes
-- Público: true
-- Limite: 2MB
-- Tipos: image/jpeg, image/png, image/jpg

-- Se o bucket não existir, criar via Dashboard:
-- https://supabase.com/dashboard/project/[PROJECT_ID]/storage/buckets

-- 4. POLÍTICAS RLS PARA COMPROVANTES
-- Primeiro, dropar políticas antigas se existirem
DROP POLICY IF EXISTS "Comprovantes públicos para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Upload de comprovantes autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Deletar próprios comprovantes" ON storage.objects;

-- Criar novas políticas
CREATE POLICY "Comprovantes públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'comprovantes');

CREATE POLICY "Upload de comprovantes autenticado"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'comprovantes' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Deletar próprios comprovantes"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'comprovantes' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. ADICIONAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_comprovante 
ON public.caixa_movimentacoes(comprovante_url) 
WHERE comprovante_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_fundo 
ON public.caixa_sessoes(tem_fundo_caixa);

-- 6. PREENCHER DESCRIÇÃO EM REGISTROS PIX ANTIGOS (Limpeza de Dados)
-- Antes de aplicar o constraint, corrigir registros existentes
-- Desabilitar triggers temporariamente para evitar conflitos
ALTER TABLE public.caixa_movimentacoes DISABLE TRIGGER USER;

UPDATE public.caixa_movimentacoes
SET descricao = 'PIX registrado (sem descrição)'
WHERE tipo = 'pix' 
AND (descricao IS NULL OR TRIM(descricao) = '');

-- Reabilitar triggers
ALTER TABLE public.caixa_movimentacoes ENABLE TRIGGER USER;

-- 7. CONSTRAINT: Descrição obrigatória para PIX (APENAS para novos registros)
-- Primeiro, dropar se existir
ALTER TABLE public.caixa_movimentacoes
DROP CONSTRAINT IF EXISTS chk_pix_tem_descricao;

-- Criar o constraint
ALTER TABLE public.caixa_movimentacoes
ADD CONSTRAINT chk_pix_tem_descricao 
CHECK (
    tipo != 'pix' OR 
    (tipo = 'pix' AND descricao IS NOT NULL AND LENGTH(TRIM(descricao)) > 0)
);

COMMENT ON CONSTRAINT chk_pix_tem_descricao ON public.caixa_movimentacoes IS
'Garante que lançamentos PIX sempre tenham descrição do que é';
