-- ==========================================
-- VIEW UNIFICADA DE AUDITORIA (Vendas + Encalhes)
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Mostrar vendas e encalhes na mesma aba de auditoria
-- ==========================================

-- 1. CRIAR VIEW UNIFICADA
CREATE OR REPLACE VIEW public.vw_auditoria_completa AS
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
    v.metodo_pagamento::TEXT as metodo_pagamento,  -- Converter ENUM para TEXT
    l.nome_fantasia as filial,
    'vendida'::TEXT as status_final
FROM public.vendas_boloes v
JOIN public.perfis perf ON perf.id = v.usuario_id
JOIN public.boloes b ON b.id = v.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
LEFT JOIN public.lojas l ON l.id = perf.loja_id
WHERE v.deleted_at IS NULL  -- Não mostrar vendas deletadas

UNION ALL

-- ENCALHES PROCESSADOS (Agrupados por bolão)
SELECT 
    'encalhe'::TEXT as tipo_registro,
    b.id as registro_id,
    MAX(COALESCE(c.data_venda, c.created_at)) as data_registro,  -- Data quando foi criada ou marcada
    'SISTEMA AUTOMÁTICO'::TEXT as responsavel,
    p.nome as loteria,
    p.cor as loteria_cor,
    b.concurso,
    b.data_sorteio,
    COUNT(c.id) as quantidade_cotas,
    COUNT(c.id) * b.preco_venda_cota as valor_total,
    b.preco_venda_cota as valor_unitario,
    'N/A'::TEXT as metodo_pagamento,  -- Agora compatível
    NULL as filial,
    'encalhe'::TEXT as status_final
FROM public.cotas_boloes c
JOIN public.boloes b ON b.id = c.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
WHERE c.status = 'encalhe_casa'
GROUP BY b.id, p.nome, p.cor, b.concurso, b.data_sorteio, b.preco_venda_cota

ORDER BY data_registro DESC;

-- 2. GRANT de acesso
GRANT SELECT ON public.vw_auditoria_completa TO authenticated;

-- 3. COMENTÁRIO
COMMENT ON VIEW public.vw_auditoria_completa IS 
'View unificada de auditoria mostrando vendas realizadas e encalhes processados automaticamente pelo sistema.';

-- 4. DROPAR FUNÇÃO ANTIGA (se existir) para permitir mudança de tipo de retorno
DROP FUNCTION IF EXISTS public.processar_encalhe_automatico();

-- 5. ATUALIZAR FUNÇÃO DE ENCALHE para registrar data corretamente
CREATE OR REPLACE FUNCTION public.processar_encalhe_automatico()
RETURNS TABLE(boloes_processados INTEGER, cotas_encalhadas INTEGER) AS $$
DECLARE
    v_boloes INTEGER := 0;
    v_cotas INTEGER := 0;
BEGIN
    -- Marcar cotas não vendidas como encalhe
    WITH cotas_atualizadas AS (
        UPDATE public.cotas_boloes c
        SET status = 'encalhe_casa'
        FROM public.boloes b
        JOIN public.produtos p ON p.id = b.produto_id
        WHERE c.bolao_id = b.id
        AND c.status = 'disponivel'
        AND b.status = 'disponivel'
        AND (b.data_sorteio::date + p.horario_fechamento::time) < (NOW() AT TIME ZONE 'America/Sao_Paulo')
        RETURNING c.id
    )
    SELECT COUNT(*) INTO v_cotas FROM cotas_atualizadas;
    
    -- Atualizar status do bolão para 'finalizado'
    WITH boloes_atualizados AS (
        UPDATE public.boloes b
        SET status = 'finalizado'
        FROM public.produtos p
        WHERE p.id = b.produto_id
        AND b.status = 'disponivel'
        AND (b.data_sorteio::date + p.horario_fechamento::time) < (NOW() AT TIME ZONE 'America/Sao_Paulo')
        RETURNING b.id
    )
    SELECT COUNT(*) INTO v_boloes FROM boloes_atualizados;
    
    -- Retornar estatísticas
    RETURN QUERY SELECT v_boloes, v_cotas;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.processar_encalhe_automatico TO authenticated;

COMMENT ON FUNCTION public.processar_encalhe_automatico IS 
'Processa encalhes automaticamente marcando cotas não vendidas após o horário de fechamento. Retorna estatísticas de processamento.';
