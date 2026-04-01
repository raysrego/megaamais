'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Registrar depósito bancário a partir do cofre ───
// Agora também registra na tabela depositos_conciliacao para conciliação por filial
export async function registrarDepositoCofre(
    valor: number,
    contaBancariaId: string,
    observacoes?: string,
    dataDeposito?: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');
    if (valor <= 0) throw new Error('Valor deve ser positivo');

    // Obter empresa principal do usuário (filial)
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single();

    if (userError || !userData?.empresa_id) {
        throw new Error('Usuário não possui uma empresa vinculada');
    }

    const lojaId = userData.empresa_id;

    // 1. Registrar a movimentação no cofre (RPC existente)
    const { data, error } = await supabase.rpc('registrar_deposito_cofre', {
        p_valor: valor,
        p_conta_id: contaBancariaId,
        p_usuario_id: user.id,
        p_observacoes: observacoes ?? null,
        p_data_deposito: dataDeposito ?? null,
    });

    if (error) {
        console.error('Erro ao registrar depósito no cofre:', error);
        throw new Error(`Erro ao registrar depósito: ${error.message}`);
    }

    const resultado = data as { success: boolean; error?: string };
    if (!resultado.success) {
        throw new Error(resultado.error || 'Erro ao registrar depósito');
    }

    // 2. Registrar o depósito na tabela de conciliação (filial e valor)
    const { error: insertError } = await supabase
        .from('depositos_conciliacao')
        .insert({
            loja_id: lojaId,
            valor: valor,
            data_deposito: dataDeposito ? new Date(dataDeposito) : new Date(),
            observacoes: observacoes,
            usuario_id: user.id,
        });

    if (insertError) {
        console.error('Erro ao registrar depósito na conciliação:', insertError);
        // Não lançamos erro aqui para não impedir o fluxo principal,
        // mas registramos o erro e avisamos o usuário (toast será exibido no frontend)
        throw new Error(
            'Depósito registrado no cofre, mas falha ao registrar na conciliação. Contate o suporte.'
        );
    }

    revalidatePath('/cofre');
    revalidatePath('/conciliacao');
    return { success: true };
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
