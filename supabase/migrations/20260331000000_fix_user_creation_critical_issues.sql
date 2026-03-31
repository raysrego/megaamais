/*
  # Correções Críticas - Criação de Usuários

  ## Problemas Corrigidos

  1. Políticas DELETE ausentes em perfis e usuarios
  2. Sincronização não-idempotente com falhas
  3. Políticas INSERT/UPDATE muito restritivas
  4. Ausência de auditoria em DELETE
  5. Falta de ferramentas de diagnóstico

  ## Soluções

  - Políticas DELETE granulares com auditoria
  - Trigger idempotente com error handling
  - Policies separadas INSERT/UPDATE
  - Auditoria automática de DELETE
  - Função check_perfis_usuarios_sync()
*/

-- 1. FUNÇÃO DE SINCRONIZAÇÃO IDEMPOTENTE
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
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;

    IF NEW.role = 'admin' THEN
        SELECT id INTO v_empresa_id FROM empresas ORDER BY created_at LIMIT 1;
    ELSE
        v_empresa_id := NEW.loja_id;
        IF v_empresa_id IS NULL THEN
            SELECT id INTO v_empresa_id FROM empresas ORDER BY created_at LIMIT 1;
        END IF;
    END IF;

    IF v_empresa_id IS NULL AND NEW.role != 'admin' THEN
        RAISE WARNING 'Perfil % não sincronizado: nenhuma empresa disponível', NEW.id;
        RETURN NEW;
    END IF;

    INSERT INTO public.usuarios (
        id, empresa_id, nome, email, role, ativo, created_at, updated_at
    )
    VALUES (
        NEW.id, v_empresa_id, NEW.nome,
        COALESCE(v_email, NEW.nome || '@interno.sistema'),
        COALESCE(NEW.role::VARCHAR, 'operador'),
        COALESCE(NEW.ativo, true),
        COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, usuarios.empresa_id),
        nome = EXCLUDED.nome,
        email = COALESCE(EXCLUDED.email, usuarios.email),
        role = EXCLUDED.role,
        ativo = EXCLUDED.ativo,
        updated_at = NOW()
    WHERE
        usuarios.nome != EXCLUDED.nome OR
        usuarios.email != COALESCE(EXCLUDED.email, usuarios.email) OR
        usuarios.role != EXCLUDED.role OR
        usuarios.ativo != EXCLUDED.ativo OR
        usuarios.empresa_id IS DISTINCT FROM COALESCE(EXCLUDED.empresa_id, usuarios.empresa_id);

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao sincronizar perfil % para usuarios: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- 2. POLÍTICAS DELETE
DROP POLICY IF EXISTS "perfis_delete_policy" ON perfis;
DROP POLICY IF EXISTS "usuarios_delete_policy" ON usuarios;

CREATE POLICY "perfis_delete_policy" ON perfis FOR DELETE
    USING ((current_setting('role') = 'service_role') OR (auth.uid() IS NOT NULL AND is_admin()));

CREATE POLICY "usuarios_delete_policy" ON usuarios FOR DELETE
    USING ((current_setting('role') = 'service_role') OR (auth.uid() IS NOT NULL AND is_admin()));

-- 3. POLÍTICAS INSERT/UPDATE SEPARADAS
DROP POLICY IF EXISTS "usuarios_all_policy" ON usuarios;

CREATE POLICY "usuarios_insert_policy" ON usuarios FOR INSERT
    WITH CHECK ((current_setting('role') = 'service_role') OR (auth.uid() IS NOT NULL AND is_admin()));

CREATE POLICY "usuarios_update_policy" ON usuarios FOR UPDATE
    USING ((current_setting('role') = 'service_role') OR (auth.uid() IS NOT NULL AND is_admin()))
    WITH CHECK ((current_setting('role') = 'service_role') OR (auth.uid() IS NOT NULL AND is_admin()));

-- 4. AUDITORIA DE DELETE
CREATE OR REPLACE FUNCTION public.audit_perfil_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, ip_address)
    VALUES (
        auth.uid(), 'DELETE', 'perfis', OLD.id::text,
        jsonb_build_object('id', OLD.id, 'nome', OLD.nome, 'role', OLD.role,
            'loja_id', OLD.loja_id, 'ativo', OLD.ativo,
            'deleted_by', auth.uid(), 'deleted_at', NOW()),
        inet_client_addr()
    );
    RETURN OLD;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao auditar delete de perfil %: %', OLD.id, SQLERRM;
        RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS audit_perfil_delete_trigger ON perfis;
CREATE TRIGGER audit_perfil_delete_trigger BEFORE DELETE ON perfis
    FOR EACH ROW EXECUTE FUNCTION public.audit_perfil_delete();

-- 5. MELHORAR handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfis (id, nome, role, ativo)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', new.email),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'operador'),
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao criar perfil para usuário %: %', new.id, SQLERRM;
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNÇÃO DE DIAGNÓSTICO
CREATE OR REPLACE FUNCTION public.check_perfis_usuarios_sync()
RETURNS TABLE(perfil_id UUID, issue TEXT, perfil_nome TEXT, perfil_role TEXT, usuario_exists BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        CASE
            WHEN u.id IS NULL THEN 'Usuario não existe para este perfil'
            WHEN p.nome != u.nome THEN 'Nome desincronizado'
            WHEN p.role::VARCHAR != u.role THEN 'Role desincronizado'
            WHEN p.ativo != u.ativo THEN 'Status ativo desincronizado'
            ELSE 'OK'
        END AS issue,
        p.nome, p.role::TEXT, (u.id IS NOT NULL)
    FROM perfis p
    LEFT JOIN usuarios u ON p.id = u.id
    WHERE p.ativo = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. GARANTIR RLS
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
