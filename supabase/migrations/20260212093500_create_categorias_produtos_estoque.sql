-- Migration: Product Structure 2.0 (Categories + Stock)
-- Data: 2026-02-12
-- Objetivo: Suportar múltiplos tipos de produtos (Loterias, Raspadinhas) e controle de estoque por filial.

-- 1. Nova tabela de CATEGORIAS DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.categorias_produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    icone TEXT NOT NULL DEFAULT 'box',
    cor TEXT DEFAULT '#64748b',
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para Categorias
ALTER TABLE public.categorias_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de categorias_produtos" ON public.categorias_produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia categorias_produtos" ON public.categorias_produtos FOR ALL TO authenticated USING (public.is_admin() OR public.is_master());

-- Seed inicial de categorias fundamentais
INSERT INTO public.categorias_produtos (nome, icone, cor) VALUES
('Loterias', 'clover', '#8b5cf6'),        -- Jogos de azar (Mega, Quina)
('Raspadinhas', 'ticket', '#f59e0b'),     -- Físico, unitário
('Tele Sena', 'award', '#3b82f6'),        -- Físico, unitário
('Bolões', 'users', '#10b981'),           -- Agrupamento (virtual)
('Serviços', 'zap', '#64748b')            -- Recargas, etc
ON CONFLICT DO NOTHING;

-- 2. Atualizar tabela de PRODUTOS
ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES public.categorias_produtos(id),
ADD COLUMN IF NOT EXISTS gerencia_estoque BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preco_padrao NUMERIC(10,2) DEFAULT 0.00;

-- Atualizar produtos existentes para a categoria 'Loterias'
DO $$
DECLARE
    v_cat_loterias INTEGER;
BEGIN
    SELECT id INTO v_cat_loterias FROM public.categorias_produtos WHERE nome = 'Loterias' LIMIT 1;
    
    IF v_cat_loterias IS NOT NULL THEN
        UPDATE public.produtos 
        SET categoria_id = v_cat_loterias
        WHERE categoria_id IS NULL;
    END IF;
END $$;

-- 3. Atualizar tabela LOJA_PRODUTOS (Controle de Estoque Local)
ALTER TABLE public.loja_produtos
ADD COLUMN IF NOT EXISTS saldo_estoque INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(10,2); -- Opcional, se a loja quiser preço diferente do padrão

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos(categoria_id);
