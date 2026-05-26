/*
  # Autenticação e Perfis de Usuários
  Creates perfis and usuarios tables with trigger for auto-profile creation.
*/

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

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    acesso_empresas UUID[] DEFAULT '{}',
    nome VARCHAR NOT NULL DEFAULT '',
    email VARCHAR NOT NULL DEFAULT '',
    role VARCHAR DEFAULT 'operador',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_perfis_loja_id ON perfis(loja_id);
CREATE INDEX IF NOT EXISTS idx_perfis_role ON perfis(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfis (id, nome, role, ativo)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'nome', new.email),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'operador'),
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
