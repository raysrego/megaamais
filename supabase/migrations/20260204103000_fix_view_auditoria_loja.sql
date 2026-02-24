-- ===================================================================
-- Atualização Auditoria Unificada (Multi-Filial)
-- Data: 2026-02-04
-- Objetivo: Incluir loja_id na auditoria para permitir filtragem por unidade
-- ===================================================================

-- 1. DROPAR VIEW PARA PERMITIR ALTERAÇÃO DE COLUNAS (ASSINATURA)
DROP VIEW IF EXISTS public.vw_auditoria_completa CASCADE;

-- 2. RECRIAR VIEW COM LOJA_ID
CREATE VIEW public.vw_auditoria_completa AS
-- VENDAS REALIZADAS
SELECT 
    'venda'::TEXT as tipo_registro,
    v.id as registro_id,
    v.created_at as data_registro,
    perf.nome as responsavel,
    p.nome as loteria,
    p.cor as loteria_cor,
    b.concurso,
    b.data_sorteio,
    v.quantidade_cotas,
    v.valor_total,
    v.valor_total / v.quantidade_cotas as valor_unitario,
    v.metodo_pagamento::TEXT as metodo_pagamento,
    l.nome_fantasia as filial,
    l.id as loja_id, -- NOVA COLUNA
    'vendida'::TEXT as status_final
FROM public.vendas_boloes v
JOIN public.perfis perf ON perf.id = v.usuario_id
JOIN public.boloes b ON b.id = v.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
LEFT JOIN public.lojas l ON l.id = v.loja_id -- Assumindo que vendas_boloes tem loja_id

UNION ALL

-- ENCALHES PROCESSADOS (Agrupados por bolão)
SELECT 
    'encalhe'::TEXT as tipo_registro,
    b.id as registro_id,
    MAX(COALESCE(c.data_venda, c.created_at)) as data_registro,
    'SISTEMA AUTOMÁTICO'::TEXT as responsavel,
    p.nome as loteria,
    p.cor as loteria_cor,
    b.concurso,
    b.data_sorteio,
    COUNT(c.id) as quantidade_cotas,
    COUNT(c.id) * b.preco_venda_cota as valor_total,
    b.preco_venda_cota as valor_unitario,
    'N/A'::TEXT as metodo_pagamento,
    ll.nome_fantasia as filial,
    b.loja_id as loja_id, -- NOVA COLUNA (b.loja_id vindo de boloes)
    'encalhe'::TEXT as status_final
FROM public.cotas_boloes c
JOIN public.boloes b ON b.id = c.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
LEFT JOIN public.lojas ll ON ll.id = b.loja_id
WHERE c.status = 'encalhe_casa'
GROUP BY b.id, p.nome, p.cor, b.concurso, b.data_sorteio, b.preco_venda_cota, ll.nome_fantasia, b.loja_id;

GRANT SELECT ON public.vw_auditoria_completa TO authenticated;
