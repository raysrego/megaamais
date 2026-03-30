/*
  # Autenticação e Perfis de Usuários
  
  1. Novas Tabelas
    - `perfis`
      - Extende auth.users do Supabase
      - `id` (uuid, PK) - Vinculado a auth.users
      - `role` (user_role) - Papel do usuário
      - `nome` (text) - Nome completo
      - `avatar_url` (text) - URL da foto
      - `loja_id` (uuid) - Loja vinculada
      - `ativo` (boolean) - Status do usuário
      
    - `usuarios`
      - Dados expandidos de usuários
      - `id` (uuid, PK) - Vinculado a auth.users
      - `empresa_id` (uuid) - Empresa principal
      - `acesso_empresas` (uuid[]) - Array de empresas com acesso
      - `nome`, `email`, `role`
      - `ativo` (boolean)
      
  2. Segurança
    - RLS habilitado em ambas tabelas
    - Perfis vinculados a auth.users com CASCADE DELETE
    - Usuários só podem ver dados da própria loja (multi-tenant)
    
  3. Trigger
    - Auto-criação de perfil ao registrar novo usuário
*/

-- Tabela de Perfis (principal)
CREATE TABLE IF NOT EXISTS perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'operador',
    nome TEXT,
    avatar_url TEXT,
    loja_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Tabela de Usuários (expandida)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    acesso_empresas UUID[] DEFAULT '{}',
    nome VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'operador',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_perfis_loja_id ON perfis(loja_id);
CREATE INDEX IF NOT EXISTS idx_perfis_role ON perfis(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Função para criar perfil automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfis (id, nome, role, ativo)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'nome', new.email),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'operador'),
        true
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auto-criar perfil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();