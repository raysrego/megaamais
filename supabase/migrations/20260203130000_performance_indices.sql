-- ==========================================
-- SPRINT 2 - PERFORMANCE & INTEGRIDADE
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Resolver GAPs #2, #4 e #5 da auditoria
-- ==========================================

-- 1. CORREÇÃO DE ÍNDICES PÓS-RENAME (GAP #2)
-- Remove o índice antigo se existir e cria o novo no campo renomeado operador_id
DROP INDEX IF EXISTS idx_caixa_sessoes_usuario;
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_operador ON public.caixa_sessoes(operador_id);

-- 2. ACELERAÇÃO DE RELATÓRIOS DO COFRE (GAP #4)
-- O operador_id é filtrado em quase todos os relatórios de prestação de contas
CREATE INDEX IF NOT EXISTS idx_cofre_operador ON public.cofre_movimentacoes(operador_id);

-- 3. GARANTIA DE IDENTIDADE ÚNICA (GAP #5)
-- Impede que UIDs amigáveis de cotas (ex: KT-1234) sejam duplicados acidentalmente
ALTER TABLE public.cotas_boloes ADD CONSTRAINT unique_cota_uid UNIQUE (uid);

-- 4. ADICIONAL: ÍNDICE POR DATA DE CRIAÇÃO NOS BOLÕES
-- Melhora a performance da listagem principal (OrderBy created_at desc)
CREATE INDEX IF NOT EXISTS idx_boloes_created_at ON public.boloes(created_at DESC);

-- 5. ADICIONAL: ÍNDICE DE LOJA NO COFRE
-- Facilita filtragem multi-tenancy para administradores de rede
CREATE INDEX IF NOT EXISTS idx_cofre_loja_id ON public.cofre_movimentacoes(loja_id);

-- COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON CONSTRAINT unique_cota_uid ON public.cotas_boloes IS 'Garante que cada cota tenha um identificador amigável único no sistema.';
