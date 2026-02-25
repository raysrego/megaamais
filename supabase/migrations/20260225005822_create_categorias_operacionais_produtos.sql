/*
  # Sistema de Categorias Operacionais e Produtos

  ## 1. Nova Tabela: categorias_operacionais
    - `id` (serial, primary key)
    - `nome` (text, nome da categoria)
    - `tipo` (enum: 'entrada' | 'saida')
    - `descricao` (text, opcional)
    - `cor` (text, cor para UI)
    - `icone` (text, nome do ícone)
    - `ativo` (boolean, padrão true)
    - `ordem` (integer, para ordenação na UI)
    - `empresa_id` (uuid, FK para empresas)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 2. Alteração na tabela categorias_produtos existente
    - Adiciona coluna `empresa_id` (uuid, FK para empresas)
    - Adiciona coluna `tipo` (text)
    - Adiciona coluna `descricao` (text)
    - Adiciona coluna `ordem` (integer)
    - Adiciona coluna `updated_at` (timestamptz)

  ## 3. Alteração na tabela caixa_movimentacoes
    - Adiciona `categoria_operacional_id` (integer, FK)
    - Adiciona `categoria_produto_id` (integer, FK)

  ## 4. Segurança
    - Habilita RLS nas novas tabelas
    - Políticas para admin e gerente gerenciar
    - Políticas para operadores visualizar

  ## 5. Dados Iniciais
    - Insere categorias operacionais padrão
    - Atualiza categorias de produtos existentes
*/

-- ==========================================
-- 1. CRIAÇÃO DA TABELA CATEGORIAS_OPERACIONAIS
-- ==========================================

CREATE TABLE IF NOT EXISTS categorias_operacionais (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao TEXT,
  cor TEXT DEFAULT '#6b7280',
  icone TEXT DEFAULT 'DollarSign',
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. ATUALIZAR TABELA CATEGORIAS_PRODUTOS
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categorias_produtos' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE categorias_produtos ADD COLUMN empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categorias_produtos' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE categorias_produtos ADD COLUMN tipo TEXT DEFAULT 'loteria';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categorias_produtos' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE categorias_produtos ADD COLUMN descricao TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categorias_produtos' AND column_name = 'ordem'
  ) THEN
    ALTER TABLE categorias_produtos ADD COLUMN ordem INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categorias_produtos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE categorias_produtos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- ==========================================
-- 3. ADICIONAR COLUNAS EM CAIXA_MOVIMENTACOES
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'caixa_movimentacoes' AND column_name = 'categoria_operacional_id'
  ) THEN
    ALTER TABLE caixa_movimentacoes ADD COLUMN categoria_operacional_id INTEGER REFERENCES categorias_operacionais(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'caixa_movimentacoes' AND column_name = 'categoria_produto_id'
  ) THEN
    ALTER TABLE caixa_movimentacoes ADD COLUMN categoria_produto_id INTEGER REFERENCES categorias_produtos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==========================================
-- 4. HABILITAR RLS
-- ==========================================

ALTER TABLE categorias_operacionais ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. POLÍTICAS RLS - CATEGORIAS OPERACIONAIS
-- ==========================================

-- Todos usuários autenticados podem visualizar categorias da sua empresa
CREATE POLICY "Usuarios podem visualizar categorias operacionais da empresa"
  ON categorias_operacionais
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.empresa_id = categorias_operacionais.empresa_id
    )
  );

-- Admin e Gerente podem inserir categorias
CREATE POLICY "Gestores podem criar categorias operacionais"
  ON categorias_operacionais
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.empresa_id = categorias_operacionais.empresa_id
      AND u.role IN ('admin', 'gerente', 'operador-admin')
    )
  );

-- Admin e Gerente podem atualizar categorias
CREATE POLICY "Gestores podem atualizar categorias operacionais"
  ON categorias_operacionais
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.empresa_id = categorias_operacionais.empresa_id
      AND u.role IN ('admin', 'gerente', 'operador-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.empresa_id = categorias_operacionais.empresa_id
      AND u.role IN ('admin', 'gerente', 'operador-admin')
    )
  );

-- Admin pode deletar categorias
CREATE POLICY "Admin pode deletar categorias operacionais"
  ON categorias_operacionais
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.empresa_id = categorias_operacionais.empresa_id
      AND u.role = 'admin'
    )
  );

-- ==========================================
-- 6. POLÍTICAS RLS - CATEGORIAS PRODUTOS (ATUALIZAR)
-- ==========================================

-- Todos usuários autenticados podem visualizar categorias da sua empresa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Usuarios podem visualizar categorias produtos da empresa' AND tablename = 'categorias_produtos'
  ) THEN
    CREATE POLICY "Usuarios podem visualizar categorias produtos da empresa"
      ON categorias_produtos
      FOR SELECT
      TO authenticated
      USING (
        empresa_id IS NULL OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.empresa_id = categorias_produtos.empresa_id
        )
      );
  END IF;
END $$;

-- Admin e Gerente podem inserir categorias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Gestores podem criar categorias produtos' AND tablename = 'categorias_produtos'
  ) THEN
    CREATE POLICY "Gestores podem criar categorias produtos"
      ON categorias_produtos
      FOR INSERT
      TO authenticated
      WITH CHECK (
        empresa_id IS NULL OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.empresa_id = categorias_produtos.empresa_id
          AND u.role IN ('admin', 'gerente', 'operador-admin')
        )
      );
  END IF;
