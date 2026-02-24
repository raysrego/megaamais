-- Migration: Optimize Financeiro Performance (Indexes & RLS)
-- Description: Cria índices compostos e otimiza policies para resolver lentidão no módulo financeiro.

-- 1. ÍNDICES PARA financeiro_itens_plano
-- Query Frontend: .select('*').eq('arquivado', false).or('loja_id.eq.X,loja_id.is.null').order('ordem')
-- Motivo: Evitar Seq Scan filtrando por loja e arquivado.
CREATE INDEX IF NOT EXISTS idx_itens_plano_loja_arquivado_ordem 
ON public.financeiro_itens_plano (loja_id, arquivado, ordem);

-- Índice parcial para itens globais (loja_id IS NULL) ativos
CREATE INDEX IF NOT EXISTS idx_itens_plano_global_ativos 
ON public.financeiro_itens_plano (arquivado, ordem) 
WHERE loja_id IS NULL AND arquivado = FALSE;

-- 2. ÍNDICES PARA financeiro_contas (Histórico)
-- Query Frontend: .select(...).eq('loja_id', X).order('created_at', desc).limit(50)
-- Motivo: Acelerar o carregamento do histórico e evitar sort em memória.
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_loja_created_at 
ON public.financeiro_contas (loja_id, created_at DESC);

-- Query de Somas (Dashboard): .select('valor, tipo').eq('loja_id', X).gte('data_vencimento', ...)
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_loja_data_vencimento 
ON public.financeiro_contas (loja_id, data_vencimento);

-- 3. OTIMIZAÇÃO DE RLS (financeiro_itens_plano)
-- Removemos policies complexas que fazem join com perfis/lojas se existirem e simplificamos.

-- Drop old valid policies to replace with faster ones if needed
-- (Assumindo nomes padrões, se falhar o drop não para o script)
DROP POLICY IF EXISTS "Leitura de Itens" ON public.financeiro_itens_plano;
DROP POLICY IF EXISTS "Itens Visiveis" ON public.financeiro_itens_plano;

-- Policy de Leitura Otimizada:
-- Usuário vê itens se:
-- 1. O item é GLOBAL (loja_id IS NULL)
-- 2. OU O item pertence à loja que o usuário tem acesso (via metadados ou lookup simples)
-- Nota: Para máxima performance, evitamos subqueries complexas em policies de SELECT de alta frequência.
-- Aqui, assumimos que se o usuário tem o ID da loja na sessão ou no JWT, é seguro.
-- Mas como Supabase usa auth.uid(), vamos simplificar:
-- "Ler se (loja_id is null) OR (loja_id IN (select loja_id from perfis where id = auth.uid()))"
-- Para otimizar, criamos um índice em perfis(id, loja_id) se não existir.

CREATE INDEX IF NOT EXISTS idx_perfis_id_loja 
ON public.perfis (id, loja_id);

CREATE POLICY "Itens Financeiros Leitura Otimizada"
ON public.financeiro_itens_plano
FOR SELECT
TO authenticated
USING (
  loja_id IS NULL 
  OR 
  loja_id IN (
    SELECT loja_id FROM public.perfis WHERE id = auth.uid()
  )
);

-- Policy de Escrita (Mantemos restrita a Admin/Gerente da Loja)
-- (Não alteramos a escrita aqui para não quebrar regras de negócio, foco é Leitura)

-- 4. VACUUM ANALYZE (Recomendado após criar índices em tabelas populosas)
-- ANALYZE financeiro_itens_plano;
-- ANALYZE financeiro_contas;
