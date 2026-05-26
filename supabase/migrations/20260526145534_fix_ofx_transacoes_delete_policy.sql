/*
  # Fix ofx_transacoes DELETE policy

  Corrects a typo: 'perfis_unidos' → 'perfis_usuarios' in the DELETE RLS policy
  for the ofx_transacoes table.
*/

DROP POLICY IF EXISTS "Autenticados deletam transações OFX" ON public.ofx_transacoes;

CREATE POLICY "Autenticados deletam transações OFX"
  ON public.ofx_transacoes FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
