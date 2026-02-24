-- Verificando existência da Filial Aririzal
SELECT * FROM public.empresas WHERE nome_fantasia ILIKE '%Aririzal%';
SELECT * FROM public.lojas WHERE nome_fantasia ILIKE '%Aririzal%';
