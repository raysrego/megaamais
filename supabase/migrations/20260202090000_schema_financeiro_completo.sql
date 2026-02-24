-- ==========================================
-- MEGA B - SUPER MIGRATION FINANCEIRA V2 (FIX)
-- Versão: 1.1 (2026-02-02)
-- Correção: Harmonização com tabelas existentes (usuario_id -> operador_id)
-- ==========================================

-- 1. BASE ORGANIZACIONAL (MULTI-FILIAL)
CREATE TABLE IF NOT EXISTS public.lojas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_fantasia TEXT NOT NULL,
    razao_social TEXT,
    cnpj TEXT UNIQUE,
    cidade TEXT,
    uf TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HARMONIZAÇÃO DE TERMINAIS
-- Já existe a tabela 'terminais', vamos adicionar o vínculo com 'lojas'
ALTER TABLE public.terminais ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id);

-- 3. HARMONIZAÇÃO DE CAIXA_SESSOES
-- Renomear usuario_id para operador_id se necessário, ou garantir que operador_id exista
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caixa_sessoes' AND column_name='usuario_id') THEN
        ALTER TABLE public.caixa_sessoes RENAME COLUMN usuario_id TO operador_id;
    END IF;
END $$;

-- Garantir colunas para visão executiva
ALTER TABLE public.caixa_sessoes ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id);
ALTER TABLE public.caixa_sessoes ADD COLUMN IF NOT EXISTS saldo_final_sistema NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.caixa_sessoes ADD COLUMN IF NOT EXISTS diferenca_quebra NUMERIC(15,2) DEFAULT 0;

-- 4. MOVIMENTAÇÕES DE CAIXA
-- Adicionar novos tipos ao enum existente se necessário
ALTER TYPE public.movimentacao_tipo ADD VALUE IF NOT EXISTS 'venda_jogo';
ALTER TYPE public.movimentacao_tipo ADD VALUE IF NOT EXISTS 'venda_bolao';
ALTER TYPE public.movimentacao_tipo ADD VALUE IF NOT EXISTS 'saida_despesa';

-- 5. HARMONIZAÇÃO DE COFRE
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cofre_movimentacoes' AND column_name='usuario_id') THEN
        ALTER TABLE public.cofre_movimentacoes RENAME COLUMN usuario_id TO operador_id;
    END IF;
END $$;

ALTER TABLE public.cofre_movimentacoes ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id);
ALTER TABLE public.cofre_movimentacoes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'concluido';

-- 6. ATUALIZAÇÃO DE RLS
-- Remover políticas antigas se necessário para evitar duplicidade
DROP POLICY IF EXISTS "Sessões: Operador vê a sua" ON public.caixa_sessoes;
CREATE POLICY "Sessões: Operador vê a sua" ON public.caixa_sessoes FOR SELECT USING (operador_id = auth.uid());

-- 7. VIEW EXECUTIVA ATUALIZADA (Usando nomes reais das tabelas)
DROP VIEW IF EXISTS public.vw_dashboard_consolidado CASCADE;
CREATE OR REPLACE VIEW public.vw_dashboard_consolidado AS
SELECT 
    l.nome_fantasia as filial,
    COALESCE(SUM(CASE WHEN m.tipo::text IN ('venda', 'venda_jogo') THEN m.valor ELSE 0 END), 0) as vendas_jogos,
    COALESCE(SUM(CASE WHEN m.tipo::text = 'venda_bolao' THEN m.valor ELSE 0 END), 0) as vendas_boloes,
    COALESCE(SUM(CASE WHEN m.tipo::text = 'pagamento' THEN m.valor ELSE 0 END), 0) as premios_pagos,
    COALESCE(SUM(CASE WHEN m.tipo::text = 'saida_despesa' THEN m.valor ELSE 0 END), 0) as despesas,
    (COALESCE(SUM(CASE WHEN m.tipo::text IN ('venda', 'venda_jogo', 'venda_bolao') THEN m.valor ELSE 0 END), 0) - 
     COALESCE(SUM(CASE WHEN m.tipo::text IN ('pagamento', 'saida_despesa') THEN m.valor ELSE 0 END), 0)) as resultado_liquido
FROM public.lojas l
LEFT JOIN public.terminais t ON t.loja_id = l.id
LEFT JOIN public.caixa_sessoes s ON s.terminal_id_ref = t.id -- Usando o nome real da FK no banco
LEFT JOIN public.caixa_movimentacoes m ON m.sessao_id = s.id
GROUP BY l.nome_fantasia;
