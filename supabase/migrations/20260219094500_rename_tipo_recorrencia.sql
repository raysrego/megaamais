-- ==========================================
-- MIGRATION: 20260219094500_rename_tipo_recorrencia.sql
-- v2.5.22 - Padronização de Nomenclatura de Modalidade
-- ==========================================
-- Problema: DB usa FIXA/VARIAVEL/NENHUMA, mas UI mostra "Fixo Mensal"/"Fixo Variável"/"Variável"
--           VARIAVEL no DB = "Fixo Variável" na UI (confuso!)
-- Solução: Renomear valores para FIXO_MENSAL/FIXO_VARIAVEL/VARIAVEL
-- ==========================================

-- 1. RENOMEAR VALORES EXISTENTES (ordem importa para evitar colisão!)
-- Primeiro: VARIAVEL → FIXO_VARIAVEL (antes de NENHUMA → VARIAVEL)
UPDATE financeiro_itens_plano
SET tipo_recorrencia = 'FIXO_VARIAVEL'
WHERE tipo_recorrencia = 'VARIAVEL';

-- Segundo: NENHUMA → VARIAVEL
UPDATE financeiro_itens_plano
SET tipo_recorrencia = 'VARIAVEL'
WHERE tipo_recorrencia = 'NENHUMA';

-- Terceiro: FIXA → FIXO_MENSAL
UPDATE financeiro_itens_plano
SET tipo_recorrencia = 'FIXO_MENSAL'
WHERE tipo_recorrencia = 'FIXA';

-- 2. ALTERAR DEFAULT DA COLUNA
ALTER TABLE financeiro_itens_plano
ALTER COLUMN tipo_recorrencia SET DEFAULT 'VARIAVEL';

-- 3. ATUALIZAR COMMENT
COMMENT ON COLUMN financeiro_itens_plano.tipo_recorrencia IS
'Modalidade financeira: FIXO_MENSAL (automático, mesmo valor), FIXO_VARIAVEL (todo mês, valor varia), VARIAVEL (eventual/manual)';

-- 4. RECRIAR FUNÇÃO processar_recorrencias_financeiras COM NOVO VALOR
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
        WHERE tipo_recorrencia = 'FIXO_MENSAL'  -- RENOMEADO de 'FIXA'
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

COMMENT ON FUNCTION public.processar_recorrencias_financeiras IS
'v2.5.22: Gera lançamentos recorrentes de tipo_recorrencia=FIXO_MENSAL para TODO O ANO (Jan-Dez). 
Renomeado de FIXA para FIXO_MENSAL para consistência com UI.';

-- 5. RECRIAR TRIGGER FUNCTION COM NOVO VALOR
CREATE OR REPLACE FUNCTION trg_auto_gerar_recorrencias_fixa()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.tipo_recorrencia = 'FIXO_MENSAL' AND NEW.ativo = TRUE) OR
       (TG_OP = 'UPDATE' AND OLD.tipo_recorrencia != 'FIXO_MENSAL' AND NEW.tipo_recorrencia = 'FIXO_MENSAL' AND NEW.ativo = TRUE) THEN
        PERFORM processar_recorrencias_financeiras();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_auto_gerar_recorrencias_fixa IS
'v2.5.22: Dispara processar_recorrencias_financeiras() quando categoria vira FIXO_MENSAL. 
Renomeado de FIXA para FIXO_MENSAL para consistência com UI.';

-- 6. VERIFICAÇÃO
DO $$
DECLARE
    v_fixo_mensal INTEGER;
    v_fixo_variavel INTEGER;
    v_variavel INTEGER;
    v_legado INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_fixo_mensal FROM financeiro_itens_plano WHERE tipo_recorrencia = 'FIXO_MENSAL';
    SELECT COUNT(*) INTO v_fixo_variavel FROM financeiro_itens_plano WHERE tipo_recorrencia = 'FIXO_VARIAVEL';
    SELECT COUNT(*) INTO v_variavel FROM financeiro_itens_plano WHERE tipo_recorrencia = 'VARIAVEL';
    SELECT COUNT(*) INTO v_legado FROM financeiro_itens_plano WHERE tipo_recorrencia IN ('FIXA', 'NENHUMA');
    
    RAISE NOTICE 'Migração concluída: FIXO_MENSAL=%, FIXO_VARIAVEL=%, VARIAVEL=%, Legado=%',
        v_fixo_mensal, v_fixo_variavel, v_variavel, v_legado;
    
    IF v_legado > 0 THEN
        RAISE WARNING 'ATENÇÃO: Ainda existem % registros com nomenclatura legada!', v_legado;
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
