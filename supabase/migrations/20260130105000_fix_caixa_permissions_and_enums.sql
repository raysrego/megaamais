-- Migration: Fix Caixa Permissions and Enums
-- Description: Garante permissão de uso das sequências para permitir INSERT e expande os status de caixa para bater com o frontend.

-- 1. Garantir permissão de sequências para usuários autenticados
-- A migração anterior de RBAC removeu essas permissões.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2. Expandir o enum de status do caixa para suportar os termos usados no frontend
-- Nota: ALTER TYPE ADD VALUE não pode ser executado em bloco transacional.
-- Como queremos garantir que funcione, rodamos individualmente fora de transação se possível.
-- No Supabase, migrações rodam individualmente.

ALTER TYPE caixa_status ADD VALUE IF NOT EXISTS 'batido';
ALTER TYPE caixa_status ADD VALUE IF NOT EXISTS 'divergente';

-- 3. Atualizar RLS para caixa_sessoes (Permitir Gestores/Admins verem tudo)
DROP POLICY IF EXISTS "Usuários podem ver suas próprias sessões de caixa" ON public.caixa_sessoes;
CREATE POLICY "Visualização de sessões: Dono ou Admin" ON public.caixa_sessoes
FOR SELECT TO authenticated USING (
    auth.uid() = usuario_id OR public.is_admin() OR public.is_master()
);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias sessões (fechamento)" ON public.caixa_sessoes;
CREATE POLICY "Atualização de sessões: Dono ou Admin" ON public.caixa_sessoes
FOR UPDATE TO authenticated USING (
    auth.uid() = usuario_id OR public.is_admin() OR public.is_master()
);

-- 4. Atualizar RLS para caixa_movimentacoes
DROP POLICY IF EXISTS "Usuários podem ver as movimentações das suas sessões" ON public.caixa_movimentacoes;
CREATE POLICY "Visualização de movimentações: Acesso via sessão" ON public.caixa_movimentacoes
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.caixa_sessoes s 
        WHERE s.id = sessao_id 
        AND (s.usuario_id = auth.uid() OR public.is_admin() OR public.is_master())
    )
);

-- 5. Garantir Grants finais
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
