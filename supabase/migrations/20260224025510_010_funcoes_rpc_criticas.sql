/*
  # Funções RPC Críticas do Sistema
  
  1. Funções de Bolões
    - `registrar_venda_bolao` - Venda atômica de cotas
    - `processar_encalhe_bolao` - Processamento de encalhe com despesa financeira
    
  2. Funções de Prestação
    - `confirmar_liquidacao_operador` - Liquidação de vendas pendentes
    
  3. Funções Financeiras
    - `realizar_deposito_bancario` - Depósito com atualização de saldo
    - `conciliar_transacao_bancaria` - Conciliação bancária
    - `get_anos_financeiros_disponiveis` - Lista anos com dados
    
  4. Funções de Controle
    - `check_rate_limit` - Rate limiting para operações sensíveis
    
  5. Características
    - Transações atômicas (ACID)
    - Validações de negócio
    - Rollback automático em caso de erro
    - Retornos tipados
*/

-- Função: Registrar Venda de Bolão (Transação Atômica)
CREATE OR REPLACE FUNCTION registrar_venda_bolao(
    p_bolao_id BIGINT,
    p_sessao_caixa_id BIGINT,
    p_usuario_id UUID,
    p_quantidade_cotas INTEGER,
    p_valor_total NUMERIC,
    p_metodo_pagamento TEXT,
    p_loja_id UUID DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_venda_id BIGINT;
    v_cotas_disponiveis INTEGER;
    v_cota_record RECORD;
BEGIN
    -- Validar disponibilidade
    SELECT COUNT(*) INTO v_cotas_disponiveis
    FROM cotas_boloes
    WHERE bolao_id = p_bolao_id AND status = 'disponivel';
    
    IF v_cotas_disponiveis < p_quantidade_cotas THEN
        RAISE EXCEPTION 'Cotas insuficientes. Disponíveis: %, Solicitadas: %', v_cotas_disponiveis, p_quantidade_cotas;
    END IF;
    
    -- Criar venda
    INSERT INTO vendas_boloes (
        bolao_id, sessao_caixa_id, usuario_id, loja_id,
        quantidade_cotas, valor_total, metodo_pagamento
    ) VALUES (
        p_bolao_id, p_sessao_caixa_id, p_usuario_id, p_loja_id,
        p_quantidade_cotas, p_valor_total, p_metodo_pagamento::metodo_pagamento_venda
    ) RETURNING id INTO v_venda_id;
    
    -- Marcar cotas como vendidas (lock pessimista)
    FOR v_cota_record IN (
        SELECT id FROM cotas_boloes
        WHERE bolao_id = p_bolao_id AND status = 'disponivel'
        ORDER BY id
        LIMIT p_quantidade_cotas
        FOR UPDATE
    ) LOOP
        UPDATE cotas_boloes
        SET status = 'vendida',
            data_venda = NOW(),
            venda_id = v_venda_id
        WHERE id = v_cota_record.id;
    END LOOP;
    
    -- Atualizar contador do bolão
    UPDATE boloes
    SET cotas_vendidas = cotas_vendidas + p_quantidade_cotas
    WHERE id = p_bolao_id;
    
    -- Registrar movimentação no caixa (se houver sessão)
    IF p_sessao_caixa_id IS NOT NULL THEN
        INSERT INTO caixa_movimentacoes (
            sessao_id, tipo, valor, descricao, metodo_pagamento
        ) VALUES (
            p_sessao_caixa_id, 'venda', p_valor_total,
            'Venda de bolão - ' || p_quantidade_cotas || ' cotas',
            p_metodo_pagamento
        );
    END IF;
    
    RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql;

-- Função: Processar Encalhe de Bolão
CREATE OR REPLACE FUNCTION processar_encalhe_bolao(
    p_bolao_id BIGINT
) RETURNS JSON AS $$
DECLARE
    v_bolao RECORD;
    v_cotas_nao_vendidas INTEGER;
    v_valor_despesa NUMERIC;
    v_result JSON;
BEGIN
    -- Buscar bolão com lock
    SELECT * INTO v_bolao 
    FROM boloes 
    WHERE id = p_bolao_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bolão não encontrado';
    END IF;
    
    IF v_bolao.status != 'disponivel' THEN
        RETURN json_build_object(
            'success', false,
            'already_processed', true,
            'message', 'Bolão já processado'
        );
    END IF;
    
    -- Calcular encalhe
    v_cotas_nao_vendidas := v_bolao.qtd_cotas - v_bolao.cotas_vendidas;
    v_valor_despesa := v_cotas_nao_vendidas * v_bolao.valor_cota_base;
    
    -- Atualizar status do bolão
    UPDATE boloes SET status = 'finalizado' WHERE id = p_bolao_id;
    
    -- Se houver encalhe, registrar despesa financeira
    IF v_cotas_nao_vendidas > 0 THEN
        INSERT INTO financeiro_contas (
            tipo, descricao, valor, item,
            data_vencimento, data_pagamento, status,
            loja_id
        ) VALUES (
            'despesa',
            'Encalhe de bolão - Concurso ' || v_bolao.concurso,
            v_valor_despesa,
            'Encalhe de Bolões',
            CURRENT_DATE,
            CURRENT_DATE,
            'pago',
            v_bolao.loja_id
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'encalhe', v_cotas_nao_vendidas,
        'valor_despesa', v_valor_despesa
    );
END;
$$ LANGUAGE plpgsql;

-- Função: Confirmar Liquidação de Operador
CREATE OR REPLACE FUNCTION confirmar_liquidacao_operador(
    p_operador_id UUID,
    p_master_id UUID,
    p_loja_id UUID,
    p_valor_especie NUMERIC,
    p_valor_pix NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_prestacao_id BIGINT;
    v_cofre_mov_id BIGINT;
BEGIN
    -- Criar prestação de contas
    INSERT INTO prestacoes_contas (
        loja_id, operador_id, responsavel_id,
        valor_total, metodo_pagamento
    ) VALUES (
        p_loja_id, p_operador_id, p_master_id,
        p_valor_especie + p_valor_pix, 'misto'
    ) RETURNING id INTO v_prestacao_id;
    
    -- Registrar entrada no cofre (se houver espécie)
    IF p_valor_especie > 0 THEN
        INSERT INTO cofre_movimentacoes (
            tipo, valor, operador_id, loja_id,
            observacoes
        ) VALUES (
            'entrada_sangria', p_valor_especie, p_master_id, p_loja_id,
            'Liquidação operador - Espécie'
        ) RETURNING id INTO v_cofre_mov_id;
    END IF;
    
    -- Baixar vendas pendentes (apenas dinheiro)
    UPDATE vendas_boloes
    SET status_prestacao = 'concluido',
        prestacao_id = v_prestacao_id,
        liquidado_em = NOW(),
        liquidado_por = p_master_id,
        cofre_mov_id = v_cofre_mov_id
    WHERE usuario_id = p_operador_id
      AND status_prestacao = 'pendente'
      AND metodo_pagamento = 'dinheiro'
      AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Função: Realizar Depósito Bancário
CREATE OR REPLACE FUNCTION realizar_deposito_bancario(
    p_valor NUMERIC,
    p_conta_id UUID,
    p_usuario_id UUID,
    p_loja_id UUID,
    p_comprovante TEXT DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Criar transação bancária
    INSERT INTO financeiro_transacoes_bancarias (
        conta_id, tipo, valor, item, descricao,
        usuario_id, loja_id
    ) VALUES (
        p_conta_id, 'entrada', p_valor, 'Depósito',
        p_observacoes, p_usuario_id, p_loja_id
    );
    
    -- Atualizar saldo da conta
    UPDATE financeiro_contas_bancarias
    SET saldo_atual = saldo_atual + p_valor
    WHERE id = p_conta_id;
END;
$$ LANGUAGE plpgsql;

-- Função: Conciliar Transação Bancária
CREATE OR REPLACE FUNCTION conciliar_transacao_bancaria(
    p_transacao_id BIGINT,
    p_usuario_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE financeiro_transacoes_bancarias
    SET status_conciliacao = 'conciliado',
        data_conciliacao = NOW()
    WHERE id = p_transacao_id;
END;
$$ LANGUAGE plpgsql;

-- Função: Get Anos Financeiros Disponíveis
CREATE OR REPLACE FUNCTION get_anos_financeiros_disponiveis(
    p_loja_id UUID
) RETURNS TABLE(ano INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT EXTRACT(YEAR FROM data_vencimento)::INTEGER AS ano
    FROM financeiro_contas
    WHERE (p_loja_id IS NULL OR loja_id = p_loja_id)
      AND deleted_at IS NULL
      AND data_vencimento IS NOT NULL
    ORDER BY ano DESC;
END;
$$ LANGUAGE plpgsql;

-- Função: Check Rate Limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Contar tentativas no período
    SELECT COUNT(*) INTO v_count
    FROM rate_limit_log
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND created_at >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Se excedeu o limite, retornar falso
    IF v_count >= p_max_attempts THEN
        RETURN FALSE;
    END IF;
    
    -- Registrar tentativa
    INSERT INTO rate_limit_log (user_id, action_type)
    VALUES (p_user_id, p_action_type);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;