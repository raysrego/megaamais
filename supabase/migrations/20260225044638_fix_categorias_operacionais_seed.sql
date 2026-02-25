/*
  # Inserir Categorias Operacionais Padrão
  
  1. Descrição
    - Cria função para inserir categorias operacionais padrão para uma empresa
    - Insere categorias para todas as empresas existentes
    - Garante que novas empresas terão categorias via trigger
  
  2. Categorias
    - ENTRADA: Recebimento PIX, Venda em Dinheiro, Suprimento, Devolução
    - SAÍDA: Sangria/Cofre, Pagamento Boleto, Depósito Filial, Despesa Operacional, Estorno
*/

-- ==========================================
-- 1. FUNÇÃO PARA CRIAR CATEGORIAS PADRÃO
-- ==========================================

CREATE OR REPLACE FUNCTION criar_categorias_operacionais_padrao(p_empresa_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se já existem categorias para esta empresa
  IF EXISTS (SELECT 1 FROM categorias_operacionais WHERE empresa_id = p_empresa_id) THEN
    RETURN;
  END IF;

  -- Inserir categorias de ENTRADA
  INSERT INTO categorias_operacionais (nome, tipo, descricao, cor, icone, ordem, empresa_id, ativo)
  VALUES 
    ('Recebimento PIX', 'entrada', 'Pagamentos recebidos via PIX', '#22c55e', 'Smartphone', 1, p_empresa_id, true),
    ('Venda em Dinheiro', 'entrada', 'Vendas pagas em espécie', '#3b82f6', 'Wallet', 2, p_empresa_id, true),
    ('Suprimento de Caixa', 'entrada', 'Reforço de numerário', '#8b5cf6', 'TrendingUp', 3, p_empresa_id, true),
    ('Devolução', 'entrada', 'Devoluções de produtos ou serviços', '#06b6d4', 'RotateCcw', 4, p_empresa_id, true)
  ON CONFLICT DO NOTHING;

  -- Inserir categorias de SAÍDA
  INSERT INTO categorias_operacionais (nome, tipo, descricao, cor, icone, ordem, empresa_id, ativo)
  VALUES 
    ('Sangria/Cofre', 'saida', 'Retirada de numerário para cofre', '#ef4444', 'Building', 1, p_empresa_id, true),
    ('Pagamento Boleto', 'saida', 'Pagamento de boletos lotéricos', '#f59e0b', 'FileText', 2, p_empresa_id, true),
    ('Depósito Filial', 'saida', 'Depósito em conta de outra filial', '#64748b', 'Building2', 3, p_empresa_id, true),
    ('Despesa Operacional', 'saida', 'Despesas do dia a dia', '#ec4899', 'ShoppingCart', 4, p_empresa_id, true),
    ('Estorno', 'saida', 'Estorno de transações', '#dc2626', 'AlertCircle', 5, p_empresa_id, true)
  ON CONFLICT DO NOTHING;
  
END;
$$;

-- ==========================================
-- 2. TRIGGER PARA NOVAS EMPRESAS
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_criar_categorias_nova_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Criar categorias operacionais padrão para a nova empresa
  PERFORM criar_categorias_operacionais_padrao(NEW.id);
  RETURN NEW;
END;
$$;

-- Drop trigger se existir e recria
DROP TRIGGER IF EXISTS trigger_nova_empresa_categorias ON empresas;

CREATE TRIGGER trigger_nova_empresa_categorias
  AFTER INSERT ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION trigger_criar_categorias_nova_empresa();

-- ==========================================
-- 3. INSERIR CATEGORIAS PARA EMPRESAS EXISTENTES
-- ==========================================

DO $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Para cada empresa existente, criar categorias
  FOR v_empresa_id IN SELECT id FROM empresas
  LOOP
    PERFORM criar_categorias_operacionais_padrao(v_empresa_id);
  END LOOP;
END $$;

-- ==========================================
-- 4. COMENTÁRIOS
-- ==========================================

COMMENT ON FUNCTION criar_categorias_operacionais_padrao IS 'Cria categorias operacionais padrão para uma empresa';
COMMENT ON FUNCTION trigger_criar_categorias_nova_empresa IS 'Trigger que cria categorias ao inserir nova empresa';
