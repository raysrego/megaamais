/*
  # Fechamento de Caixa Automatizado (AI)

  ## Descrição
  Tabela para armazenar resultados da análise automática de fichas de fechamento de caixa
  via inteligência artificial (Claude Vision).

  ## Segurança
  - RLS habilitado
  - Acesso somente para usuários autenticados aos seus próprios registros ou registros da sua loja
  - As políticas usam user_id para controle de acesso
*/

CREATE TABLE IF NOT EXISTS fechamento_caixa_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_documento text NOT NULL DEFAULT 'DESCONHECIDO',
  data_documento date,
  terminal text,
  dados_extraidos jsonb DEFAULT '{}',
  imagem_url text,
  status_processamento text NOT NULL DEFAULT 'processado',
  erro_mensagem text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fechamento_caixa_ia_loja_idx ON fechamento_caixa_ia(loja_id);
CREATE INDEX IF NOT EXISTS fechamento_caixa_ia_data_idx ON fechamento_caixa_ia(data_documento);
CREATE INDEX IF NOT EXISTS fechamento_caixa_ia_user_idx ON fechamento_caixa_ia(user_id);

ALTER TABLE fechamento_caixa_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados visualizam registros"
  ON fechamento_caixa_ia FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados inserem registros"
  ON fechamento_caixa_ia FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios atualizam seus proprios registros"
  ON fechamento_caixa_ia FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios excluem seus proprios registros"
  ON fechamento_caixa_ia FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
