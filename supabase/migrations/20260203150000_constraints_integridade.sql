-- ==========================================
-- REFINAMENTO FINAL - CONSTRAINTS DE INTEGRIDADE
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Adicionar CHECKs e NOT NULLs para prevenir dados inválidos
-- ==========================================

-- 1. BOLÕES - Validações de valores positivos e lógica
ALTER TABLE boloes
ADD CONSTRAINT check_bolao_qtd_cotas_positive CHECK (qtd_cotas > 0),
ADD CONSTRAINT check_bolao_cotas_vendidas_valid CHECK (cotas_vendidas >= 0 AND cotas_vendidas <= qtd_cotas),
ADD CONSTRAINT check_bolao_preco_venda_positive CHECK (preco_venda_cota > 0),
ADD CONSTRAINT check_bolao_valor_cota_base_positive CHECK (valor_cota_base > 0),
ADD CONSTRAINT check_bolao_taxa_administrativa_valid CHECK (taxa_administrativa >= 0 AND taxa_administrativa <= 100);

-- 2. VENDAS DE BOLÕES - Valores válidos
ALTER TABLE vendas_boloes
ADD CONSTRAINT check_venda_quantidade_positive CHECK (quantidade_cotas > 0),
ADD CONSTRAINT check_venda_valor_positive CHECK (valor_total > 0);

-- 3. COTAS - NOT NULL em campos críticos
ALTER TABLE cotas_boloes
ALTER COLUMN bolao_id SET NOT NULL,
ALTER COLUMN status SET NOT NULL;

-- 4. CAIXA - Valores válidos
ALTER TABLE caixa_sessoes
ADD CONSTRAINT check_caixa_valor_inicial_valid CHECK (valor_inicial >= 0),
ADD CONSTRAINT check_caixa_valores_finais_positivos CHECK (
    valor_final_declarado IS NULL OR valor_final_declarado >= 0
),
ALTER COLUMN operador_id SET NOT NULL;

-- NOTA: caixa_movimentacoes PODE ter valores negativos (sangrias)
-- Apenas garantimos que não seja exatamente zero
ALTER TABLE caixa_movimentacoes
ADD CONSTRAINT check_caixa_mov_valor_not_zero CHECK (valor != 0);

-- 5. FINANCEIRO - Apenas valores positivos (despesas e receitas são sempre positivas)
ALTER TABLE financeiro_contas
ADD CONSTRAINT check_financeiro_valor_positive CHECK (valor > 0);

-- NOTA: cofre_movimentacoes só aceita valores positivos (o tipo define entrada/saída)
ALTER TABLE cofre_movimentacoes
ADD CONSTRAINT check_cofre_valor_positive CHECK (valor > 0);

-- 6. PRODUTOS - Lógica de dezenas
ALTER TABLE produtos
ADD CONSTRAINT check_produto_dezenas_logica CHECK (min_dezenas > 0 AND min_dezenas <= max_dezenas),
ALTER COLUMN nome SET NOT NULL,
ALTER COLUMN slug SET NOT NULL;

-- 7. TERMINAIS - NOT NULL em identificador
ALTER TABLE terminais
ALTER COLUMN codigo SET NOT NULL;

-- 8. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON CONSTRAINT check_bolao_qtd_cotas_positive ON boloes IS 
'Garante que um bolão não pode ter zero ou quantidade negativa de cotas.';

COMMENT ON CONSTRAINT check_bolao_cotas_vendidas_valid ON boloes IS 
'Garante que cotas vendidas nunca excedem o total de cotas do bolão.';

COMMENT ON CONSTRAINT check_venda_quantidade_positive ON vendas_boloes IS 
'Previne venda com quantidade zero ou negativa de cotas.';

COMMENT ON CONSTRAINT check_produto_dezenas_logica ON produtos IS 
'Valida que min_dezenas não pode ser maior que max_dezenas.';
