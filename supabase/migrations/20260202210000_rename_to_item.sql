-- 1. Renomear a tabela de categorias para itens
ALTER TABLE IF EXISTS public.financeiro_categorias_plano RENAME TO financeiro_itens;

-- 2. Renomear a coluna nome para item
ALTER TABLE IF EXISTS public.financeiro_itens RENAME COLUMN nome TO item;

-- 3. Atualizar a tabela de contas para refletir a nova nomenclatura
ALTER TABLE IF EXISTS public.financeiro_contas RENAME COLUMN categoria TO item;

-- 4. Atualizar a tabela de transações bancárias
ALTER TABLE IF EXISTS public.financeiro_transacoes_bancarias RENAME COLUMN categoria TO item;
