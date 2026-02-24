-- ==========================================
-- MEGA B - FLUXO DE LIQUIDAÇÃO FINANCEIRA
-- Versão: 1.0 (2026-02-02)
-- Objetivo: Rastrear liquidação de cotas e entrada no cofre.
-- ==========================================

-- 1. ADICIONAR COLUNAS DE LIQUIDAÇÃO EM VENDAS_BOLOES
ALTER TABLE public.vendas_boloes 
ADD COLUMN IF NOT EXISTS liquidado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS liquidado_por UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cofre_mov_id BIGINT REFERENCES public.cofre_movimentacoes(id);

-- 2. ATUALIZAR A VIEW DE PRESTAÇÃO DE CONTAS
-- Agora ela deve mostrar apenas o que NÃO foi liquidado
CREATE OR REPLACE VIEW public.vw_prestacao_contas_operadores AS
SELECT 
    u.id as operador_id,
    u.nome as operador_nome,
    l.nome_fantasia as filial,
    -- Totais por Método (Apenas pendentes)
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
WHERE v.liquidado_em IS NULL -- Foco apenas no que falta acertar
GROUP BY u.id, u.nome, l.nome_fantasia;

-- 3. FUNÇÃO PARA LIQUIDAR OPERADOR (TRANSACIONAL NO BANCO)
CREATE OR REPLACE FUNCTION public.confirmar_liquidacao_operador(
    p_operador_id UUID,
    p_master_id UUID,
    p_loja_id UUID,
    p_valor_especie NUMERIC,
    p_valor_pix NUMERIC
) RETURNS void AS $$
DECLARE
    v_mov_id BIGINT;
BEGIN
    -- 1. Criar entrada no Cofre se houver valor em espécie
    IF p_valor_especie > 0 THEN
        INSERT INTO public.cofre_movimentacoes (
            tipo, 
            valor, 
            operador_id, 
            loja_id, 
            observacoes,
            status
        ) VALUES (
            'entrada_sangria', 
            p_valor_especie, 
            p_master_id, 
            p_loja_id, 
            'Acerto de contas bolão - Operador ID: ' || p_operador_id,
            'concluido'
        ) RETURNING id INTO v_mov_id;
    END IF;

    -- 2. Marcar vendas como liquidadas
    UPDATE public.vendas_boloes
    SET 
        liquidado_em = NOW(),
        liquidado_por = p_master_id,
        cofre_mov_id = v_mov_id
    WHERE usuario_id = p_operador_id
    AND liquidado_em IS NULL;
    
END;
$$ LANGUAGE plpgsql;
