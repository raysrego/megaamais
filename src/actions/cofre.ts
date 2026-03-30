'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Registrar depósito bancário a partir do cofre ───
// Agora vincula conta_bancaria_id para rastreio na conciliação
export async function registrarDepositoCofre(
    valor: number,
    contaBancariaId: string,
    observacoes?: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');
    if (valor <= 0) throw new Error('Valor deve ser positivo');

    const { data, error } = await supabase.rpc('registrar_deposito_cofre', {
        p_valor: valor,
        p_conta_id: contaBancariaId,
        p_usuario_id: user.id,
        p_observacoes: observacoes ?? null,
    });

    if (error) throw new Error(`Erro ao registrar depósito: ${error.message}`);

    const resultado = data as { success: boolean; error?: string };
    if (!resultado.success) {
        throw new Error(resultado.error || 'Erro ao registrar depósito');
    }

    revalidatePath('/cofre');
    revalidatePath('/conciliacao');
    return resultado;
}

// ─── Buscar entradas do cofre por fechamento aprovado ───
export async function getEntradasCofrePorFechamento() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('cofre_entradas_por_fechamento')
        .select('*')
        .order('data_turno', { ascending: false })
        .limit(50);

    if (error) throw new Error(`Erro: ${error.message}`);
    return data ?? [];
}

// ─── Buscar saldo atual do cofre ───
export async function getSaldoCofre(): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('cofre_saldo_atual')
        .select('saldo')
        .single();

    if (error) return 0;
    return data?.saldo ?? 0;
}

// ─── Buscar histórico do cofre com rastreio ───
export async function getHistoricoCofre(limite: number = 30) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('cofre_movimentacoes')
        .select(`
            id, tipo, valor, observacoes, data_movimentacao, created_at,
            operador_id, origem_sessao_id, conta_bancaria_id
        `)
        .order('data_movimentacao', { ascending: false })
        .limit(limite);

    if (error) throw new Error(`Erro: ${error.message}`);
    return data ?? [];
}

// ─── Buscar depósitos pendentes de conciliação ───
export async function getDepositosPendentes() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('vw_cofre_depositos_rastreio')
        .select('*')
        .eq('status_conciliacao', 'pendente')
        .order('data_movimentacao', { ascending: false });

    if (error) throw new Error(`Erro: ${error.message}`);
    return data ?? [];
}
