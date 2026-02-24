-- ==========================================
-- LIMPEZA DE REGISTROS DE TESTE
-- CORREÇÃO FINAL - NOMES DE COLUNAS CORRETOS
-- Data: 2026-02-03
-- ==========================================

-- ==========================================
-- PASSO 1: VERIFICAR O QUE EXISTE
-- ==========================================

-- 1A. Ver fechamentos TFL
SELECT 
    id,
    terminal_id,
    status,
    valor_final_declarado as saldo,
    created_at as data
FROM caixa_sessoes 
ORDER BY created_at DESC
LIMIT 20;

-- 1B. Ver fechamentos Bolão
SELECT 
    id,
    status_validacao,
    total_vendido,
    total_dinheiro,
    total_pix,
    data_fechamento
FROM caixa_bolao_sessoes 
ORDER BY data_fechamento DESC
LIMIT 20;

-- ==========================================
-- PASSO 2: DELETAR REGISTROS DE TESTE
-- Execute APENAS o bloco que desejar
-- ==========================================

-- OPÇÃO A: Deletar APENAS DE HOJE (RECOMENDADO) ✅
-- TFL de hoje
DELETE FROM caixa_sessoes 
WHERE status IN ('fechado', 'batido', 'divergente')
  AND DATE(created_at) = CURRENT_DATE;

-- Bolão de hoje
DELETE FROM caixa_bolao_sessoes 
WHERE status_validacao IN ('pendente', 'aprovado', 'discrepante', 'rejeitado')
  AND DATE(data_fechamento) = CURRENT_DATE;


-- OPÇÃO B: Deletar por período específico
-- TFL entre datas
DELETE FROM caixa_sessoes 
WHERE status IN ('fechado', 'batido', 'divergente')
  AND created_at >= '2026-02-03 00:00:00'
  AND created_at <= '2026-02-03 23:59:59';

-- Bolão entre datas
DELETE FROM caixa_bolao_sessoes 
WHERE status_validacao IN ('pendente', 'aprovado', 'discrepante', 'rejeitado')
  AND data_fechamento >= '2026-02-03 00:00:00'
  AND data_fechamento <= '2026-02-03 23:59:59';


-- OPÇÃO C: Deletar TUDO (CUIDADO!)
-- TFL completo
DELETE FROM caixa_sessoes 
WHERE status IN ('fechado', 'batido', 'divergente');

-- Bolão completo
DELETE FROM caixa_bolao_sessoes 
WHERE status_validacao IN ('pendente', 'aprovado', 'discrepante', 'rejeitado');

-- ==========================================
-- PASSO 3: VERIFICAÇÃO FINAL
-- ==========================================

-- Contar TFL por status
SELECT status::text, COUNT(*) as quantidade 
FROM caixa_sessoes 
GROUP BY status
ORDER BY status;

-- Contar Bolão por status
SELECT status_validacao::text, COUNT(*) as quantidade 
FROM caixa_bolao_sessoes 
GROUP BY status_validacao
ORDER BY status_validacao;

-- Total geral
SELECT 'TFL' as tipo, COUNT(*) as total FROM caixa_sessoes
UNION ALL
SELECT 'Bolão' as tipo, COUNT(*) as total FROM caixa_bolao_sessoes;
