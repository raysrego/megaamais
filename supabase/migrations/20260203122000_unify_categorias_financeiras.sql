-- ==========================================
-- SPRINT 1 - GAP #3: Unificação de Tabelas de Categorias
-- Versão: 1.0 (2026-02-03)
-- Objetivo: Unificar financeiro_categorias_plano e financeiro_itens em uma única tabela
-- ==========================================

-- 1. CRIAR TABELA UNIFICADA (SE NÃO EXISTIR)
CREATE TABLE IF NOT EXISTS financeiro_itens_plano (
    id SERIAL PRIMARY KEY,
    item TEXT NOT NULL UNIQUE, -- Nome da categoria (ex: "Aluguel")
    tipo fin_tipo_transacao NOT NULL,
    fixo BOOLEAN DEFAULT FALSE, -- Se é custo fixo (recorrente) ou variável
    dia_vencimento INTEGER, -- Para recorrências (dia do mês, ex: 5)
    valor_padrao NUMERIC(10, 2) DEFAULT 0, -- Valor padrão para recorrências
    ordem INTEGER DEFAULT 0, -- Para ordenação no UI
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MIGRAR DADOS DE financeiro_categorias_plano (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financeiro_categorias_plano') THEN
        INSERT INTO financeiro_itens_plano (item, tipo, fixo, ordem)
        SELECT nome, tipo, fixo, ordem
        FROM financeiro_categorias_plano
        ON CONFLICT (item) DO NOTHING;
    END IF;
END $$;

-- 3. MIGRAR DADOS DE financeiro_itens (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financeiro_itens') THEN
        INSERT INTO financeiro_itens_plano (item, tipo, fixo, dia_vencimento, valor_padrao)
        SELECT item, tipo, fixo, dia_vencimento, valor_padrao
        FROM financeiro_itens
        ON CONFLICT (item) DO UPDATE SET
            dia_vencimento = EXCLUDED.dia_vencimento,
            valor_padrao = EXCLUDED.valor_padrao;
    END IF;
END $$;

-- 4. ATUALIZAR REFERÊNCIAS EM financeiro_contas
-- Garantir que a coluna 'item' exista e seja do tipo TEXT
ALTER TABLE financeiro_contas ADD COLUMN IF NOT EXISTS item TEXT;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_item ON financeiro_contas(item);

-- 5. SEED DE CATEGORIAS ESSENCIAIS (garantindo que existam)
INSERT INTO financeiro_itens_plano (item, tipo, fixo, ordem, dia_vencimento, valor_padrao) VALUES
    ('Ágio Bolão (35%)', 'receita', FALSE, 1, NULL, 0),
    ('Jogos (8,61%)', 'receita', FALSE, 2, NULL, 0),
    ('Comissões Diversas', 'receita', FALSE, 3, NULL, 0),
    ('Encalhe de Jogos', 'despesa', FALSE, 20, NULL, 0),
    ('Aluguel', 'despesa', TRUE, 4, 5, 1500.00),
    ('Contador', 'despesa', TRUE, 5, 10, 800.00),
    ('Internet', 'despesa', TRUE, 6, 15, 150.00),
    ('Energia/Luz', 'despesa', TRUE, 7, 20, 300.00),
    ('Salários Equipe', 'despesa', TRUE, 8, 5, 5000.00),
    ('Material Escritório', 'despesa', FALSE, 9, NULL, 0),
    ('Manutenção Loja', 'despesa', FALSE, 10, NULL, 0)
ON CONFLICT (item) DO UPDATE SET
    tipo = EXCLUDED.tipo,
    fixo = EXCLUDED.fixo,
    ordem = EXCLUDED.ordem,
    dia_vencimento = COALESCE(EXCLUDED.dia_vencimento, financeiro_itens_plano.dia_vencimento),
    valor_padrao = COALESCE(EXCLUDED.valor_padrao, financeiro_itens_plano.valor_padrao);

-- 6. ATUALIZAR FUNÇÃO DE RECORRÊNCIAS PARA USAR A TABELA UNIFICADA
CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_mes INTEGER;
    v_ano INTEGER;
    v_categoria RECORD;
    v_valor_final NUMERIC;
    v_loja_id UUID;
    v_dia_venc INTEGER;
    v_vencimento_final DATE;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_mes := EXTRACT(MONTH FROM NOW());
    v_ano := EXTRACT(YEAR FROM NOW());
    v_start_date := DATE(v_ano || '-' || LPAD(v_mes::TEXT, 2, '0') || '-01');
    v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Para cada item fixo (recorrente) no plano de contas
    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE fixo = TRUE AND ativo = TRUE
    LOOP
        -- Verificar se já existe lançamento deste item no mês atual
        IF NOT EXISTS (
            SELECT 1 FROM financeiro_contas
            WHERE item = v_categoria.item
              AND data_vencimento >= v_start_date
              AND data_vencimento <= v_end_date
        ) THEN
            -- Determinar valor e loja se houver histórico
            SELECT valor, loja_id INTO v_valor_final, v_loja_id
            FROM financeiro_contas
            WHERE item = v_categoria.item
            ORDER BY data_vencimento DESC
            LIMIT 1;

            v_valor_final := COALESCE(v_valor_final, v_categoria.valor_padrao, 0);
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            -- Garantir que o dia não ultrapasse o último dia do mês
            IF v_dia_venc > EXTRACT(DAY FROM v_end_date) THEN
                v_dia_venc := EXTRACT(DAY FROM v_end_date);
            END IF;

            v_vencimento_final := DATE(v_ano || '-' || LPAD(v_mes::TEXT, 2, '0') || '-' || LPAD(v_dia_venc::TEXT, 2, '0'));

            -- Inserir recorrência
            INSERT INTO financeiro_contas (
                tipo, 
                descricao, 
                valor, 
                item, 
                data_vencimento, 
                status, 
                recorrente, 
                loja_id
            ) VALUES (
                v_categoria.tipo::TEXT,
                v_categoria.item || ' (' || v_mes || '/' || v_ano || ')',
                v_valor_final,
                v_categoria.item,
                v_vencimento_final,
                'pendente',
                TRUE,
                v_loja_id
            );

            v_processadas := v_processadas + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS e GRANTS
ALTER TABLE financeiro_itens_plano ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acesso_total_itens_plano" ON financeiro_itens_plano;
CREATE POLICY "acesso_total_itens_plano" ON financeiro_itens_plano
  FOR ALL TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE ON financeiro_itens_plano TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE financeiro_itens_plano_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_recorrencias_financeiras TO authenticated;

-- 8. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_itens_plano_tipo ON financeiro_itens_plano(tipo);
CREATE INDEX IF NOT EXISTS idx_itens_plano_fixo ON financeiro_itens_plano(fixo) WHERE fixo = TRUE;

-- 9. COMENTÁRIOS
COMMENT ON TABLE financeiro_itens_plano IS 
'Tabela unificada de plano de contas financeiras. Substitui financeiro_categorias_plano e financeiro_itens.';

COMMENT ON COLUMN financeiro_itens_plano.item IS 
'Nome da categoria/item financeiro (ex: Aluguel, Internet).';

COMMENT ON COLUMN financeiro_itens_plano.fixo IS 
'TRUE para despesas/receitas recorrentes mensais, FALSE para eventuais.';

COMMENT ON COLUMN financeiro_itens_plano.dia_vencimento IS 
'Dia do mês para vencimento de recorrências (1-31). NULL para itens não-fixos.';

COMMENT ON FUNCTION public.processar_recorrencias_financeiras IS 
'Processa automaticamente lançamentos recorrentes mensais baseados em itens fixos do plano de contas.';

-- 10. MIGRATION LOG
DO $$
BEGIN
    RAISE NOTICE 'Migração de unificação de categorias concluída. Verificar tabelas antigas: financeiro_categorias_plano e financeiro_itens podem ser removidas manualmente após validação.';
END $$;
