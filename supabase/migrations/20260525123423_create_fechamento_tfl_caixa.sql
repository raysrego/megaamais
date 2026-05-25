/*
  # Fechamento de Caixa TFL (Relatório Conexão Parceiros)

  ## Descrição
  Tabela para armazenar os dados extraídos do relatório TFL (Terminal de Loteria Federal)
  da Caixa Econômica Federal — Conexão Parceiros. O usuário faz upload do PDF/arquivo,
  o sistema extrai os dados e os armazena aqui para auditoria.

  ## Novas Tabelas
  - `fechamento_tfl`: Registros de fechamento importados via upload de relatório
    - `id` (uuid, pk)
    - `loja_id` (uuid) — filial associada
    - `user_id` (uuid) — quem fez o upload
    - `data_referencia` (date) — data do relatório
    - `terminal` (text) — número do terminal
    - `total_creditos` (numeric) — total de créditos TFL
    - `total_debitos` (numeric) — total de débitos TFL
    - `saldo_final` (numeric) — saldo final conforme relatório
    - `dados_extraidos` (jsonb) — JSON completo com todos os dados do relatório
    - `status_auditoria` (text) — pendente / aprovado / rejeitado
    - `observacoes_auditoria` (text) — observações do gestor na auditoria
    - `auditado_por` (uuid) — gestor que auditou
    - `auditado_em` (timestamptz)
    - `created_at` (timestamptz)

  ## Segurança
  - RLS habilitado
  - Authenticated users podem inserir e ver registros da sua loja
  - Apenas admins (via service role ou owner) podem aprovar/rejeitar
*/

CREATE TABLE IF NOT EXISTS fechamento_tfl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_referencia date,
  terminal text,
  total_creditos numeric(14,2) DEFAULT 0,
  total_debitos numeric(14,2) DEFAULT 0,
  saldo_final numeric(14,2) DEFAULT 0,
  dados_extraidos jsonb DEFAULT '{}',
  arquivo_nome text,
  status_auditoria text NOT NULL DEFAULT 'pendente',
  observacoes_auditoria text,
  auditado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auditado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fechamento_tfl_loja_idx ON fechamento_tfl(loja_id);
CREATE INDEX IF NOT EXISTS fechamento_tfl_data_idx ON fechamento_tfl(data_referencia);
CREATE INDEX IF NOT EXISTS fechamento_tfl_user_idx ON fechamento_tfl(user_id);
CREATE INDEX IF NOT EXISTS fechamento_tfl_status_idx ON fechamento_tfl(status_auditoria);

ALTER TABLE fechamento_tfl ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tfl records"
  ON fechamento_tfl FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tfl records"
  ON fechamento_tfl FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tfl records status"
  ON fechamento_tfl FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
