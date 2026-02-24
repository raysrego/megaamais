SELECT 
    conname AS constraint_name, 
    confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE conrelid = 'financeiro_itens_plano'::regclass;
