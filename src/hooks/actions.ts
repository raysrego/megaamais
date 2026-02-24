'use server';

import { createClient } from '@/lib/supabase';

export async function getPerfilAction() {
    const supabase = await createClient();

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { error: 'Não autenticado' };
        }

        // Usar query direta no servidor (Servidor não tem problema de RLS recursivo se for admin query, 
        // mas aqui o servidor usa o contexto do usuário)
        const { data, error } = await supabase
            .from('perfis')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('[SERVER_ACTION] Erro ao buscar perfil:', error.message);
            return { error: error.message };
        }

        return { data };
    } catch (err: any) {
        console.error('[SERVER_ACTION] Erro crítico:', err.message);
        return { error: err.message };
    }
}

export async function getLojasAction() {
    const supabase = await createClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Não autenticado' };

        // Buscar perfil para saber se tem loja fixa
        const { data: perfil } = await supabase
            .from('perfis')
            .select('role, loja_id, nome')
            .eq('id', user.id)
            .single();


        let query = supabase
            .from('empresas')
            .select('id, nome_fantasia, grupo_id')
            .eq('ativo', true)
            .order('nome_fantasia');

        if (perfil?.loja_id) {
            query = query.eq('id', perfil.loja_id);
        }

        const { data, error } = await query;

        if (error) return { error: error.message };
        return { data };
    } catch (err: any) {
        return { error: err.message };
    }
}

export async function getDashboardKPIsAction(lojaId: string) {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase.rpc('get_dashboard_metrics', {
            p_loja_id: lojaId
        });
        if (error) return { error: error.message };
        return { data };
    } catch (err: any) {
        return { error: err.message };
    }
}

export async function getConsolidadoFiliaisAction() {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase.rpc('get_admin_dashboard_summary');
        if (error) return { error: error.message };
        return { data };
    } catch (err: any) {
        return { error: err.message };
    }
}

export async function getFinanceiroAction(ano: number, mes: number, lojaId: string | null) {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase.rpc('get_financeiro_transactions', {
            p_loja_id: lojaId,
            p_ano: ano,
            p_mes: mes
        });
        if (error) return { error: error.message };
        return { data };
    } catch (err: any) {
        return { error: err.message };
    }
}

export async function getUsersAction() {
    const supabase = await createClient();
    try {
        // PRIORIDADE: RPC (Bypass RLS Enum Errors e Performance)
        const { data, error: rpcError } = await supabase.rpc('get_all_users');

        if (!rpcError && data) {
            return { data };
        }

        console.warn('[USERS_ACTION] RPC falhou ou não existe, tentando query direta:', rpcError?.message);

        // FALLBACK: Query Direta (Caso a migration ainda não tenha rodado)
        const { data: directData, error: dirError } = await supabase
            .from('perfis')
            .select('*')
            .order('ativo', { ascending: false })
            .order('created_at', { ascending: false });

        if (dirError) return { error: dirError.message };
        return { data: directData };
    } catch (err: any) {
        return { error: err.message };
    }
}
