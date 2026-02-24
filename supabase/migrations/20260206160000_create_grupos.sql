-- Migration: Create Grupos Table
-- Description: Estrutura para gestão hierárquica de Grupos Empresariais

CREATE TABLE IF NOT EXISTS public.grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Simplificadas para Master)
CREATE POLICY "Acesso total para Master" ON public.grupos
    FOR ALL USING (
        EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
    );

-- Seed: Criar o grupo inicial baseado nos dados existentes de empresas
-- Isso garante que as empresas atuais não fiquem "órfãs" de um objeto grupo
INSERT INTO public.grupos (id, nome)
SELECT DISTINCT grupo_id, 'Mega Bolões Brasil'
FROM public.empresas
WHERE grupo_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;
