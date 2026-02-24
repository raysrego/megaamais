-- ==========================================
-- MEGA B - AJUSTES FINANCEIROS DE FLUXO
-- Versão: 1.1 (2026-02-02)
-- Objetivo: Remover obrigatoriedade de vencimento em receitas 
-- e ajustar contabilidade de depósitos.
-- ==========================================

-- 1. Tornar data_vencimento opcional
ALTER TABLE public.financeiro_contas 
ALTER COLUMN data_vencimento DROP NOT NULL;

-- 2. Atualizar a função de depósito para ser puramente uma transferência
-- (Garante que não existam triggers ou efeitos colaterais que gerem pendências)
CREATE OR REPLACE FUNCTION public.realizar_deposito_bancario(
    p_valor NUMERIC,
    p_conta_id UUID,
    p_usuario_id UUID,
    p_loja_id UUID,
    p_comprovante TEXT DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_cofre_id BIGINT;
BEGIN
    -- A) Registrar Saída do Cofre (Baixa de Ativo Físico)
    INSERT INTO public.cofre_movimentacoes (
        tipo, 
        valor, 
        operador_id, 
        loja_id, 
        destino_banco,
        comprovante_doc,
        observacoes,
        status
    ) VALUES (
        'saida_deposito', 
        p_valor, 
        p_usuario_id, 
        p_loja_id, 
        p_conta_id::text,
        p_comprovante,
        p_observacoes,
        'concluido'
    ) RETURNING id INTO v_cofre_id;

    -- B) Registrar Entrada no Banco (Aumento de Ativo Digital - PENDENTE DE CONCILIAÇÃO)
    -- Isso NÃO é uma receita nova, é apenas uma movimentação de saldo.
    INSERT INTO public.financeiro_transacoes_bancarias (
        conta_id,
        tipo,
        valor,
        categoria,
        descricao,
        usuario_id,
        loja_id,
        cofre_mov_id,
        status_conciliacao
    ) VALUES (
        p_conta_id,
        'entrada',
        p_valor,
        'Depósito de Cofre', -- Categoria de Transferência
        p_observacoes,
        p_usuario_id,
        p_loja_id,
        v_cofre_id,
        'pendente'
    );

    -- C) Atualizar Saldo do Banco Imediatamente
    -- (O saldo "sistema" sobe, mas o status "conciliado" dirá se caiu no banco real)
    UPDATE public.financeiro_contas_bancarias 
    SET saldo_atual = saldo_atual + p_valor 
    WHERE id = p_conta_id;

END;
$$ LANGUAGE plpgsql;
