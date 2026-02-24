-- ==========================================
-- MIGRATION: 20260219200000_fix_audit_trigger_hanging.sql
-- Objetivo: CORRIGIR BUG CRÍTICO — "Salvando..." infinito
--
-- CAUSA RAIZ:
-- O trigger "log_financeiro_contas_changes" (AFTER INSERT/UPDATE/DELETE)
-- insere no audit_log que tem RLS "USING(is_master())".
-- O RLS bloqueia o INSERT silenciosamente, travando toda a transação.
--
-- SOLUÇÃO:
-- 1. Remover o trigger de log que trava
-- 2. Remover RLS da tabela audit_log (apenas log interno)
-- 3. Limpar triggers residuais do motor de recorrência
-- 4. Recriar trigger de audit simplificado (sem INSERT em tabelas com RLS)
-- ==========================================

-- 1. DROPAR TRIGGER QUE CAUSA O HANG
DROP TRIGGER IF EXISTS log_financeiro_contas_changes ON financeiro_contas;

-- 2. REMOVER RLS DO audit_log (é tabela interna de log, não precisa de RLS no INSERT)
-- Manter RLS apenas para LEITURA
DROP POLICY IF EXISTS "admin_audit_log_access" ON audit_log;

-- Criar policy permissiva para INSERT (logs de qualquer operação)
CREATE POLICY "audit_log_insert" ON audit_log
    FOR INSERT TO authenticated
    WITH CHECK (true);  -- Qualquer autenticado pode INSERIR log

-- Manter policy restrita para SELECT (apenas admin lê)
CREATE POLICY "audit_log_read" ON audit_log
    FOR SELECT TO authenticated
    USING (public.is_master());

-- 3. RECRIAR O TRIGGER DE LOG (agora não vai travar)
CREATE OR REPLACE FUNCTION public.log_critical_change()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT no audit_log agora passa pelo RLS permissivo
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
        auth.uid()
    );
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    -- Se falhar por qualquer razão, NÃO travar a operação principal
    RAISE WARNING 'Audit log falhou: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_financeiro_contas_changes
    AFTER INSERT OR UPDATE OR DELETE ON financeiro_contas
    FOR EACH ROW EXECUTE FUNCTION log_critical_change();

-- 4. LIMPAR TRIGGERS RESIDUAIS DO MOTOR DE RECORRÊNCIA
DROP TRIGGER IF EXISTS trg_update_future_recurrences ON financeiro_itens_plano;
DROP FUNCTION IF EXISTS trg_update_future_recurrences_fn();

-- 5. VERIFICAR QUE O set_audit_fields TAMBÉM NÃO TRAVA
-- O trigger financeiro_contas_audit (BEFORE INSERT/UPDATE) seta updated_by/updated_at
-- Ele deve estar OK pois não faz INSERT em outra tabela
-- Mas vamos garantir que tem EXCEPTION handler
CREATE OR REPLACE FUNCTION public.set_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_by = auth.uid();
        IF TG_TABLE_NAME <> 'caixa_movimentacoes' THEN
            NEW.created_at = COALESCE(NEW.created_at, NOW());
        END IF;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_by = auth.uid();
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Não travar a operação se falhar ao setar campos de auditoria
    RAISE WARNING 'set_audit_fields falhou: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RESULTADO ESPERADO:
-- INSERT/UPDATE em financeiro_contas agora completa em <1s
-- O audit_log continua registrando, mas sem travar
-- Apenas admin pode LER o audit_log (mas todos podem INSERIR nele)
-- ==========================================
