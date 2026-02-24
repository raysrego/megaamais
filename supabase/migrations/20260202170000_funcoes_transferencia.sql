-- ==========================================
-- MEGA B - FUNÇÕES DE TRANSFERÊNCIA
-- Versão: 1.0 (2026-02-02)
-- Objetivo: Depósito bancário (Cofre -> Banco)
-- ==========================================

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
    -- 1. Registrar Saída do Cofre
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

    -- 2. Registrar Entrada no Banco
    INSERT INTO public.financeiro_transacoes_bancarias (
        conta_id,
        tipo,
        valor,
        categoria,
        descricao,
        usuario_id,
        loja_id,
        cofre_mov_id
    ) VALUES (
        p_conta_id,
        'entrada',
        p_valor,
        'Depósito de Cofre',
        p_observacoes,
        p_usuario_id,
        p_loja_id,
        v_cofre_id
    );

    -- 3. Atualizar Saldo do Banco
    UPDATE public.financeiro_contas_bancarias 
    SET saldo_atual = saldo_atual + p_valor 
    WHERE id = p_conta_id;

END;
$$ LANGUAGE plpgsql;
