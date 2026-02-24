-- ==========================================
-- SPRINT 1 - GAP #7: Correção de RLS em vendas_boloes
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Restringir acesso a vendas por perfil e loja
-- ==========================================

-- 1. REMOVER POLÍTICAS PERMISSIVAS ANTIGAS
DROP POLICY IF EXISTS "Vendedores podem ver suas proprias vendas" ON vendas_boloes;
DROP POLICY IF EXISTS "Vendedores podem registrar vendas" ON vendas_boloes;
DROP POLICY IF EXISTS "Gestores podem ver todas as vendas" ON vendas_boloes;

-- 2. CRIAR POLÍTICAS RESTRITIVAS POR PERFIL

-- 2.1 Operadores só veem suas próprias vendas
CREATE POLICY "operador_venda_select_own" ON vendas_boloes
  FOR SELECT TO authenticated
  USING (
    auth.uid() = usuario_id
    OR public.is_admin()
  );

-- 2.2 Operadores só podem inserir vendas em seu próprio nome
CREATE POLICY "operador_venda_insert_own" ON vendas_boloes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = usuario_id
    AND EXISTS (
      SELECT 1 FROM caixa_sessoes cs
      WHERE cs.id = sessao_caixa_id
        AND cs.operador_id = auth.uid()
        AND cs.status = 'aberto'
    )
  );

-- 2.3 Gerentes veem vendas da mesma loja
CREATE POLICY "gerente_venda_select_loja" ON vendas_boloes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM caixa_sessoes cs
      JOIN perfis p ON p.id = auth.uid()
      WHERE cs.id = vendas_boloes.sessao_caixa_id
        AND cs.loja_id = p.loja_id
        AND p.role IN ('gerente', 'admin')
    )
  );

-- 2.4 Apenas Admin pode UPDATE vendas (para correções)
CREATE POLICY "admin_venda_update" ON vendas_boloes
  FOR UPDATE TO authenticated
  USING (public.is_master())
  WITH CHECK (public.is_master());

-- 2.5 Apenas Admin pode DELETE vendas (soft delete recomendado)
CREATE POLICY "admin_venda_delete" ON vendas_boloes
  FOR DELETE TO authenticated
  USING (public.is_master());

-- 3. ADICIONAR CAMPO DE SOFT DELETE (Recomendação de Auditoria)
ALTER TABLE vendas_boloes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE vendas_boloes ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 4. CRIAR VIEW PARA VENDAS ATIVAS (Exclui deletadas)
CREATE OR REPLACE VIEW vw_vendas_boloes_ativas AS
SELECT 
  vb.*,
  b.concurso,
  b.data_sorteio,
  p.nome AS produto_nome,
  p.cor AS produto_cor,
  perf.nome AS vendedor_nome,
  cs.loja_id
FROM vendas_boloes vb
JOIN boloes b ON b.id = vb.bolao_id
JOIN produtos p ON p.id = b.produto_id
JOIN perfis perf ON perf.id = vb.usuario_id
JOIN caixa_sessoes cs ON cs.id = vb.sessao_caixa_id
WHERE vb.deleted_at IS NULL;

-- 5. GRANT de SELECT na view para autenticados
GRANT SELECT ON vw_vendas_boloes_ativas TO authenticated;

-- 6. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON POLICY "operador_venda_select_own" ON vendas_boloes IS 
'Operadores só podem visualizar suas próprias vendas, exceto Admin que vê tudo.';

COMMENT ON POLICY "operador_venda_insert_own" ON vendas_boloes IS 
'Operadores só podem inserir vendas em sessões de caixa abertas em seu próprio nome.';

COMMENT ON POLICY "gerente_venda_select_loja" ON vendas_boloes IS 
'Gerentes e Admins podem visualizar todas as vendas da sua loja.';

COMMENT ON VIEW vw_vendas_boloes_ativas IS 
'View que exibe apenas vendas não deletadas (soft delete), com joins nas tabelas relacionadas.';
