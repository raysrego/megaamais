-- ==========================================
-- MEGA B - MOTOR DE ENCALHE 2.0 & AUDITORIA
-- Versão: 2.0 (2026-02-02)
-- Objetivo: Fechamento preciso por horário e rastreabilidade total.
-- ==========================================

-- 1. FUNÇÃO DE ENCALHE PRECISO (Fuso Brasília)
CREATE OR REPLACE FUNCTION public.processar_encalhe_automatico()
RETURNS void AS $$
BEGIN
    -- Marcar cotas não vendidas como encalhe para bolões que já passaram da hora do sorteio
    UPDATE public.cotas_boloes c
    SET status = 'encalhe_casa'
    FROM public.boloes b
    JOIN public.produtos p ON p.id = b.produto_id
    WHERE c.bolao_id = b.id
    AND c.status = 'disponivel'
    AND b.status = 'disponivel'
    AND (b.data_sorteio::timestamp + p.horario_fechamento::time) < (NOW() AT TIME ZONE 'America/Sao_Paulo');

    -- Atualizar status do bolão para 'finalizado' se todas as cotas foram processadas
    UPDATE public.boloes b
    SET status = 'finalizado'
    FROM public.produtos p
    WHERE p.id = b.produto_id
    AND b.status = 'disponivel'
    AND (b.data_sorteio::timestamp + p.horario_fechamento::time) < (NOW() AT TIME ZONE 'America/Sao_Paulo');
END;
$$ LANGUAGE plpgsql;

-- 2. VIEW DE AUDITORIA DE VENDAS (Para a nova aba)
CREATE OR REPLACE VIEW public.vw_auditoria_vendas_detalhada AS
SELECT 
    v.id as venda_id,
    v.created_at as data_venda,
    u.nome as vendedor,
    p.nome as loteria,
    b.concurso,
    v.quantidade_cotas,
    v.valor_total,
    v.metodo_pagamento,
    l.nome_fantasia as filial
FROM public.vendas_boloes v
JOIN public.perfis u ON u.id = v.usuario_id
JOIN public.boloes b ON b.id = v.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
LEFT JOIN public.lojas l ON l.id = u.loja_id;

COMMENT ON VIEW public.vw_auditoria_vendas_detalhada IS 'Visão para auditoria detalhada de quem vendeu o quê, quando e onde.';

-- 3. GARANTIR QUE vendas_boloes TEM O usuario_id CORRETAMENTE
-- (Já verificado na migration 20260129150000)
