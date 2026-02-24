-- ==============================================================================
-- MEGAMAIS v2.5.15 - DEPLOY CONSOLIDADO PARA BANCO NOVO (DEV)
-- ==============================================================================
-- GERADO EM: 2026-02-10
-- USO: Colar INTEIRO no SQL Editor do Supabase (megamais-dev)
-- COMPOSIÇÃO:
--   Parte 1: FULL_DEPLOY_SCHEMA.sql (estrutura base, ~80% do banco)
--   Parte 2: 20 Migrations faltantes (Feb 9-10) — completa para v2.5.15
--   Parte 3: ENABLE_REALTIME.sql (5 tabelas com Realtime)
--   Parte 4: seed_produtos.sql (dados iniciais de loterias CAIXA)
-- ==============================================================================
-- ⚠️  IMPORTANTE: Este script deve ser rodado em um banco VAZIO (novo projeto).
--     As operações DELETE/UPDATE/TRUNCATE são inofensivas em banco vazio.
-- ==============================================================================


-- ╔════════════════════════════════════════════╗
-- ║  PARTE 1: FULL_DEPLOY_SCHEMA (BASE)       ║
-- ║  Colar o conteúdo de FULL_DEPLOY_SCHEMA.sql║
-- ║  ANTES desta seção                         ║
-- ╚════════════════════════════════════════════╝
-- >>> INSTRUÇÕES: Copie e cole o conteúdo completo de 
-- >>> supabase/FULL_DEPLOY_SCHEMA.sql ACIMA DESTA LINHA
-- >>> (São ~5548 linhas, o SQL Editor aguenta)


-- ╔════════════════════════════════════════════════════════════════╗
-- ║  PARTE 2: MIGRATIONS FALTANTES (20260209 → 99999999)         ║
-- ║  20 migrations que trazem o banco para v2.5.15                ║
-- ╚════════════════════════════════════════════════════════════════╝


-- ======================================================================
-- [1/20] 20260209123000_emergency_fix_rls_hang.sql
-- RLS Emergency Fix + get_my_profile() RPC
-- ======================================================================

ALTER TABLE public.perfis DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver proprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Master ver tudo" ON public.perfis;
DROP POLICY IF EXISTS "Master atualizar" ON public.perfis;
DROP POLICY IF EXISTS "perfil_select_isolation" ON public.perfis;
DROP POLICY IF EXISTS "perfil_own" ON public.perfis;

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfil_self_select" ON public.perfis
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "perfil_self_update" ON public.perfis
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', p.id,
        'role', p.role,
        'nome', p.nome,
        'avatar_url', p.avatar_url,
        'loja_id', p.loja_id
    ) INTO result
    FROM public.perfis p
    WHERE p.id = auth.uid();
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

COMMENT ON FUNCTION public.get_my_profile() IS 'Retorna o perfil do usuário logado ignorando bloqueios de RLS.';


-- ======================================================================
-- [2/20] 20260209140000_dashboard_performance_boost.sql
-- RPCs SECURITY DEFINER para Dashboard & Financeiro
-- ======================================================================

CREATE OR REPLACE FUNCTION public.get_my_loja_id()
RETURNS UUID AS $$
    SELECT p.loja_id FROM public.perfis p WHERE p.id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfis p 
        WHERE p.id = auth.uid() AND p.role::text = 'master'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_loja_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_loja_nome TEXT;
    v_vendas_jogos DECIMAL(10,2);
    v_vendas_boloes DECIMAL(10,2);
    v_premios_pagos DECIMAL(10,2);
    v_lucro_real_boloes DECIMAL(10,2);
    v_terminais_ativos INTEGER;
    v_terminais_total INTEGER;
    v_saldo_cofre DECIMAL(10,2);
    v_saldo_bancos DECIMAL(10,2);
