-- ==============================================================================
-- MIGRATION: COMPATIBILIDADE LEGADO (USUARIOS -> PERFIS)
-- ==============================================================================
-- Data: 2026-02-11
-- Motivo: O código legado (useCaixaBolao.ts) referência a tabela 'usuarios' e 
--         a coluna 'vendedor_id', mas o sistema novo usa 'perfis' e 'usuario_id'.
-- ==============================================================================

-- 1. Criar View para simular a tabela 'usuarios'
CREATE OR REPLACE VIEW public.usuarios AS 
SELECT 
    id,
    id as vendedor_id, -- Alias para compatibilidade
    nome as nome_completo, -- Alias se necessário (verificar uso)
    nome,
    email,
    role,
    loja_id,
    ativo,
    created_at,
    updated_at,
    avatar_url
FROM public.perfis;

-- 2. Garantir permissões
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.usuarios TO service_role;

-- 3. Comentário explicativo
COMMENT ON VIEW public.usuarios IS 'View de compatibilidade para código legado que ainda busca a tabela usuarios.';
