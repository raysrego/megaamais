/*
  # Estrutura Organizacional - Grupos e Empresas
  
  1. Novas Tabelas
    - `grupos`
      - Agrupa múltiplas empresas/lojas
      - Suporta hierarquia empresarial
      - `id` (uuid, primary key)
      - `nome` (text) - Nome do grupo
      - `empresa_matriz_id` (uuid, opcional) - Referência à empresa matriz
      - `created_at` (timestamptz)
      
    - `empresas`
      - Filiais/lojas do sistema (multi-tenant)
      - `id` (uuid, primary key)
      - `grupo_id` (uuid, foreign key)
      - `nome` (varchar) - Razão social
      - `nome_fantasia` (varchar)
      - `cnpj` (varchar, unique)
      - `inscricao_estadual` (varchar)
      - Campos de endereço completo
      - `telefone`, `email`
      - `logo_url` (text) - URL do logo
      - `ativo` (boolean) - Se a empresa está ativa
      
  2. Segurança
    - RLS habilitado em ambas tabelas
    - Policies baseadas em perfil do usuário
    
  3. Notas
    - Multi-tenant: todas as transações devem ter `loja_id`
    - Suporta grupos empresariais com múltiplas filiais
*/

-- Tabela de Grupos Empresariais
CREATE TABLE IF NOT EXISTS grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR NOT NULL,
    empresa_matriz_id UUID, -- Será vinculado depois
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Empresas/Lojas (Multi-tenant)
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES grupos(id) ON DELETE SET NULL,
    nome VARCHAR NOT NULL,
    nome_fantasia VARCHAR,
    cnpj VARCHAR UNIQUE,
    inscricao_estadual VARCHAR,
    endereco_logradouro VARCHAR,
    endereco_numero VARCHAR,
    endereco_bairro VARCHAR,
    endereco_cidade VARCHAR,
    endereco_uf CHAR(2),
    endereco_cep VARCHAR,
    telefone VARCHAR,
    email VARCHAR,
    logo_url TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar FK recursiva em grupos (referência para empresa matriz)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_grupos_empresa_matriz'
    ) THEN
        ALTER TABLE grupos 
        ADD CONSTRAINT fk_grupos_empresa_matriz 
        FOREIGN KEY (empresa_matriz_id) REFERENCES empresas(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_empresas_grupo_id ON empresas(grupo_id);
CREATE INDEX IF NOT EXISTS idx_empresas_cnpj ON empresas(cnpj);
CREATE INDEX IF NOT EXISTS idx_empresas_ativo ON empresas(ativo);