BEGIN
    SELECT nome_fantasia INTO v_loja_nome FROM public.empresas WHERE id = p_loja_id;

    SELECT 
        vendas_jogos, vendas_boloes, premios_pagos
    INTO v_vendas_jogos, v_vendas_boloes, v_premios_pagos
    FROM public.vw_dashboard_consolidado
    WHERE filial = v_loja_nome;

    SELECT COALESCE(SUM((preco_venda_cota - valor_cota_base) * cotas_vendidas), 0)
    INTO v_lucro_real_boloes
    FROM public.boloes
    WHERE loja_id = p_loja_id AND created_at >= CURRENT_DATE;

    SELECT count(*) INTO v_terminais_total FROM public.terminais WHERE loja_id = p_loja_id;
    SELECT count(*) INTO v_terminais_ativos FROM public.caixa_sessoes WHERE loja_id = p_loja_id AND status::text = 'aberto';

    SELECT COALESCE(saldo, 0) INTO v_saldo_cofre FROM public.cofre_saldo_atual WHERE loja_id = p_loja_id;
    SELECT COALESCE(SUM(saldo_atual), 0) INTO v_saldo_bancos FROM public.financeiro_contas_bancarias WHERE loja_id = p_loja_id;

    result := jsonb_build_object(
        'faturamentoHoje', COALESCE(v_vendas_jogos, 0) + COALESCE(v_vendas_boloes, 0),
        'vendasJogos', COALESCE(v_vendas_jogos, 0),
        'vendasBoloes', COALESCE(v_vendas_boloes, 0),
        'lucroBoloes', COALESCE(v_lucro_real_boloes, 0),
        'terminaisAtivos', COALESCE(v_terminais_ativos, 0),
        'terminaisTotal', COALESCE(v_terminais_total, 0),
        'saldoCofre', COALESCE(v_saldo_cofre, 0),
        'saldoBancos', COALESCE(v_saldo_bancos, 0)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_financeiro_transactions(
    p_loja_id UUID, 
    p_ano INTEGER, 
    p_mes INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    IF p_mes = 0 THEN
        v_start_date := (p_ano || '-01-01')::DATE;
        v_end_date := (p_ano || '-12-31')::DATE;
    ELSE
        v_start_date := (p_ano || '-' || p_mes || '-01')::DATE;
        v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;

    SELECT jsonb_agg(t) INTO result
    FROM (
        SELECT 
            id, tipo, descricao, valor, item, 
            data_vencimento, data_pagamento, status, 
            recorrente, frequencia, loja_id, 
            metodo_pagamento, comprovante_url
        FROM public.financeiro_contas
        WHERE (p_loja_id IS NULL OR loja_id = p_loja_id)
        AND data_vencimento BETWEEN v_start_date AND v_end_date
        ORDER BY data_vencimento ASC
    ) t;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(t) INTO result
    FROM (
        SELECT * FROM public.vw_dashboard_consolidado
        ORDER BY filial ASC
    ) t;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_transactions(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary() TO authenticated;


-- ======================================================================
-- [3/20] 20260209151500_fix_enum_admin_access.sql
-- Standardizing Admin Role (admin vs master) + get_all_users() RPC
-- ======================================================================

DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'master') 
     AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'admin') THEN
    ALTER TYPE user_role RENAME VALUE 'master' TO 'admin';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfis p 
        WHERE p.id = auth.uid() 
        AND p.role::text IN ('admin', 'master')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfis p 
        WHERE p.id = auth.uid() 
        AND p.role::text IN ('admin', 'master', 'gerente')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role public.user_role;
  raw_role text;
  raw_loja_id uuid;
BEGIN
  raw_role := new.raw_user_meta_data->>'role';
  
  BEGIN
    IF raw_role IS NOT NULL THEN
      IF raw_role = 'master' THEN
        new_role := 'admin'::public.user_role;
      ELSE
        new_role := raw_role::public.user_role;
      END IF;
    ELSIF LOWER(TRIM(new.email)) = 'loteria@demo.com' THEN
      new_role := 'admin'::public.user_role;
    ELSE
      new_role := 'operador'::public.user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    new_role := 'operador'::public.user_role;
  END;

  IF new.raw_user_meta_data->>'loja_id' IS NOT NULL THEN
    raw_loja_id := (new.raw_user_meta_data->>'loja_id')::uuid;
  END IF;

  INSERT INTO public.perfis (id, role, nome, loja_id)
  VALUES (
    new.id, 
    new_role, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    raw_loja_id
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    role = EXCLUDED.role,
    loja_id = EXCLUDED.loja_id,
    updated_at = now();
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "perfil_master_select_all" ON public.perfis;
CREATE POLICY "perfil_master_select_all" ON public.perfis
    FOR SELECT TO authenticated
    USING (public.is_master());

-- (Skip UPDATE of loteria@demo.com - não existe no banco novo)

CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT public.is_master() THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_agg(t) INTO result
    FROM (
        SELECT * FROM public.perfis 
        ORDER BY ativo DESC, created_at DESC
    ) t;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;


-- ======================================================================
-- [4/20] 20260209170000_add_recorrencia_type.sql
-- tipo_recorrencia column + processar_recorrencias_financeiras()
-- ======================================================================

ALTER TABLE financeiro_itens_plano 
ADD COLUMN IF NOT EXISTS tipo_recorrencia VARCHAR(20) DEFAULT 'NENHUMA';

-- (Skip UPDATE - banco novo está vazio)

COMMENT ON COLUMN financeiro_itens_plano.tipo_recorrencia IS 
'Tipo de recorrência: FIXA (valor fixo), VARIAVEL (valor muda mês a mês), NENHUMA (eventual)';


-- ======================================================================
-- [5/20] 20260209170500_add_item_financeiro_to_caixa.sql
-- FK item_financeiro_id em caixa_movimentacoes
-- ======================================================================

ALTER TABLE caixa_movimentacoes
ADD COLUMN IF NOT EXISTS item_financeiro_id INTEGER REFERENCES financeiro_itens_plano(id);

CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_item ON caixa_movimentacoes(item_financeiro_id);

COMMENT ON COLUMN caixa_movimentacoes.item_financeiro_id IS 'Referência ao item do plano de contas (categoria da despesa/receita)';


-- ======================================================================
-- [6/20] 20260209183000_add_item_financeiro_to_contas.sql
-- FK item_financeiro_id em financeiro_contas
-- ======================================================================

ALTER TABLE financeiro_contas
ADD COLUMN IF NOT EXISTS item_financeiro_id INTEGER REFERENCES financeiro_itens_plano(id);

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_item_financeiro ON financeiro_contas(item_financeiro_id);

COMMENT ON COLUMN financeiro_contas.item_financeiro_id IS 'Referência estruturada à categoria financeira (fk para financeiro_itens_plano)';


-- ======================================================================
-- [7/20] 20260209190000_update_processar_recorrencias.sql
-- (Função intermediária - será sobrescrita pelas versões mais recentes)
-- ======================================================================
-- Pulado: A versão final está na migration [13/20]


-- ======================================================================
-- [8/20] 20260209193000_fix_all_recurrences.sql
-- Schema cache + auto-healing (estrutural)
-- ======================================================================

NOTIFY pgrst, 'reload config';

-- (Skip DELETE/UPDATE - banco novo está vazio, sem dados legados)


-- ======================================================================
-- [9/20] 20260209194500_update_cost_classification.sql
-- (Skip - apenas UPDATEs em dados existentes, banco novo está vazio)
-- ======================================================================


-- ======================================================================
-- [10/20] 20260209195000_fix_and_update_costs.sql
-- Garantir coluna tipo_recorrencia existe (defesa)
-- ======================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'financeiro_itens_plano' 
        AND column_name = 'tipo_recorrencia'
    ) THEN
        ALTER TABLE financeiro_itens_plano 
        ADD COLUMN tipo_recorrencia VARCHAR(20) DEFAULT 'NENHUMA';
    END IF;
END $$;

NOTIFY pgrst, 'reload config';


-- ======================================================================
-- [11/20] 20260209200000_v2_5_10_recurrence_update.sql
-- Trigger para sincronizar valor_padrao com lançamentos futuros
-- ======================================================================

-- (Skip DELETE - banco novo está vazio)

-- Trigger de Sincronização de Valor
CREATE OR REPLACE FUNCTION trg_update_future_recurrences_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.valor_padrao <> OLD.valor_padrao THEN
        UPDATE financeiro_contas
        SET valor = NEW.valor_padrao
        WHERE item_financeiro_id = NEW.id
          AND status = 'pendente'
          AND data_vencimento >= CURRENT_DATE
          AND recorrente = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_future_recurrences ON financeiro_itens_plano;

CREATE TRIGGER trg_update_future_recurrences
AFTER UPDATE OF valor_padrao ON financeiro_itens_plano
FOR EACH ROW
EXECUTE FUNCTION trg_update_future_recurrences_fn();

NOTIFY pgrst, 'reload config';


-- ======================================================================
-- [12/20] 20260210084500_force_cleanup.sql
-- (Skip - apenas DELETE/UPDATE em dados legados, banco novo está vazio)
-- ======================================================================


-- ======================================================================
-- [13/20] 20260210085500_fix_audit_trigger.sql
-- Adicionar updated_at em tabelas auditadas
-- ======================================================================

ALTER TABLE financeiro_contas 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE cofre_movimentacoes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE vendas_boloes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE caixa_movimentacoes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

NOTIFY pgrst, 'reload config';


-- ======================================================================
-- [14/20] 20260210100000_fix_recurrence_classification.sql
-- (Skip - apenas UPDATEs/DELETEs de dados legados, banco novo está vazio)
-- ======================================================================


-- ======================================================================
-- [15/20] 20260210101000_fix_recurrence_cast.sql
-- (Função intermediária - será sobrescrita pela versão final em [18/20])
-- ======================================================================


-- ======================================================================
-- [16/20] 20260210120000_fix_delete_categories_v2_5_14.sql
-- FK SET NULL + coluna arquivado + GRANT DELETE
-- ======================================================================

GRANT DELETE ON financeiro_itens_plano TO authenticated;

ALTER TABLE financeiro_contas 
DROP CONSTRAINT IF EXISTS financeiro_contas_item_financeiro_id_fkey;

ALTER TABLE financeiro_contas
ADD CONSTRAINT financeiro_contas_item_financeiro_id_fkey
FOREIGN KEY (item_financeiro_id) 
REFERENCES financeiro_itens_plano(id)
ON DELETE SET NULL;

COMMENT ON CONSTRAINT financeiro_contas_item_financeiro_id_fkey 
ON financeiro_contas IS 
'FK opcional para classificação estruturada. ON DELETE SET NULL preserva histórico financeiro mesmo se a categoria for removida do plano de contas.';

ALTER TABLE financeiro_itens_plano 
ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_itens_plano_arquivado 
ON financeiro_itens_plano(arquivado) 
WHERE arquivado = FALSE;

COMMENT ON COLUMN financeiro_itens_plano.arquivado IS 
'Soft delete: TRUE = categoria arquivada (não aparece no UI, mas preserva histórico). Preferível a DELETE físico.';

DO $$
BEGIN
    RAISE NOTICE 'v2.5.14: Permissões de DELETE corrigidas. FK ajustada para SET NULL.';
END $$;


-- ======================================================================
-- [17/20] 20260210130000_full_year_recurrence_v2_5_14.sql
-- (Função intermediária - será sobrescrita pela versão final em [19/20])
-- ======================================================================


-- ======================================================================
-- [18/20] 20260210140000_auto_trigger_recorrencias_v2_5_14.sql
-- Auto-trigger: Gera recorrências quando categoria vira FIXA
-- ======================================================================

CREATE OR REPLACE FUNCTION trg_auto_gerar_recorrencias_fixa()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.tipo_recorrencia = 'FIXA' AND NEW.ativo = TRUE) OR
       (TG_OP = 'UPDATE' AND OLD.tipo_recorrencia != 'FIXA' AND NEW.tipo_recorrencia = 'FIXA' AND NEW.ativo = TRUE) THEN
        
        PERFORM processar_recorrencias_financeiras();
        
        RAISE NOTICE 'Recorrências geradas automaticamente para item %', NEW.item;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_gerar_recorrencias_trigger ON financeiro_itens_plano;

