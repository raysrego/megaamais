-- Migration: Allow Operators to Read Boloes
-- Description: Corrige a política RLS permitindo que operadores vejam os bolões criados por Admins/Gerentes.

-- 1. Política de Leitura para Bolões (Permitir acesso total de leitura a autenticados)
-- A política anterior estava muito restrita ou inexistente para leitura cruzada.
DROP POLICY IF EXISTS "boloes_read_access" ON public.boloes;
CREATE POLICY "boloes_read_access" ON public.boloes
FOR SELECT TO authenticated USING (true); -- Qualquer usuário logado pode ver bolões (para vender)

-- 2. Manter política de Escrita/Modificação restrita
DROP POLICY IF EXISTS "boloes_write_access" ON public.boloes;
CREATE POLICY "boloes_write_access" ON public.boloes
FOR ALL TO authenticated USING (
    public.is_admin() OR public.is_master()
);

-- 3. Grants de garantia
GRANT SELECT ON public.boloes TO authenticated;
