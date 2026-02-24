-- ==========================================
-- EXECUÇÃO DIRETA - COPIE E COLE ESTE BLOCO
-- ==========================================
-- Este SQL está pronto para executar agora mesmo
-- Ele deleta apenas os registros de teste de HOJE
-- ==========================================

-- 1. Deletar fechamentos TFL de teste de hoje
DELETE FROM caixa_sessoes 
WHERE status IN ('fechado', 'batido', 'divergente')
  AND DATE(created_at) = CURRENT_DATE;

-- 2. Deletar fechamentos Bolão de teste de hoje
DELETE FROM caixa_bolao_sessoes 
WHERE status_validacao IN ('pendente', 'aprovado', 'discrepante', 'rejeitado')
  AND DATE(data_fechamento) = CURRENT_DATE;

-- 3. Confirmar limpeza
SELECT 
    'TFL' as tipo,
    status::text as status,
    COUNT(*) as quantidade 
FROM caixa_sessoes 
GROUP BY status
UNION ALL
SELECT 
    'Bolão' as tipo,
    status_validacao::text as status,
    COUNT(*) as quantidade 
FROM caixa_bolao_sessoes 
GROUP BY status_validacao;
