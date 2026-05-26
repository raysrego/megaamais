/*
  # Estrutura Organizacional - Grupos e Empresas
  Creates grupos and empresas tables for multi-tenant structure.
*/

CREATE TABLE IF NOT EXISTS grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR NOT NULL,
    empresa_matriz_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

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

ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_empresas_grupo_id ON empresas(grupo_id);
CREATE INDEX IF NOT EXISTS idx_empresas_cnpj ON empresas(cnpj);
CREATE INDEX IF NOT EXISTS idx_empresas_ativo ON empresas(ativo);
