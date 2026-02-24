-- PERMISSIONS DATA SANITIZATION
-- Ensures strict roles and synchronizes legacy 'usuarios' table.

-- 1. Ensure 'loteria@demo.com' is Master everywhere
UPDATE public.perfis 
SET role = 'master' 
WHERE id IN (
    SELECT id FROM auth.users 
    WHERE LOWER(TRIM(email)) = 'loteria@demo.com'
);

-- 2. Downgrade any OTHER user who is accidentally 'master'
-- Safety measure: Only we allow the official admin to be master for now.
UPDATE public.perfis 
SET role = 'operador'
WHERE role = 'master' 
AND id NOT IN (
    SELECT id FROM auth.users 
    WHERE LOWER(TRIM(email)) = 'loteria@demo.com'
);

-- 3. Audit Check
SELECT u.email, p.role, p.loja_id
FROM public.perfis p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role ASC;
