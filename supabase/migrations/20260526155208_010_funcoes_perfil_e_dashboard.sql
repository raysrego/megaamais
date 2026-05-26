/*
  # Funções de Perfil de Usuário e Dashboard
*/

CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS TABLE (
    id UUID,
    role user_role,
    nome TEXT,
    avatar_url TEXT,
    loja_id UUID,
    ativo BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.role, p.nome, p.avatar_url, p.loja_id, p.ativo, p.created_at, p.updated_at
    FROM perfis p
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_my_profile(
    p_nome TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE perfis
    SET nome = COALESCE(p_nome, nome),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_full_info()
RETURNS TABLE (
    id UUID,
    role user_role,
    nome TEXT,
    avatar_url TEXT,
    loja_id UUID,
    loja_nome TEXT,
    loja_nome_fantasia TEXT,
    ativo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.role, p.nome, p.avatar_url, p.loja_id,
           e.nome AS loja_nome, e.nome_fantasia AS loja_nome_fantasia, p.ativo
    FROM perfis p
    LEFT JOIN empresas e ON p.loja_id = e.id
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    SELECT fc.id, fc.tipo, fc.descricao, fc.valor, fc.valor_realizado, fc.item,
           fc.data_vencimento, fc.data_pagamento, fc.status, fc.metodo_pagamento,
           fc.comprovante_url, fc.usuario_id, fc.created_at, fc.observacoes
    FROM financeiro_contas fc
    WHERE (p_loja_id IS NULL OR fc.loja_id = p_loja_id)
      AND fc.deleted_at IS NULL
      AND EXTRACT(YEAR FROM fc.data_vencimento) = p_ano
      AND EXTRACT(MONTH FROM fc.data_vencimento) = p_mes
    ORDER BY fc.data_vencimento DESC, fc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores';
    END IF;
    RETURN QUERY
    SELECT p.id, p.role, p.nome, p.avatar_url, p.loja_id,
           e.nome_fantasia AS loja_nome, p.ativo, p.created_at, p.updated_at
    FROM perfis p
    LEFT JOIN empresas e ON p.loja_id = e.id
    ORDER BY p.ativo DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
