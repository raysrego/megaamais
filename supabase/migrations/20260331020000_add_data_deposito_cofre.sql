/*
  # Adicionar campo data_deposito na função registrar_deposito_cofre

  ## Alteração
  - Atualiza função `registrar_deposito_cofre` para aceitar parâmetro `p_data_deposito`
  - Campo opcional para registrar data específica do depósito
  - Se não informado, usa data atual (NOW())

  ## Impacto
  - Permite retroatividade na data de depósito
  - Melhora precisão da conciliação bancária
  - Mantém compatibilidade com chamadas sem data (usa NOW())
*/

CREATE OR REPLACE FUNCTION public.registrar_deposito_cofre(
    p_valor NUMERIC,
    p_conta_id UUID,
    p_usuario_id UUID,
    p_observacoes TEXT DEFAULT NULL,
    p_data_deposito DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_saldo_atual NUMERIC;
    v_loja_id UUID;
    v_mov_id BIGINT;
    v_data_deposito TIMESTAMPTZ;
BEGIN
    -- Validações
    IF p_valor <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valor deve ser positivo');
    END IF;

    -- Buscar loja da conta bancária
    SELECT loja_id INTO v_loja_id
    FROM financeiro_contas_bancarias
    WHERE id = p_conta_id;

    IF v_loja_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Conta bancária não encontrada');
    END IF;

    -- Buscar saldo atual do cofre
    SELECT COALESCE(saldo, 0) INTO v_saldo_atual
    FROM cofre_saldo_atual
    WHERE loja_id = v_loja_id;

    -- Validar saldo suficiente
    IF v_saldo_atual < p_valor THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Saldo insuficiente no cofre. Disponível: R$ ' || v_saldo_atual::TEXT
        );
    END IF;

    -- Definir data do depósito (usar informada ou NOW())
    v_data_deposito := COALESCE(p_data_deposito::TIMESTAMPTZ, NOW());

    -- Registrar movimentação de saída no cofre
    INSERT INTO cofre_movimentacoes (
        tipo,
        valor,
        observacoes,
        operador_id,
        loja_id,
        conta_bancaria_id,
        data_movimentacao,
        created_at
    ) VALUES (
        'saida_deposito',
        p_valor,
        p_observacoes,
        p_usuario_id,
        v_loja_id,
        p_conta_id,
        v_data_deposito,
        NOW()
    ) RETURNING id INTO v_mov_id;

    -- Registrar transação bancária (entrada na conta)
    INSERT INTO financeiro_transacoes_bancarias (
        conta_id,
        tipo,
        valor,
        item,
        descricao,
        usuario_id,
        loja_id,
        data_transacao,
        created_at
    ) VALUES (
        p_conta_id,
        'entrada',
        p_valor,
        'Depósito Cofre',
        p_observacoes,
        p_usuario_id,
        v_loja_id,
        v_data_deposito,
        NOW()
    );

    -- Atualizar saldo da conta bancária
    UPDATE financeiro_contas_bancarias
    SET saldo_atual = saldo_atual + p_valor,
        updated_at = NOW()
    WHERE id = p_conta_id;

    RETURN json_build_object(
        'success', true,
        'movimentacao_id', v_mov_id,
        'saldo_cofre_anterior', v_saldo_atual,
        'saldo_cofre_novo', v_saldo_atual - p_valor
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.registrar_deposito_cofre IS 
'Registra depósito do cofre para conta bancária com data específica ou atual';
