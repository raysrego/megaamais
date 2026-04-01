'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

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

    // Verificar permissão e saldo (como antes)
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('empresa_id, acesso_empresas')
        .eq('id', user.id)
        .single();

    if (userError || !userData) throw new Error('Usuário não encontrado');

    const temAcesso = userData.empresa_id === filialId ||
                      (userData.acesso_empresas?.includes(filialId) === true);
    if (!temAcesso) throw new Error('Usuário não tem acesso a esta filial');

    // Verificar saldo (usando view ou consulta direta)
    const { data: saldoData, error: saldoError } = await supabase
        .from('cofre_saldo_atual')
        .select('saldo')
        .eq('loja_id', filialId)
        .maybeSingle();

    if (saldoError) throw new Error('Erro ao verificar saldo');
    const saldoAtual = saldoData?.saldo ?? 0;
    if (valor > saldoAtual) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${saldoAtual.toFixed(2)}`);
    }

    // Data do depósito (formato date)
    const depositDate = dataDeposito ? new Date(dataDeposito) : new Date();
    const depositDateString = depositDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // 1. Inserir na tabela cofre_movimentacoes
    const { error: movError } = await supabase
        .from('cofre_movimentacoes')
        .insert({
            tipo: 'saida_deposito',
            valor: valor,
            data_movimentacao: new Date().toISOString(),
            data_deposito: depositDate.toISOString(),
            operador_id: user.id,
            usuario_id: user.id,
            observacoes: observacoes || null,
            loja_id: filialId,
            status: 'concluido',
        });

    if (movError) {
        console.error('Erro ao inserir cofre_movimentacoes:', movError);
        throw new Error(`Erro ao registrar movimentação: ${movError.message}`);
    }

    // 2. Inserir na tabela depositos_conciliacao
    const { error: concError } = await supabase
        .from('depositos_conciliacao')
        .insert({
            loja_id: filialId,
            valor: valor,
            data_deposito: depositDateString,
            observacoes: observacoes,
            usuario_id: user.id,
        });

    if (concError) {
        console.error('Erro ao inserir depositos_conciliacao:', concError);
        // Se falhar, devemos reverter o primeiro insert? Por simplicidade, só logamos e lançamos erro.
        throw new Error('Depósito registrado no cofre, mas falha na conciliação.');
    }

    revalidatePath('/cofre');
    revalidatePath('/conciliacao');
    return { success: true };
}

// (mantenha as demais funções do arquivo: getEntradasCofrePorFechamento, getSaldoCofre, etc.)

// ─── Buscar entradas do cofre por fechamento aprovado ───
export async function getEntradasCofrePorFechamento(lojaId?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('cofre_entradas_por_fechamento')
        .select('*')
        .order('data_turno', { ascending: false })
        .limit(50);

    if (lojaId) {
        query = query.eq('loja_id', lojaId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro: ${error.message}`);
    return data ?? [];
}

// ─── Buscar saldo atual do cofre ───
export async function getSaldoCofre(lojaId?: string): Promise<number> {
    const supabase = await createClient();

    let query = supabase.from('cofre_saldo_atual').select('saldo');
    if (lojaId) {
        query = query.eq('loja_id', lojaId);
    }
    const { data, error } = await query.maybeSingle();

    if (error) return 0;
    return data?.saldo ?? 0;
}

// ─── Buscar histórico do cofre com rastreio ───
export async function getHistoricoCofre(limite: number = 30, lojaId?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('vw_cofre_movimentacoes_detalhadas')
        .select('*')
        .order('data_movimentacao', { ascending: false })
        .limit(limite);

    if (lojaId) {
        query = query.eq('loja_id', lojaId);
    }

    const { data, error } = await query;
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
