-- ==========================================
-- LIMPEZA SIMPLES - COPIE E COLE AGORA
-- ==========================================

-- PASSO 1: DELETAR REGISTROS DE TESTE
DELETE FROM caixa_sessoes 
WHERE status IN ('fechado', 'batido', 'divergente')
  AND DATE(created_at) = CURRENT_DATE;

DELETE FROM caixa_bolao_sessoes 
WHERE status_validacao IN ('pendente', 'aprovado', 'discrepante', 'rejeitado')
  AND DATE(data_fechamento) = CURRENT_DATE;

-- PASSO 2: VERIFICAR RESULTADO
-- TFL
SELECT 'TFL' as tabela, status::text, COUNT(*) as qtd
FROM caixa_sessoes 
GROUP BY status;

-- Bolão
SELECT 'Bolão' as tabela, status_validacao::text, COUNT(*) as qtd
FROM caixa_bolao_sessoes 
GROUP BY status_validacao;
