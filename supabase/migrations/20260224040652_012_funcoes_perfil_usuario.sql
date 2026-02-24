/*
  # Funções de Perfil de Usuário
  
  1. Novas Funções
    - `get_my_profile` - Retorna perfil do usuário logado
    - `update_my_profile` - Atualiza perfil do usuário logado
    
  2. Uso
    - Chamadas pelo frontend para gerenciar perfil
    - Usa auth.uid() para segurança
    - Retorna dados completos do perfil
*/

-- Função: Get My Profile
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
    SELECT 
        p.id,
        p.role,
        p.nome,
        p.avatar_url,
        p.loja_id,
        p.ativo,
        p.created_at,
        p.updated_at
    FROM perfis p
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Update My Profile
CREATE OR REPLACE FUNCTION update_my_profile(
    p_nome TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE perfis
    SET 
        nome = COALESCE(p_nome, nome),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Get User Full Info (com empresa)
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
    SELECT 
        p.id,
        p.role,
        p.nome,
        p.avatar_url,
        p.loja_id,
        e.nome AS loja_nome,
        e.nome_fantasia AS loja_nome_fantasia,
        p.ativo
    FROM perfis p
    LEFT JOIN empresas e ON p.loja_id = e.id
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;