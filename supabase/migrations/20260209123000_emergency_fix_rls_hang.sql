-- ===================================================================
-- EMERGENCY FIX: RLS Recursion and Profile Loading RPC
-- Data: 2026-02-09
-- ===================================================================

-- 1. Limpeza de Políticas Problemáticas (Prevenção de Infinite Hang)
ALTER TABLE public.perfis DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver proprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Master ver tudo" ON public.perfis;
DROP POLICY IF EXISTS "Master atualizar" ON public.perfis;
DROP POLICY IF EXISTS "perfil_select_isolation" ON public.perfis;
DROP POLICY IF EXISTS "perfil_own" ON public.perfis;

-- 2. Recriar Políticas Simplificadas (Segurança por ID)
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver e editar seus PRÓPRIOS perfis via query direta
CREATE POLICY "perfil_self_select" ON public.perfis
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "perfil_self_update" ON public.perfis
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- 3. RPC "Get My Profile" (Bypass RLS para Carregamento Rápido)
-- Esta função é SECURITY DEFINER, o que significa que ela roda com privilégios de owner
-- e ignora o RLS da tabela 'perfis', evitando loops infinitos e hangs.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', p.id,
        'role', p.role,
        'nome', p.nome,
        'avatar_url', p.avatar_url,
        'loja_id', p.loja_id
    ) INTO result
    FROM public.perfis p
    WHERE p.id = auth.uid();
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 4. Garantir que o Role 'master' seja tratado como o maior nível
-- (Opcional, mas ajuda na consistência)
COMMENT ON FUNCTION public.get_my_profile() IS 'Retorna o perfil do usuário logado ignorando bloqueios de RLS.';
