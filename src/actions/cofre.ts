'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Registrar depósito bancário a partir do cofre (vinculado à filial) ───
export async function registrarDepositoCofre(
    valor: number,
    filialId: string,
    observacoes?: string,
    dataDeposito?: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');
    if (valor <= 0) throw new Error('Valor deve ser positivo');

    // Verificar permissão do usuário na filial
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('empresa_id, acesso_empresas')
        .eq('id', user.id)
        .single();

    if (userError || !userData) throw new Error('Usuário não encontrado');

    const temAcesso = userData.empresa_id === filialId ||
                      (userData.acesso_empresas?.includes(filialId) === true);
    if (!temAcesso) throw new Error('Usuário não tem acesso a esta filial');

    // Verificar saldo disponível
    const { data: saldoData } = await supabase
        .from('cofre_saldo_atual')
        .select('saldo')
        .eq('loja_id', filialId)
        .single();

    const saldoAtual = saldoData?.saldo ?? 0;
    if (valor > saldoAtual) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${saldoAtual.toFixed(2)}`);
    }

    // Registrar a movimentação no cofre (tipo 'saida_deposito')
    const { data: mov, error: movError } = await supabase
        .from('cofre_movimentacoes')
        .insert({
            tipo: 'saida_deposito',
            valor: valor,
            data_movimentacao: new Date().toISOString(),
            data_deposito: dataDeposito || new Date().toISOString().split('T')[0],
            operador_id: user.id,
            usuario_id: user.id,
            observacoes: observacoes,
            loja_id: filialId,
            status: 'concluido',
        })
        .select('id')
        .single();

    if (movError) {
        console.error('Erro ao inserir cofre_movimentacoes:', movError);
        throw new Error(`Erro ao registrar movimentação: ${movError.message}`);
    }

    revalidatePath('/cofre');
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
