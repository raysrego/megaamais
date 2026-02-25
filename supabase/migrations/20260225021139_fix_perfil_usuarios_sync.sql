/*
  # Sincronizacao entre Perfis e Usuarios

  ## Problema
    - Tabela usuarios nao e populada quando perfil e criado
    - createNewUser no codigo nao insere em usuarios
    
  ## Solucao
    - Criar trigger em perfis para popular usuarios automaticamente
    - Sincronizar dados existentes
    
  ## Alteracoes
    - Funcao handle_perfil_to_usuarios
    - Trigger sync_perfil_to_usuarios
    - Sincronizacao de dados existentes
*/

-- ==========================================
-- 1. FUNCAO PARA SINCRONIZAR PERFIS -> USUARIOS
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_perfil_to_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
    v_empresa_id UUID;
BEGIN
    -- Buscar email do usuario no auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = NEW.id;
    
    -- Determinar empresa_id
    IF NEW.role = 'admin' THEN
        -- Admin: usar primeira empresa disponivel
        SELECT id INTO v_empresa_id FROM empresas LIMIT 1;
    ELSE
        -- Outros: usar loja_id ou primeira empresa
        v_empresa_id := COALESCE(NEW.loja_id, (SELECT id FROM empresas LIMIT 1));
    END IF;
    
    -- Se ainda nao tiver empresa, lancar erro
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma empresa encontrada no sistema';
    END IF;
    
    -- Inserir ou atualizar na tabela usuarios
    INSERT INTO public.usuarios (
        id,
        empresa_id,
        nome,
        email,
        role,
        ativo,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_empresa_id,
        NEW.nome,
        COALESCE(v_email, NEW.nome || '@sistema.local'),
        COALESCE(NEW.role::VARCHAR, 'operador'),
        COALESCE(NEW.ativo, true),
        COALESCE(NEW.created_at, NOW()),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, usuarios.empresa_id),
        nome = EXCLUDED.nome,
        email = COALESCE(EXCLUDED.email, usuarios.email),
        role = EXCLUDED.role,
        ativo = EXCLUDED.ativo,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- ==========================================
-- 2. CRIAR TRIGGER ON PERFIS
-- ==========================================

DROP TRIGGER IF EXISTS sync_perfil_to_usuarios ON perfis;

CREATE TRIGGER sync_perfil_to_usuarios
    AFTER INSERT OR UPDATE ON perfis
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_perfil_to_usuarios();

-- ==========================================
-- 3. SINCRONIZAR DADOS EXISTENTES
-- ==========================================

DO $$
DECLARE
    v_empresa_id UUID;
BEGIN
    -- Buscar primeira empresa
    SELECT id INTO v_empresa_id FROM empresas LIMIT 1;
    
    IF v_empresa_id IS NULL THEN
        RAISE NOTICE 'Nenhuma empresa encontrada - criacao de usuarios pode falhar';
        RETURN;
    END IF;
    
    -- Sincronizar perfis existentes para usuarios
    INSERT INTO public.usuarios (
        id,
        empresa_id,
        nome,
        email,
        role,
        ativo,
        created_at,
        updated_at
    )
    SELECT 
        p.id,
        COALESCE(p.loja_id, v_empresa_id),
        p.nome,
        COALESCE(au.email, p.nome || '@sistema.local'),
        COALESCE(p.role::VARCHAR, 'operador'),
        COALESCE(p.ativo, true),
        COALESCE(p.created_at, NOW()),
        NOW()
    FROM perfis p
    LEFT JOIN auth.users au ON au.id = p.id
    WHERE NOT EXISTS (
        SELECT 1 FROM usuarios u WHERE u.id = p.id
    )
    ON CONFLICT (id) DO UPDATE
    SET
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        ativo = EXCLUDED.ativo,
        updated_at = NOW();
END $$;

-- ==========================================
-- 4. ADICIONAR COMENTARIOS
-- ==========================================

COMMENT ON FUNCTION public.handle_perfil_to_usuarios() IS 'Sincroniza automaticamente dados de perfis para tabela usuarios';
COMMENT ON TRIGGER sync_perfil_to_usuarios ON perfis IS 'Mantem tabela usuarios sincronizada com perfis';
