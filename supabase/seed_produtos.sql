-- Migration: Seed produtos table with official CAIXA lotteries
INSERT INTO produtos (nome, slug, cor, icone, min_dezenas, max_dezenas, preco_base, ativo, created_at, updated_at)
VALUES 
    ('Mega-Sena', 'mega-sena', '#209869', 'Clover', 6, 15, 5.00, true, NOW(), NOW()),
    ('Lotofácil', 'lotofacil', '#930089', 'Clover', 15, 20, 3.00, true, NOW(), NOW()),
    ('Quina', 'quina', '#260085', 'Clover', 5, 15, 2.50, true, NOW(), NOW()),
    ('Lotomania', 'lotomania', '#f7941d', 'Clover', 50, 50, 3.00, true, NOW(), NOW()),
    ('Timemania', 'timemania', '#fff200', 'Clover', 10, 10, 3.50, true, NOW(), NOW()),
    ('Dupla Sena', 'dupla-sena', '#a61324', 'Clover', 6, 15, 2.50, true, NOW(), NOW()),
    ('Dia de Sorte', 'dia-de-sorte', '#00afad', 'Clover', 7, 15, 2.50, true, NOW(), NOW()),
    ('+Milionária', 'mais-milionaria', '#1d509a', 'Plus', 6, 12, 6.00, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
    nome = EXCLUDED.nome,
    cor = EXCLUDED.cor,
    icone = EXCLUDED.icone,
    min_dezenas = EXCLUDED.min_dezenas,
    max_dezenas = EXCLUDED.max_dezenas,
    preco_base = EXCLUDED.preco_base,
    ativo = EXCLUDED.ativo,
    updated_at = NOW();
