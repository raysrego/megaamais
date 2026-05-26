/*
  # Sync perfis->usuarios trigger and categorias operacionais seed
*/

CREATE OR REPLACE FUNCTION public.handle_perfil_to_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
    v_empresa_id UUID;
BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
    IF NEW.role = 'admin' THEN
        SELECT id INTO v_empresa_id FROM empresas LIMIT 1;
    ELSE
        v_empresa_id := COALESCE(NEW.loja_id, (SELECT id FROM empresas LIMIT 1));
    END IF;
    IF v_empresa_id IS NULL THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.usuarios (id, empresa_id, nome, email, role, ativo, created_at, updated_at)
    VALUES (
        NEW.id, v_empresa_id, NEW.nome,
        COALESCE(v_email, NEW.nome || '@sistema.local'),
        COALESCE(NEW.role::VARCHAR, 'operador'),
        COALESCE(NEW.ativo, true), COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, usuarios.empresa_id),
        nome = EXCLUDED.nome,
        email = COALESCE(EXCLUDED.email, usuarios.email),
        role = EXCLUDED.role,
        ativo = EXCLUDED.ativo,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_perfil_to_usuarios ON perfis;
CREATE TRIGGER sync_perfil_to_usuarios
    AFTER INSERT OR UPDATE ON perfis
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_perfil_to_usuarios();

CREATE OR REPLACE FUNCTION criar_categorias_operacionais_padrao(p_empresa_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM categorias_operacionais WHERE empresa_id = p_empresa_id) THEN RETURN; END IF;
    INSERT INTO categorias_operacionais (nome, tipo, descricao, cor, icone, ordem, empresa_id, ativo) VALUES
        ('Recebimento PIX', 'entrada', 'Pagamentos recebidos via PIX', '#22c55e', 'Smartphone', 1, p_empresa_id, true),
        ('Venda em Dinheiro', 'entrada', 'Vendas pagas em espécie', '#3b82f6', 'Wallet', 2, p_empresa_id, true),
        ('Suprimento de Caixa', 'entrada', 'Reforço de numerário', '#8b5cf6', 'TrendingUp', 3, p_empresa_id, true),
        ('Devolução', 'entrada', 'Devoluções de produtos ou serviços', '#06b6d4', 'RotateCcw', 4, p_empresa_id, true),
        ('Sangria/Cofre', 'saida', 'Retirada de numerário para cofre', '#ef4444', 'Building', 1, p_empresa_id, true),
        ('Pagamento Boleto', 'saida', 'Pagamento de boletos lotéricos', '#f59e0b', 'FileText', 2, p_empresa_id, true),
        ('Depósito Filial', 'saida', 'Depósito em conta de outra filial', '#64748b', 'Building2', 3, p_empresa_id, true),
        ('Despesa Operacional', 'saida', 'Despesas do dia a dia', '#ec4899', 'ShoppingCart', 4, p_empresa_id, true),
        ('Estorno', 'saida', 'Estorno de transações', '#dc2626', 'AlertCircle', 5, p_empresa_id, true)
    ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_criar_categorias_nova_empresa()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM criar_categorias_operacionais_padrao(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_nova_empresa_categorias ON empresas;
CREATE TRIGGER trigger_nova_empresa_categorias
    AFTER INSERT ON empresas FOR EACH ROW
    EXECUTE FUNCTION trigger_criar_categorias_nova_empresa();
