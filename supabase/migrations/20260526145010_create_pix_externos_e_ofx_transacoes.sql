/*
  # PIX Externos Unitários e Transações OFX

  ## Objetivo
  Permite registrar PIX externos por valor unitário e data (vinculados a uma sessão de caixa),
  e armazenar as transações importadas via arquivo OFX para conciliação detalhada.

  ## Novas Tabelas

  ### pix_externos_sessao
  - Cada linha representa um PIX externo recebido individualmente durante o turno
  - Vinculado a caixa_sessoes (sessao_id) via referência sem FK obrigatória (evita erro se tabela não existe)
  - Campos: valor, data_pix, descricao, fitid_ofx (para cruzamento com extrato)

  ### ofx_transacoes
  - Armazena cada transação lida de um arquivo OFX importado
  - Campos: fitid, tipo (CREDIT/DEBIT), data, valor, memo, conciliado, matched_tipo, matched_ref_id
  - matched_tipo: 'pix_externo', 'deposito_cofre', 'sangria', 'pagamento', 'outros'

  ## Segurança
  - RLS habilitado em ambas as tabelas
  - Acesso restrito a usuários autenticados
*/

-- ─── pix_externos_sessao ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pix_externos_sessao (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id bigint NOT NULL,
  loja_id uuid NOT NULL,
  valor numeric(14, 2) NOT NULL CHECK (valor > 0),
  data_pix date NOT NULL,
  descricao text DEFAULT '',
  fitid_ofx text DEFAULT NULL,
  conciliado boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pix_externos_sessao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem pix externos"
  ON public.pix_externos_sessao FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados inserem pix externos"
  ON public.pix_externos_sessao FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Autenticados atualizam pix externos"
  ON public.pix_externos_sessao FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados deletam pix externos"
  ON public.pix_externos_sessao FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pix_externos_sessao ON public.pix_externos_sessao(sessao_id);
CREATE INDEX IF NOT EXISTS idx_pix_externos_data ON public.pix_externos_sessao(data_pix);
CREATE INDEX IF NOT EXISTS idx_pix_externos_loja ON public.pix_externos_sessao(loja_id);

-- ─── ofx_transacoes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ofx_transacoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loja_id uuid NOT NULL,
  conta_id uuid,
  fitid text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('CREDIT', 'DEBIT')),
  data date NOT NULL,
  valor numeric(14, 2) NOT NULL CHECK (valor >= 0),
  memo text DEFAULT '',
  checknum text DEFAULT '',
  conciliado boolean DEFAULT false,
  matched_tipo text DEFAULT NULL CHECK (matched_tipo IS NULL OR matched_tipo IN ('pix_externo', 'deposito_cofre', 'sangria', 'pagamento', 'outros')),
  matched_ref_id bigint DEFAULT NULL,
  arquivo_nome text DEFAULT '',
  importado_em timestamptz DEFAULT now(),
  importado_por uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ofx_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem transações OFX"
  ON public.ofx_transacoes FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados inserem transações OFX"
  ON public.ofx_transacoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = importado_por);

CREATE POLICY "Autenticados atualizam transações OFX"
  ON public.ofx_transacoes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados deletam transações OFX"
  ON public.ofx_transacoes FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_ofx_transacoes_loja ON public.ofx_transacoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_ofx_transacoes_data ON public.ofx_transacoes(data);
CREATE INDEX IF NOT EXISTS idx_ofx_transacoes_fitid ON public.ofx_transacoes(fitid);
CREATE INDEX IF NOT EXISTS idx_ofx_transacoes_conciliado ON public.ofx_transacoes(conciliado);
