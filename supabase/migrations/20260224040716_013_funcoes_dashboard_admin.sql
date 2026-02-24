/*
  # Funções de Dashboard e Administração
  
  1. Novas Funções
    - `get_dashboard_metrics` - Métricas do dashboard por loja
    - `get_admin_dashboard_summary` - Resumo consolidado de todas filiais (admin)
    - `get_financeiro_transactions` - Transações financeiras por período
    - `get_all_users` - Lista todos usuários (admin)
    
  2. Uso
    - Dashboard principal
    - Relatórios gerenciais
    - Administração de usuários
*/

-- Função: Get Dashboard Metrics
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_loja_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_total_vendas NUMERIC;
    v_total_encalhes NUMERIC;
    v_saldo_cofre NUMERIC;
    v_caixas_abertos INTEGER;
    v_vendas_mes NUMERIC;
    v_comissoes_pendentes NUMERIC;
BEGIN
    -- Total de vendas do mês
    SELECT COALESCE(SUM(valor_total), 0) INTO v_vendas_mes
    FROM vendas_boloes
    WHERE loja_id = p_loja_id
      AND deleted_at IS NULL
      AND created_at >= date_trunc('month', CURRENT_DATE);
    
    -- Total de vendas (histórico)
    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_vendas
    FROM vendas_boloes
    WHERE loja_id = p_loja_id
      AND deleted_at IS NULL;
    
    -- Total de encalhes
    SELECT COALESCE(SUM(valor), 0) INTO v_total_encalhes
    FROM financeiro_contas
    WHERE loja_id = p_loja_id
      AND tipo = 'despesa'
      AND item = 'Encalhe de Bolões'
      AND deleted_at IS NULL;
    
    -- Saldo do cofre
    SELECT COALESCE(saldo, 0) INTO v_saldo_cofre
    FROM cofre_saldo_atual
    WHERE loja_id = p_loja_id;
    
    -- Caixas abertos
    SELECT COUNT(*) INTO v_caixas_abertos
    FROM caixa_sessoes
    WHERE loja_id = p_loja_id
      AND status = 'aberto';
    
    -- Comissões pendentes
    SELECT COALESCE(SUM(total_geral), 0) INTO v_comissoes_pendentes
    FROM vw_prestacao_contas_operadores
    WHERE loja_id = p_loja_id;
    
    RETURN json_build_object(
        'total_vendas', v_total_vendas,
        'total_encalhes', v_total_encalhes,
        'saldo_cofre', v_saldo_cofre,
        'caixas_abertos', v_caixas_abertos,
        'vendas_mes', v_vendas_mes,
        'comissoes_pendentes', v_comissoes_pendentes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Get Admin Dashboard Summary
CREATE OR REPLACE FUNCTION get_admin_dashboard_summary()
RETURNS TABLE (
    loja_id UUID,
    loja_nome TEXT,
    total_vendas NUMERIC,
    vendas_mes NUMERIC,
    saldo_cofre NUMERIC,
    caixas_abertos INTEGER,
    operadores_ativos INTEGER
) AS $$
BEGIN
    -- Verificar se é admin
    IF NOT EXISTS (
        SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores';
    END IF;
    
    RETURN QUERY
    SELECT 
        e.id AS loja_id,
        e.nome_fantasia AS loja_nome,
        COALESCE(SUM(v.valor_total), 0) AS total_vendas,
        COALESCE(SUM(CASE WHEN v.created_at >= date_trunc('month', CURRENT_DATE) THEN v.valor_total ELSE 0 END), 0) AS vendas_mes,
        COALESCE(c.saldo, 0) AS saldo_cofre,
        (SELECT COUNT(*) FROM caixa_sessoes WHERE loja_id = e.id AND status = 'aberto') AS caixas_abertos,
        (SELECT COUNT(*) FROM perfis WHERE loja_id = e.id AND ativo = true) AS operadores_ativos
    FROM empresas e
    LEFT JOIN vendas_boloes v ON v.loja_id = e.id AND v.deleted_at IS NULL
    LEFT JOIN cofre_saldo_atual c ON c.loja_id = e.id
    WHERE e.ativo = true
    GROUP BY e.id, e.nome_fantasia, c.saldo
    ORDER BY e.nome_fantasia;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Get Financeiro Transactions
CREATE OR REPLACE FUNCTION get_financeiro_transactions(
    p_loja_id UUID,
    p_ano INTEGER,
    p_mes INTEGER
)
RETURNS TABLE (
    id BIGINT,
    tipo fin_tipo_conta,
    descricao TEXT,
    valor NUMERIC,
    valor_realizado NUMERIC,
    item TEXT,
    data_vencimento DATE,
    data_pagamento DATE,
    status fin_status_conta,
    metodo_pagamento fin_metodo_pagamento,
    comprovante_url TEXT,
    usuario_id UUID,
    created_at TIMESTAMPTZ,
    observacoes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fc.id,
        fc.tipo,
        fc.descricao,
        fc.valor,
        fc.valor_realizado,
        fc.item,
        fc.data_vencimento,
        fc.data_pagamento,
        fc.status,
        fc.metodo_pagamento,
        fc.comprovante_url,
        fc.usuario_id,
        fc.created_at,
        fc.observacoes
    FROM financeiro_contas fc
    WHERE (p_loja_id IS NULL OR fc.loja_id = p_loja_id)
      AND fc.deleted_at IS NULL
      AND EXTRACT(YEAR FROM fc.data_vencimento) = p_ano
      AND EXTRACT(MONTH FROM fc.data_vencimento) = p_mes
    ORDER BY fc.data_vencimento DESC, fc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Get All Users (Admin)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
    id UUID,
    role user_role,
    nome TEXT,
    avatar_url TEXT,
    loja_id UUID,
    loja_nome TEXT,
    ativo BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Verificar se é admin
    IF NOT EXISTS (
        SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores';
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.role,
        p.nome,
        p.avatar_url,
        p.loja_id,
        e.nome_fantasia AS loja_nome,
        p.ativo,
        p.created_at,
        p.updated_at
    FROM perfis p
    LEFT JOIN empresas e ON p.loja_id = e.id
    ORDER BY p.ativo DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;