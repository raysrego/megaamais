-- CHECK TABLE COLUMNS
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'financeiro_contas'
ORDER BY column_name;

-- CHECK FOR PAYMENT METHODS TABLE
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name ILIKE '%forma%' OR table_name ILIKE '%pagamento%';