END $$;

-- Admin e Gerente podem atualizar categorias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Gestores podem atualizar categorias produtos' AND tablename = 'categorias_produtos'
  ) THEN
    CREATE POLICY "Gestores podem atualizar categorias produtos"
      ON categorias_produtos
      FOR UPDATE
      TO authenticated
      USING (
        empresa_id IS NULL OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.empresa_id = categorias_produtos.empresa_id
          AND u.role IN ('admin', 'gerente', 'operador-admin')
        )
      )
      WITH CHECK (
        empresa_id IS NULL OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.empresa_id = categorias_produtos.empresa_id
          AND u.role IN ('admin', 'gerente', 'operador-admin')
        )
      );
  END IF;
END $$;

-- Admin pode deletar categorias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admin pode deletar categorias produtos' AND tablename = 'categorias_produtos'
  ) THEN
    CREATE POLICY "Admin pode deletar categorias produtos"
      ON categorias_produtos
      FOR DELETE
      TO authenticated
      USING (
        empresa_id IS NULL OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.empresa_id = categorias_produtos.empresa_id
          AND u.role = 'admin'
        )
      );
  END IF;
END $$;

-- ==========================================
-- 7. ÍNDICES PARA PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_categorias_operacionais_empresa ON categorias_operacionais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_operacionais_tipo ON categorias_operacionais(tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_operacionais_ativo ON categorias_operacionais(ativo);

CREATE INDEX IF NOT EXISTS idx_categorias_produtos_empresa ON categorias_produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_produtos_tipo ON categorias_produtos(tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_produtos_ativo ON categorias_produtos(ativo);

CREATE INDEX IF NOT EXISTS idx_caixa_mov_cat_operacional ON caixa_movimentacoes(categoria_operacional_id);
CREATE INDEX IF NOT EXISTS idx_caixa_mov_cat_produto ON caixa_movimentacoes(categoria_produto_id);

-- ==========================================
-- 8. DADOS INICIAIS - CATEGORIAS OPERACIONAIS
-- ==========================================

-- Inserir categorias operacionais padrão para cada empresa existente
DO $$
DECLARE
  v_empresa_id UUID;
BEGIN
  FOR v_empresa_id IN SELECT id FROM empresas
  LOOP
    -- Categorias de ENTRADA
    INSERT INTO categorias_operacionais (nome, tipo, descricao, cor, icone, ordem, empresa_id)
    VALUES 
      ('Recebimento PIX', 'entrada', 'Pagamentos recebidos via PIX', '#22c55e', 'Smartphone', 1, v_empresa_id),
      ('Venda em Dinheiro', 'entrada', 'Vendas pagas em especie', '#3b82f6', 'Wallet', 2, v_empresa_id),
      ('Suprimento de Caixa', 'entrada', 'Reforco de numerario', '#8b5cf6', 'TrendingUp', 3, v_empresa_id),
      ('Devolucao', 'entrada', 'Devolucoes de produtos ou servicos', '#06b6d4', 'RotateCcw', 4, v_empresa_id)
    ON CONFLICT DO NOTHING;

    -- Categorias de SAÍDA
    INSERT INTO categorias_operacionais (nome, tipo, descricao, cor, icone, ordem, empresa_id)
    VALUES 
      ('Sangria/Cofre', 'saida', 'Retirada de numerario para cofre', '#ef4444', 'Building', 1, v_empresa_id),
      ('Pagamento Boleto', 'saida', 'Pagamento de boletos lotericos', '#f59e0b', 'FileText', 2, v_empresa_id),
      ('Deposito Filial', 'saida', 'Deposito em conta de outra filial', '#64748b', 'Building', 3, v_empresa_id),
      ('Despesa Operacional', 'saida', 'Despesas do dia a dia', '#ec4899', 'ShoppingCart', 4, v_empresa_id),
      ('Estorno', 'saida', 'Estorno de transacoes', '#dc2626', 'AlertCircle', 5, v_empresa_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ==========================================
-- 9. ATUALIZAR CATEGORIAS PRODUTOS EXISTENTES
-- ==========================================

-- Atualizar categorias de produtos existentes com tipos e ordens
UPDATE categorias_produtos 
SET 
  tipo = 'loteria',
  ordem = CASE nome
    WHEN 'Loterias Federais' THEN 1
    WHEN 'Raspadinhas' THEN 2
    WHEN 'Bolões' THEN 3
    ELSE 99
  END,
  descricao = CASE nome
    WHEN 'Loterias Federais' THEN 'Mega-Sena, Quina, Lotofacil, etc'
    WHEN 'Raspadinhas' THEN 'Loterias instantaneas'
    WHEN 'Bolões' THEN 'Boloes de loteria'
    ELSE 'Outros produtos'
  END
WHERE tipo IS NULL;

-- Inserir categorias adicionais de produtos para cada empresa
DO $$
DECLARE
  v_empresa_id UUID;
BEGIN
  FOR v_empresa_id IN SELECT id FROM empresas
  LOOP
    INSERT INTO categorias_produtos (nome, tipo, descricao, cor, icone, ordem, empresa_id)
    VALUES 
      ('Servicos', 'servico', 'Recarga, contas, etc', '#3b82f6', 'Zap', 4, v_empresa_id),
      ('Produtos Diversos', 'outros', 'Outros produtos vendidos', '#64748b', 'Package', 5, v_empresa_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
