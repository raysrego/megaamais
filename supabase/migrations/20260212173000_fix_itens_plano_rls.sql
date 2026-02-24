-- Migration: Fix Financeiro Itens Plano RLS (Allow Global Items)
-- Description: Corrige a política de leitura para permitir que Admins de Loja vejam categorias Globais (loja_id IS NULL)

-- 1. DROP na política antiga restritiva
DROP POLICY IF EXISTS "itens_plano_isolation_select" ON financeiro_itens_plano;

-- 2. Recria política permitindo (Minha Loja OR Global)
CREATE POLICY "itens_plano_isolation_select" 
ON financeiro_itens_plano
FOR SELECT 
TO authenticated 
USING (
    public.is_master() 
    OR 
    loja_id = public.get_my_loja_id() 
    OR 
    loja_id IS NULL -- ✅ Correção: Permite ver itens globais
);

-- 3. Garante permissão de leitura para authenticated (caso falte)
GRANT SELECT ON financeiro_itens_plano TO authenticated;
