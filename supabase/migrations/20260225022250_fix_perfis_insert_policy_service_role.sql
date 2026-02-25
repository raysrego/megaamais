/*
  # Corrigir Politica de INSERT em Perfis para Service Role

  ## Problema
    - Politica INSERT em perfis usa is_admin() que requer auth.uid()
    - Service Role Key nao tem auth.uid(), causando erro
    
  ## Solucao
    - Criar politica permissiva para service_role
    - Manter verificacao de seguranca para usuarios normais
    
  ## Alteracoes
    - DROP e recriar politica de INSERT
    - Permitir INSERT via service_role
*/

-- ==========================================
-- 1. REMOVER POLITICA ANTIGA
-- ==========================================

DROP POLICY IF EXISTS perfis_insert_policy ON perfis;

-- ==========================================
-- 2. CRIAR NOVA POLITICA PERMISSIVA
-- ==========================================

-- Service Role pode inserir (usado por admin actions)
-- Usuarios autenticados so podem inserir se forem admin
CREATE POLICY perfis_insert_policy
    ON perfis
    FOR INSERT
    WITH CHECK (
        -- Service role sempre pode (usado em createNewUser)
        (current_setting('role') = 'service_role')
        OR
        -- Usuario autenticado admin pode
        (auth.uid() IS NOT NULL AND is_admin())
    );

-- ==========================================
-- 3. GARANTIR QUE RLS ESTA ATIVO
-- ==========================================

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. COMENTARIOS
-- ==========================================

COMMENT ON POLICY perfis_insert_policy ON perfis IS 
'Permite INSERT via service_role (admin actions) ou usuarios admin autenticados';
