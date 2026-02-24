-- Allow inserts for authenticated users
CREATE POLICY "empresas_insert" ON public.empresas
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow updates for authenticated users
CREATE POLICY "empresas_update" ON public.empresas
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- Ensure Sequence permissions if needed (though usually handled by role)
GRANT ALL ON public.empresas TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
