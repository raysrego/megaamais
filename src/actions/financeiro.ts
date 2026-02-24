'use server';

import { createClient } from '@/lib/supabase';

// Motor de recorrência removido em v2.5.22 (modelo "Excel Turbo")
// Lançamentos agora são sempre manuais. Use "Replicar Mês" para copiar entre meses.

export async function getBancos() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('financeiro_bancos')
        .select('*')
        .order('nome');

    if (error) throw error;
    return data;
}

export async function getContasBancarias() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('financeiro_contas_bancarias')
        .select(`
            *,
            financeiro_bancos(nome)
        `)
        .order('nome');

    if (error) throw error;
    return data;
}

export async function realizarDeposito(p_valor: number, p_conta_id: string, p_comprovante?: string, p_observacoes?: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autorizado');

    const { data: perfil } = await supabase
        .from('perfis')
        .select('loja_id')
        .eq('id', user.id)
        .single();

    const { error } = await supabase.rpc('realizar_deposito_bancario', {
        p_valor,
        p_conta_id,
        p_usuario_id: user.id,
        p_loja_id: perfil?.loja_id,
        p_comprovante,
        p_observacoes
    });

    if (error) {
        console.error('Erro ao realizar depósito:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function getTransacoesBancarias(params?: { contaId?: string, status?: string, dataInicio?: string, dataFim?: string }) {
    const supabase = await createClient();

    let query = supabase
        .from('financeiro_transacoes_bancarias')
        .select(`
            *,
            financeiro_contas_bancarias(nome, financeiro_bancos(nome))
        `)
        .order('data_transacao', { ascending: false });

    if (params?.contaId) query = query.eq('conta_id', params.contaId);
    if (params?.status) query = query.eq('status_conciliacao', params.status);
    if (params?.dataInicio) query = query.gte('data_transacao', params.dataInicio);
    if (params?.dataFim) query = query.lte('data_transacao', params.dataFim);

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao buscar transações bancárias:', error);
        throw error;
    }

    return data;
}

export async function conciliarTransacao(p_transacao_id: number) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autorizado');

    const { error } = await supabase.rpc('conciliar_transacao_bancaria', {
        p_transacao_id,
        p_usuario_id: user.id
    });

    if (error) {
        console.error('Erro ao conciliar transação:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
