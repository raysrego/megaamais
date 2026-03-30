CREATE TABLE IF NOT EXISTS conciliacao_extratos (
    id SERIAL PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES financeiro_contas_bancarias(id),
    data_extrato DATE NOT NULL,

    -- Valores informados pelo gerente (do extrato real)
    depositos_confirmados NUMERIC(12,2) DEFAULT 0,
    pix_ted_recebidos NUMERIC(12,2) DEFAULT 0,
    debitos_pagamentos NUMERIC(12,2) DEFAULT 0,
    tarifas_bancarias NUMERIC(12,2) DEFAULT 0,
    outros_creditos NUMERIC(12,2) DEFAULT 0,
    outros_debitos NUMERIC(12,2) DEFAULT 0,
    saldo_extrato NUMERIC(12,2),

    -- Valores calculados pelo sistema (preenchidos automaticamente)
    depositos_sistema NUMERIC(12,2) DEFAULT 0,
    pix_sistema NUMERIC(12,2) DEFAULT 0,
    pagamentos_sistema NUMERIC(12,2) DEFAULT 0,

    -- Diferenças calculadas
    diferenca_depositos NUMERIC(12,2) DEFAULT 0,
    diferenca_pix NUMERIC(12,2) DEFAULT 0,
    diferenca_pagamentos NUMERIC(12,2) DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'conciliado', 'divergente', 'justificado')),
    justificativa TEXT,

    -- Auditoria
    registrado_por UUID,
    conciliado_por UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    conciliado_at TIMESTAMPTZ,

    UNIQUE(conta_id, data_extrato)
);

-- Index para buscas por período
CREATE INDEX IF NOT EXISTS idx_conciliacao_extratos_data
    ON conciliacao_extratos(conta_id, data_extrato DESC);

