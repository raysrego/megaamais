-- Migration: Fix Financeiro Parametros RLS
-- Description: Garante que todos os usuários autenticados possam ler os parâmetros do sistema (evita erro 403/42501)

-- 1. Garante que RLS está ativo
ALTER TABLE IF EXISTS financeiro_parametros ENABLE ROW LEVEL SECURITY;

-- 2. Limpa políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Leitura pública de parâmetros" ON financeiro_parametros;
DROP POLICY IF EXISTS "Acesso total para Master" ON financeiro_parametros;
DROP POLICY IF EXISTS "financeiro_parametros_read_policy" ON financeiro_parametros;

-- 3. Cria política permissiva de LEITURA (SELECT) para todos os autenticados
CREATE POLICY "financeiro_parametros_read_policy" 
ON financeiro_parametros
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Cria política de ESCRITA (ALL) apenas para MASTER/ADMIN (se necessário)
CREATE POLICY "financeiro_parametros_write_policy" 
ON financeiro_parametros
FOR ALL 
TO authenticated 
USING (public.is_master());

-- 5. Garantia extra de GRANT (caso esteja faltando acesso básico à tabela)
GRANT SELECT ON financeiro_parametros TO authenticated;
GRANT ALL ON financeiro_parametros TO service_role;
