/*
  # Fix OFX unique constraint and add performance indexes

  ## Problem
  The `ofx_transacoes` table had no unique constraint on `(loja_id, fitid)`,
  causing the upsert in `salvarTransacoesOFX` to fail with an error that
  bubbled up as the "Server Components render" error during OFX import.

  ## Changes

  ### 1. ofx_transacoes
  - Add UNIQUE constraint on (loja_id, fitid) — required for upsert onConflict
  - Add composite index on (loja_id, data, tipo) for reconciliation queries

  ### 2. Performance indexes — composite indexes for frequent query patterns
  - caixa_sessoes(loja_id, auditoria_status) — auditoria list filtered by loja + status
  - caixa_sessoes(loja_id, data_turno) — date-range queries per loja
  - caixa_movimentacoes(sessao_id, deleted_at) — movimentações per sessão excluindo deletadas
  - financeiro_contas(loja_id, status, deleted_at) — contas a pagar/receber ativas
  - cofre_movimentacoes(loja_id, tipo, deleted_at) — cofre por tipo e loja
  - pix_externos_sessao(loja_id, data_pix) — conciliação por loja e data

  ### 3. RLS helper functions
  - Rewrite is_admin(), is_gerente_or_admin(), user_loja_id() as SECURITY DEFINER
    with explicit search_path to prevent infinite recursion when called from RLS policies
*/

-- ─── 1. OFX unique constraint (required for upsert to work) ──────────────────

-- Remove any duplicate rows first (keep the one with lowest id)
DELETE FROM public.ofx_transacoes a
USING public.ofx_transacoes b
WHERE a.id > b.id
  AND a.loja_id = b.loja_id
  AND a.fitid = b.fitid;

-- Add the unique constraint
ALTER TABLE public.ofx_transacoes
  DROP CONSTRAINT IF EXISTS ofx_transacoes_loja_fitid_unique;

ALTER TABLE public.ofx_transacoes
  ADD CONSTRAINT ofx_transacoes_loja_fitid_unique UNIQUE (loja_id, fitid);

-- ─── 2. Performance composite indexes ────────────────────────────────────────

-- caixa_sessoes: auditoria list (most common admin query)
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_loja_audit
  ON public.caixa_sessoes (loja_id, auditoria_status, data_turno DESC);

-- caixa_sessoes: pendentes com status aberto/fechado
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_loja_status
  ON public.caixa_sessoes (loja_id, status);

-- caixa_movimentacoes: per session, exclude soft-deleted
CREATE INDEX IF NOT EXISTS idx_caixa_mov_sessao_active
  ON public.caixa_movimentacoes (sessao_id, deleted_at)
  WHERE deleted_at IS NULL;

-- financeiro_contas: active contas by loja + status
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_loja_status_active
  ON public.financeiro_contas (loja_id, status, data_vencimento)
  WHERE deleted_at IS NULL;

-- cofre_movimentacoes: por loja + tipo (deposito/sangria)
CREATE INDEX IF NOT EXISTS idx_cofre_mov_loja_tipo_active
  ON public.cofre_movimentacoes (loja_id, tipo, data_movimentacao DESC)
  WHERE deleted_at IS NULL;

-- pix_externos_sessao: conciliação por loja e data
CREATE INDEX IF NOT EXISTS idx_pix_externos_loja_data_conciliado
  ON public.pix_externos_sessao (loja_id, data_pix, conciliado);

-- ofx_transacoes: reconciliation query (loja + date + tipo)
CREATE INDEX IF NOT EXISTS idx_ofx_transacoes_loja_data_tipo
  ON public.ofx_transacoes (loja_id, data, tipo);

-- fechamento_tfl: auditoria list
CREATE INDEX IF NOT EXISTS idx_fechamento_tfl_loja_status_data
  ON public.fechamento_tfl (loja_id, status_auditoria, data_referencia DESC);

-- ─── 3. RLS helper functions — SECURITY DEFINER to prevent policy recursion ──

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_gerente_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_loja_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT loja_id FROM public.perfis WHERE id = auth.uid();
$$;
