-- Migration: Create boloes table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bolao_status') THEN
        CREATE TYPE bolao_status AS ENUM ('disponivel', 'finalizado', 'cancelado');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS boloes (
    id BIGSERIAL PRIMARY KEY,
    produto_id BIGINT REFERENCES produtos(id),
    concurso TEXT NOT NULL,
    data_sorteio DATE NOT NULL,
    qtd_jogos INTEGER NOT NULL DEFAULT 1,
    dezenas INTEGER NOT NULL,
    valor_cota_base DECIMAL(10, 2) NOT NULL,
    taxa_administrativa DECIMAL(10, 2) NOT NULL DEFAULT 35.00,
    qtd_cotas INTEGER NOT NULL,
    preco_venda_cota DECIMAL(10, 2) NOT NULL,
    cotas_vendidas INTEGER NOT NULL DEFAULT 0,
    status bolao_status DEFAULT 'disponivel',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_boloes_produto_id ON boloes(produto_id);
CREATE INDEX IF NOT EXISTS idx_boloes_status ON boloes(status);
