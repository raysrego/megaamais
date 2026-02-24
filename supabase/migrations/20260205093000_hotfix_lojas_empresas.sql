-- ===================================================================
-- HOTFIX: CORREÇÃO DE TABELA MESTRE (LOJAS -> EMPRESAS)
-- Data: 2026-02-05
-- Objetivo: O sistema usa 'empresas' como tabela real, mas migrações recentes criaram
--           uma tabela fantasma 'lojas'. Este script corrige a View e aplica RLS na tabela correta.
-- ===================================================================

-- 1. CORRIGIR VIEW DO DASHBOARD (Apontar para empresas)
DROP VIEW IF EXISTS public.vw_dashboard_consolidado CASCADE;

CREATE OR REPLACE VIEW public.vw_dashboard_consolidado AS
SELECT 
    e.nome_fantasia as filial,
    COALESCE(SUM(CASE WHEN m.tipo::text IN ('venda', 'venda_jogo') THEN m.valor ELSE 0 END), 0) as vendas_jogos,
    COALESCE(SUM(CASE WHEN m.tipo::text = 'venda_bolao' THEN m.valor ELSE 0 END), 0) as vendas_boloes,
    COALESCE(SUM(CASE WHEN m.tipo::text = 'pagamento' THEN m.valor ELSE 0 END), 0) as premios_pagos,
    COALESCE(SUM(CASE WHEN m.tipo::text = 'saida_despesa' THEN m.valor ELSE 0 END), 0) as despesas,
    (COALESCE(SUM(CASE WHEN m.tipo::text IN ('venda', 'venda_jogo', 'venda_bolao') THEN m.valor ELSE 0 END), 0) - 
     COALESCE(SUM(CASE WHEN m.tipo::text IN ('pagamento', 'saida_despesa') THEN m.valor ELSE 0 END), 0)) as resultado_liquido
FROM public.empresas e
LEFT JOIN public.terminais t ON t.loja_id = e.id
LEFT JOIN public.caixa_sessoes s ON s.terminal_id_ref = t.id
LEFT JOIN public.caixa_movimentacoes m ON m.sessao_id = s.id
GROUP BY e.nome_fantasia;

GRANT SELECT ON public.vw_dashboard_consolidado TO authenticated;


-- 2. APLICAR RLS NA TABELA CORRETA (EMPRESAS)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "empresas_isolation" ON public.empresas;
DROP POLICY IF EXISTS "lojas_isolation" ON public.empresas;

-- Política de Leitura Isolada
CREATE POLICY "empresas_isolation" ON public.empresas
    FOR SELECT TO authenticated
    USING (
        public.is_master() OR 
        id = public.get_my_loja_id()
    );

-- 3. (OPCIONAL) Inserir dados vitais na tabela empresas se necessário
-- (Geralmente a tabela empresas já existe pois o LojaContext funciona)

-- 4. DROPAR TABELA FANTASMA 'LOJAS' PARA EVITAR CONFUSÃO FUTURA
-- Cuidado: Só dropar se não tiver dados importantes. Como foi criada dia 02/02 e o sistema usava empresas, deve estar vazia.
-- DROP TABLE IF EXISTS public.lojas CASCADE; -- Comentado por segurança, rodar manualmente se confirmado.
