-- ==========================================
-- MIGRATION: 20260210140000_auto_trigger_recorrencias_v2_5_14.sql
-- v2.5.14 - Automatização: Trigger para gerar recorrências FIXAS
-- ==========================================
-- Problema: Usuário precisa clicar manualmente em "Gerar Recorrências"
-- Solução: Trigger automático dispara quando categoria vira FIXA
-- ==========================================

-- 1. FUNÇÃO DE TRIGGER: Gera recorrências automaticamente
CREATE OR REPLACE FUNCTION trg_auto_gerar_recorrencias_fixa()
RETURNS TRIGGER AS $$
BEGIN
    -- Só dispara se:
    -- 1. Novo registro FIXA (INSERT)
    -- 2. Mudança de qualquer tipo → FIXA (UPDATE)
    IF (TG_OP = 'INSERT' AND NEW.tipo_recorrencia = 'FIXA' AND NEW.ativo = TRUE) OR
       (TG_OP = 'UPDATE' AND OLD.tipo_recorrencia != 'FIXA' AND NEW.tipo_recorrencia = 'FIXA' AND NEW.ativo = TRUE) THEN
        
        -- ✅ Executar função de processamento em background
        -- Usando PERFORM para funções que retornam void ou TABLE
        PERFORM processar_recorrencias_financeiras();
        
        RAISE NOTICE 'Recorrências geradas automaticamente para item %', NEW.item;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CRIAR TRIGGER NA TABELA financeiro_itens_plano
DROP TRIGGER IF EXISTS auto_gerar_recorrencias_trigger ON financeiro_itens_plano;

CREATE TRIGGER auto_gerar_recorrencias_trigger
AFTER INSERT OR UPDATE OF tipo_recorrencia, ativo ON financeiro_itens_plano
FOR EACH ROW
EXECUTE FUNCTION trg_auto_gerar_recorrencias_fixa();

-- 3. DOCUMENTAÇÃO
COMMENT ON FUNCTION trg_auto_gerar_recorrencias_fixa IS
'v2.5.14: Dispara automaticamente processar_recorrencias_financeiras() quando uma categoria é marcada como FIXA. 
Elimina necessidade de botão manual "Gerar Recorrências".';

COMMENT ON TRIGGER auto_gerar_recorrencias_trigger ON financeiro_itens_plano IS
'Trigger automático que gera lançamentos de Jan-Dez quando categoria vira FIXA.';

-- 4. EXECUTAR MANUALMENTE UMA VEZ PARA GARANTIR QUE TODAS AS FIXAS EXISTENTES TENHAM LANÇAMENTOS
DO $$
DECLARE
    v_processadas INTEGER;
BEGIN
    SELECT * INTO v_processadas FROM processar_recorrencias_financeiras();
    RAISE NOTICE 'Processamento inicial: % lançamentos criados', v_processadas;
END $$;

NOTIFY pgrst, 'reload config';
