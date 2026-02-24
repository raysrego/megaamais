-- ==========================================
-- REFINAMENTO FINAL - ÍNDICES COMPOSTOS
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Acelerar queries mais frequentes do sistema
-- ==========================================

-- 1. COTAS DE BOLÕES - Busca de cotas disponíveis (query mais crítica)
-- Esta é executada a cada venda de bolão
CREATE INDEX IF NOT EXISTS idx_cotas_bolao_status_disponiveis 
ON cotas_boloes(bolao_id, status) 
WHERE status = 'disponivel';

CREATE INDEX IF NOT EXISTS idx_cotas_bolao_todas_status 
ON cotas_boloes(bolao_id, status);

-- 2. VENDAS - Relatórios por operador
CREATE INDEX IF NOT EXISTS idx_vendas_usuario_data 
ON vendas_boloes(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendas_sessao_data 
ON vendas_boloes(sessao_caixa_id, created_at DESC);

-- 3. CAIXA - Sessões abertas por operador (verificação de múltiplos caixas)
CREATE INDEX IF NOT EXISTS idx_caixa_operador_status_aberto 
ON caixa_sessoes(operador_id, status) 
WHERE status = 'aberto';

CREATE INDEX IF NOT EXISTS idx_caixa_operador_data 
ON caixa_sessoes(operador_id, data_abertura DESC);

-- 4. BOLÕES - Listagem por produto e status
CREATE INDEX IF NOT EXISTS idx_boloes_produto_status 
ON boloes(produto_id, status, data_sorteio DESC);

CREATE INDEX IF NOT EXISTS idx_boloes_status_data 
ON boloes(status, data_sorteio) 
WHERE status IN ('disponivel', 'finalizado');

-- 5. TRANSAÇÕES BANCÁRIAS - Consultas por conta
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_data 
ON financeiro_transacoes_bancarias(conta_id, data_transacao DESC);

CREATE INDEX IF NOT EXISTS idx_transacoes_conta_status 
ON financeiro_transacoes_bancarias(conta_id, status_conciliacao) 
WHERE status_conciliacao = 'pendente';

-- 6. FINANCEIRO - Contas por vencimento e status
CREATE INDEX IF NOT EXISTS idx_financeiro_vencimento_status 
ON financeiro_contas(data_vencimento DESC, status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_tipo_status 
ON financeiro_contas(tipo, status, data_vencimento DESC);

-- 7. MOVIMENTAÇÕES DE CAIXA - Relatórios por sessão
CREATE INDEX IF NOT EXISTS idx_caixa_mov_sessao_tipo 
ON caixa_movimentacoes(sessao_id, tipo, created_at DESC);

-- 8. MOVIMENTAÇÕES DE COFRE - Relatórios por operador e tipo
CREATE INDEX IF NOT EXISTS idx_cofre_mov_operador_tipo 
ON cofre_movimentacoes(operador_id, tipo, data_movimentacao DESC) 
WHERE deleted_at IS NULL;

-- 9. AUDIT LOG - Consultas por tabela e usuário
CREATE INDEX IF NOT EXISTS idx_audit_table_user 
ON audit_log(table_name, user_id, created_at DESC);

-- COMENTÁRIOS
COMMENT ON INDEX idx_cotas_bolao_status_disponiveis IS 
'Acelera a busca de cotas disponíveis durante vendas (query mais crítica do sistema).';

COMMENT ON INDEX idx_caixa_operador_status_aberto IS 
'Permite verificação rápida de caixas abertos para prevenir múltiplas sessões simultâneas.';

COMMENT ON INDEX idx_boloes_produto_status IS 
'Otimiza a listagem de bolões por produto e status (página principal).';
