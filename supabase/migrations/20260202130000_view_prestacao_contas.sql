-- ==========================================
-- MEGA B - PRESTAÇÃO DE CONTAS POR OPERADOR
-- Versão: 1.0 (2026-02-02)
-- Objetivo: Facilitar o acerto de contas Master -> Operador.
-- ==========================================

DROP VIEW IF EXISTS public.vw_prestacao_contas_operadores CASCADE;

CREATE OR REPLACE VIEW public.vw_prestacao_contas_operadores AS
SELECT 
    u.id as operador_id,
    u.nome as operador_nome,
    l.nome_fantasia as filial,
    -- Totais por Método
    COALESCE(SUM(CASE WHEN v.metodo_pagamento = 'dinheiro' THEN v.valor_total ELSE 0 END), 0) as total_especie,
    COALESCE(SUM(CASE WHEN v.metodo_pagamento = 'pix' THEN v.valor_total ELSE 0 END), 0) as total_pix,
    COALESCE(SUM(CASE WHEN v.metodo_pagamento IN ('cartao_debito', 'cartao_credito') THEN v.valor_total ELSE 0 END), 0) as total_cartao,
    -- Total Geral
    SUM(v.valor_total) as total_geral,
    -- Contagem
    COUNT(v.id) as qtd_vendas,
    -- Última venda para saber se o operador está ativo
    MAX(v.created_at) as ultima_venda
FROM public.perfis u
JOIN public.vendas_boloes v ON v.usuario_id = u.id
LEFT JOIN public.lojas l ON l.id = u.loja_id
WHERE v.created_at >= CURRENT_DATE -- Focado no acerto do dia
GROUP BY u.id, u.nome, l.nome_fantasia;

COMMENT ON VIEW public.vw_prestacao_contas_operadores IS 'Visão consolidada para o Operador Master realizar o acerto de contas do dia.';