-- 2. Adicionar tipo 'entrada_fechamento' no cofre (se houver constraint)
DO $$
BEGIN
    BEGIN
        ALTER TABLE cofre_movimentacoes DROP CONSTRAINT IF EXISTS cofre_movimentacoes_tipo_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    ALTER TABLE cofre_movimentacoes
        ADD CONSTRAINT cofre_movimentacoes_tipo_check
        CHECK (tipo IN (
            'entrada_sangria', 'saida_deposito',
            'ajuste_entrada', 'ajuste_saida',
            'entrada_fechamento'
        ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. RPC: Registrar extrato diário e calcular diferenças automaticamente
CREATE OR REPLACE FUNCTION registrar_extrato_diario(
    p_conta_id UUID,
    p_data DATE,
    p_depositos_confirmados NUMERIC,
    p_pix_ted_recebidos NUMERIC,
    p_debitos_pagamentos NUMERIC,
    p_tarifas_bancarias NUMERIC,
    p_outros_creditos NUMERIC DEFAULT 0,
    p_outros_debitos NUMERIC DEFAULT 0,
    p_saldo_extrato NUMERIC DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_depositos_sistema NUMERIC(12,2);
    v_pix_sistema NUMERIC(12,2);
    v_pagamentos_sistema NUMERIC(12,2);
    v_id INTEGER;
    v_status TEXT;
BEGIN
    -- Calcular lado "sistema" automaticamente

    -- Depósitos: saídas do cofre para esta conta neste dia
    SELECT COALESCE(SUM(valor), 0) INTO v_depositos_sistema
    FROM cofre_movimentacoes
    WHERE tipo = 'saida_deposito'
      AND conta_bancaria_id = p_conta_id
      AND data_movimentacao::date = p_data;

    -- PIX: soma dos PIX registrados nos caixas neste dia
    -- (busca em caixa_movimentacoes via caixa_sessoes)
    SELECT COALESCE(SUM(cm.valor), 0) INTO v_pix_sistema
    FROM caixa_movimentacoes cm
    JOIN caixa_sessoes cs ON cs.id = cm.sessao_id
    WHERE cm.tipo = 'pix'
      AND cm.valor > 0
      AND cm.deleted_at IS NULL
      AND cs.data_turno = p_data;

    -- Pagamentos: despesas financeiras pagas nesta data
    SELECT COALESCE(SUM(valor), 0) INTO v_pagamentos_sistema
    FROM financeiro_contas
    WHERE tipo = 'despesa'
      AND status = 'pago'
      AND data_pagamento::date = p_data
      AND deleted_at IS NULL;

    -- Determinar status automático
    v_status := 'pendente';
    IF ABS(p_depositos_confirmados - v_depositos_sistema) < 0.01
       AND ABS(p_pix_ted_recebidos - v_pix_sistema) < 0.01
       AND ABS(p_debitos_pagamentos - v_pagamentos_sistema) < 0.01
    THEN
        v_status := 'conciliado';
    ELSIF ABS(p_depositos_confirmados - v_depositos_sistema) > 0.01
          OR ABS(p_pix_ted_recebidos - v_pix_sistema) > 0.01
          OR ABS(p_debitos_pagamentos - v_pagamentos_sistema) > 0.01
    THEN
        v_status := 'divergente';
    END IF;

    -- Upsert (permite corrigir extrato do mesmo dia)
    INSERT INTO conciliacao_extratos (
        conta_id, data_extrato,
        depositos_confirmados, pix_ted_recebidos, debitos_pagamentos,
        tarifas_bancarias, outros_creditos, outros_debitos, saldo_extrato,
        depositos_sistema, pix_sistema, pagamentos_sistema,
        diferenca_depositos, diferenca_pix, diferenca_pagamentos,
        status, registrado_por
    ) VALUES (
        p_conta_id, p_data,
        p_depositos_confirmados, p_pix_ted_recebidos, p_debitos_pagamentos,
        p_tarifas_bancarias, p_outros_creditos, p_outros_debitos, p_saldo_extrato,
        v_depositos_sistema, v_pix_sistema, v_pagamentos_sistema,
        p_depositos_confirmados - v_depositos_sistema,
        p_pix_ted_recebidos - v_pix_sistema,
        p_debitos_pagamentos - v_pagamentos_sistema,
        v_status, p_usuario_id
    )
    ON CONFLICT (conta_id, data_extrato) DO UPDATE SET
        depositos_confirmados = EXCLUDED.depositos_confirmados,
        pix_ted_recebidos = EXCLUDED.pix_ted_recebidos,
        debitos_pagamentos = EXCLUDED.debitos_pagamentos,
        tarifas_bancarias = EXCLUDED.tarifas_bancarias,
        outros_creditos = EXCLUDED.outros_creditos,
        outros_debitos = EXCLUDED.outros_debitos,
        saldo_extrato = EXCLUDED.saldo_extrato,
        depositos_sistema = EXCLUDED.depositos_sistema,
        pix_sistema = EXCLUDED.pix_sistema,
        pagamentos_sistema = EXCLUDED.pagamentos_sistema,
        diferenca_depositos = EXCLUDED.diferenca_depositos,
        diferenca_pix = EXCLUDED.diferenca_pix,
        diferenca_pagamentos = EXCLUDED.diferenca_pagamentos,
        status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id INTO v_id;

    -- Se houver tarifas, registrar como despesa automaticamente
    IF p_tarifas_bancarias > 0 THEN
        INSERT INTO financeiro_contas (
            tipo, descricao, valor, item, data_vencimento,
            status, data_pagamento, loja_id
        ) VALUES (
            'despesa',
            FORMAT('Tarifa bancária %s', p_data),
            p_tarifas_bancarias,
            'Tarifas Bancárias',
            p_data,
            'pago',
            p_data,
            NULL  -- tarifa é da empresa, não de loja específica
        )
        ON CONFLICT DO NOTHING;  -- evita duplicar se re-registrar o extrato
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_id,
        'status', v_status,
        'depositos_sistema', v_depositos_sistema,
        'pix_sistema', v_pix_sistema,
        'pagamentos_sistema', v_pagamentos_sistema,
        'diferenca_depositos', p_depositos_confirmados - v_depositos_sistema,
        'diferenca_pix', p_pix_ted_recebidos - v_pix_sistema,
        'diferenca_pagamentos', p_debitos_pagamentos - v_pagamentos_sistema
    );
END;
$$;

-- 4. RPC: Registrar depósito bancário a partir do cofre (substitui a versão antiga)
CREATE OR REPLACE FUNCTION registrar_deposito_cofre(
    p_valor NUMERIC,
    p_conta_id UUID,
    p_usuario_id UUID,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_cofre NUMERIC;
    v_cofre_id INTEGER;
BEGIN
    -- Verificar saldo do cofre
    SELECT COALESCE(saldo, 0) INTO v_saldo_cofre
    FROM cofre_saldo_atual
    LIMIT 1;

    IF p_valor > v_saldo_cofre THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente no cofre');
    END IF;

    -- Registrar saída do cofre COM conta_bancaria_id
    INSERT INTO cofre_movimentacoes (
        tipo, valor, operador_id, conta_bancaria_id, observacoes
    ) VALUES (
        'saida_deposito',
        p_valor,
        p_usuario_id,
        p_conta_id,
        COALESCE(p_observacoes, FORMAT('Depósito bancário %s', NOW()::date))
    )
    RETURNING id INTO v_cofre_id;

    -- Atualizar saldo da conta bancária
    UPDATE financeiro_contas_bancarias
    SET saldo_atual = saldo_atual + p_valor,
        updated_at = NOW()
    WHERE id = p_conta_id;

    RETURN jsonb_build_object(
        'success', true,
        'cofre_movimentacao_id', v_cofre_id
    );
END;
$$;