CREATE TRIGGER auto_gerar_recorrencias_trigger
AFTER INSERT OR UPDATE OF tipo_recorrencia, ativo ON financeiro_itens_plano
FOR EACH ROW
EXECUTE FUNCTION trg_auto_gerar_recorrencias_fixa();

COMMENT ON FUNCTION trg_auto_gerar_recorrencias_fixa IS
'v2.5.14: Dispara automaticamente processar_recorrencias_financeiras() quando uma categoria é marcada como FIXA. 
Elimina necessidade de botão manual "Gerar Recorrências".';

COMMENT ON TRIGGER auto_gerar_recorrencias_trigger ON financeiro_itens_plano IS
'Trigger automático que gera lançamentos de Jan-Dez quando categoria vira FIXA.';

NOTIFY pgrst, 'reload config';


-- ======================================================================
-- [19/20] 20260210150000_smart_sync_recurrences_v2_5_15.sql
-- VERSÃO FINAL: processar_recorrencias_financeiras() com UPSERT
-- ======================================================================

DROP INDEX IF EXISTS idx_financeiro_contas_sync_unique;

CREATE UNIQUE INDEX idx_financeiro_contas_sync_unique 
ON public.financeiro_contas (
    item_financeiro_id, 
    loja_id, 
    (EXTRACT(MONTH FROM data_vencimento)), 
    (EXTRACT(YEAR FROM data_vencimento))
) 
WHERE (recorrente = TRUE AND status = 'pendente');

CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_ano_atual INTEGER;
    v_mes_loop INTEGER;
    v_categoria RECORD;
    v_vencimento_date DATE;
    v_dia_venc INTEGER;
BEGIN
    v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);

    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE tipo_recorrencia = 'FIXA' 
          AND ativo = TRUE
          AND arquivado = FALSE
    LOOP
        FOR v_mes_loop IN 1..12 LOOP
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            BEGIN
                v_vencimento_date := MAKE_DATE(v_ano_atual, v_mes_loop, v_dia_venc);
            EXCEPTION WHEN others THEN
                v_vencimento_date := (MAKE_DATE(v_ano_atual, v_mes_loop, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
            END;

            INSERT INTO financeiro_contas (
                tipo,
                descricao,
                valor,
                item,
                data_vencimento,
                status,
                recorrente,
                frequencia,
                loja_id,
                item_financeiro_id
            ) VALUES (
                v_categoria.tipo::fin_tipo_transacao,
                v_categoria.item || ' (' || to_char(v_vencimento_date, 'MM/YYYY') || ')',
                v_categoria.valor_padrao,
                v_categoria.item,
                v_vencimento_date,
                'pendente',
                TRUE,
                'mensal',
                v_categoria.loja_id,
                v_categoria.id
            )
            ON CONFLICT (
                item_financeiro_id, 
                loja_id, 
                (EXTRACT(MONTH FROM data_vencimento)), 
                (EXTRACT(YEAR FROM data_vencimento))
            ) WHERE (recorrente = TRUE AND status = 'pendente')
            DO UPDATE SET
                valor = EXCLUDED.valor,
                data_vencimento = EXCLUDED.data_vencimento,
                descricao = EXCLUDED.descricao;

            v_processadas := v_processadas + 1;
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;


-- ======================================================================
-- [20/20] 99999999999999_fix_dependencies_and_encalhe.sql
-- Enums financeiros + Categorias Plano + Motor de Encalhe
-- ======================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_metodo_pagamento') THEN
        CREATE TYPE fin_metodo_pagamento AS ENUM ('pix', 'dinheiro', 'boleto', 'cartao', 'outros');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_tipo_transacao') THEN
        CREATE TYPE fin_tipo_transacao AS ENUM ('receita', 'despesa');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_status_conta') THEN
        CREATE TYPE fin_status_conta AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'bolao_status' AND e.enumlabel = 'sorteio_realizado') THEN
        ALTER TYPE bolao_status ADD VALUE 'sorteio_realizado';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS financeiro_categorias_plano (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo fin_tipo_transacao NOT NULL,
    fixo BOOLEAN DEFAULT FALSE,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO financeiro_categorias_plano (nome, tipo, fixo, ordem)
SELECT name, type, is_fixed, ord FROM (
    VALUES 
        ('Ágio Bolão (35%)', 'receita'::fin_tipo_transacao, FALSE, 1),
        ('Jogos (8,61%)', 'receita'::fin_tipo_transacao, FALSE, 2),
        ('Encalhe de Jogos', 'despesa'::fin_tipo_transacao, FALSE, 20),
        ('Aluguel', 'despesa'::fin_tipo_transacao, TRUE, 4),
        ('Contador', 'despesa'::fin_tipo_transacao, TRUE, 5),
        ('Internet', 'despesa'::fin_tipo_transacao, TRUE, 6)
) AS t(name, type, is_fixed, ord)
WHERE NOT EXISTS (SELECT 1 FROM financeiro_categorias_plano WHERE nome = t.name);

ALTER TABLE financeiro_contas 
ADD COLUMN IF NOT EXISTS loja_id UUID,
ADD COLUMN IF NOT EXISTS metodo_pagamento fin_metodo_pagamento DEFAULT 'dinheiro',
ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
ADD COLUMN IF NOT EXISTS valor_realizado DECIMAL(10, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS financeiro_contas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    saldo_inicial DECIMAL(10, 2) DEFAULT 0,
    saldo_atual DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON COLUMN cotas_boloes.status IS 'Status da cota: disponivel, vendida, encalhe_casa';

CREATE OR REPLACE FUNCTION get_boloes_vencidos()
RETURNS SETOF boloes AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM boloes 
    WHERE status = 'disponivel' 
    AND data_sorteio < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;


-- ╔════════════════════════════════════════════════════════════════╗
-- ║  PARTE 3: ENABLE_REALTIME                                    ║
-- ║  Habilita Supabase Realtime para 5 tabelas                   ║
-- ╚════════════════════════════════════════════════════════════════╝

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE financeiro_contas;
    RAISE NOTICE '✅ financeiro_contas adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  financeiro_contas já está no Realtime';
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE caixa_sessoes;
    RAISE NOTICE '✅ caixa_sessoes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  caixa_sessoes já está no Realtime';
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE boloes;
    RAISE NOTICE '✅ boloes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  boloes já está no Realtime';
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendas_boloes;
    RAISE NOTICE '✅ vendas_boloes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  vendas_boloes já está no Realtime';
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE cofre_movimentacoes;
    RAISE NOTICE '✅ cofre_movimentacoes adicionado ao Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  cofre_movimentacoes já está no Realtime';
END $$;


-- ╔════════════════════════════════════════════════════════════════╗
-- ║  PARTE 4: SEED (Loterias CAIXA)                              ║
-- ║  Colar o conteúdo de seed_produtos.sql AQUI                   ║
-- ╚════════════════════════════════════════════════════════════════╝
-- >>> INSTRUÇÕES: Copie e cole o conteúdo completo de
-- >>> supabase/seed_produtos.sql ABAIXO DESTA LINHA


-- ======================================================================
-- FIM DO DEPLOY CONSOLIDADO
-- Se tudo rodou sem erros, seu banco DEV está 100% em v2.5.15 ✅
-- ======================================================================
