-- ===================================================================
-- BLINDAGEM FINANCEIRA & INTEGRIDADE DE DADOS
-- Data: 2026-02-05
-- Objetivo: Impedir fisicamente a entrada de dados inválidos (valores negativos,
--           cotas zeradas, referências nulas) no nível do banco de dados.
-- ===================================================================

-- 1. CONSTRAINTS DE VALOR (Check Constraints)
-- Garante que dinheiro e quantidades sejam matematicamente válidos

-- A. BOLOES
ALTER TABLE public.boloes
    ADD CONSTRAINT check_qtd_cotas_positiva CHECK (qtd_cotas > 0),
    ADD CONSTRAINT check_cotas_vendidas_logica CHECK (cotas_vendidas >= 0 AND cotas_vendidas <= qtd_cotas),
    ADD CONSTRAINT check_preco_venda_cota_positivo CHECK (preco_venda_cota > 0);

-- B. VENDAS BOLOES
ALTER TABLE public.vendas_boloes
    ADD CONSTRAINT check_venda_qtd_positiva CHECK (quantidade_cotas > 0),
    ADD CONSTRAINT check_venda_valor_positivo CHECK (valor_total > 0);

-- C. CAIXA SESSOES
ALTER TABLE public.caixa_sessoes
    ADD CONSTRAINT check_caixa_inicial_nao_negativo CHECK (valor_inicial >= 0);

-- D. CAIXA MOVIMENTACOES
-- Valor deve ser positivo (o sinal de entrada/saida é definido pelo TIPO, não pelo valor numérico bruto)
ALTER TABLE public.caixa_movimentacoes
    ADD CONSTRAINT check_movimentacao_valor_positivo CHECK (valor > 0);

-- E. FINANCEIRO CONTAS (Contas a Pagar/Receber)
ALTER TABLE public.financeiro_contas
    ADD CONSTRAINT check_financeiro_valor_positivo CHECK (valor > 0);

-- F. PRODUTOS
ALTER TABLE public.produtos
    ADD CONSTRAINT check_dezenas_logica CHECK (min_dezenas > 0 AND min_dezenas <= max_dezenas);

-- 2. CAMPOS OBRIGATÓRIOS (NOT NULL)
-- Previne registros "orfãos" ou incompletos

-- A. TERMINAIS (Código é a identidade do terminal)
ALTER TABLE public.terminais 
    ALTER COLUMN codigo SET NOT NULL;

-- B. VENDAS BOLOES (Venda precisa de vendedor)
ALTER TABLE public.vendas_boloes
    ALTER COLUMN usuario_id SET NOT NULL;

-- C. CAIXA SESSOES (Sessão precisa de dono)
ALTER TABLE public.caixa_sessoes
    ALTER COLUMN operador_id SET NOT NULL;


-- 3. ÍNDICES DE PERFORMANCE (Otimização de Queries Frequentes)

-- A. Buscas de Cotas por Bolão (Muito frequente na Home)
CREATE INDEX IF NOT EXISTS idx_cotas_bolao_status 
ON public.cotas_boloes(bolao_id, status) WHERE status = 'disponivel';

-- B. Histórico de Vendas (Relatórios)
CREATE INDEX IF NOT EXISTS idx_vendas_usuario_data 
ON public.vendas_boloes(usuario_id, created_at DESC);

-- C. Caixas Abertos (Monitoramento)
CREATE INDEX IF NOT EXISTS idx_caixa_operador_status 
ON public.caixa_sessoes(operador_id, status) WHERE status = 'aberto';

-- D. Bolões Disponíveis (Vitrine)
CREATE INDEX IF NOT EXISTS idx_boloes_produto_status 
ON public.boloes(produto_id, status) WHERE status = 'disponivel';
