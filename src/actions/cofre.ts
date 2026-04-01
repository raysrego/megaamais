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

    // 1. Verificar se a filial existe
    const { data: loja, error: lojaError } = await supabase
        .from('empresas')
        .select('id')
        .eq('id', filialId)
        .single();

    if (lojaError || !loja) {
        console.error('Filial não encontrada:', filialId, lojaError);
        throw new Error('Filial não encontrada');
    }

    // 2. Verificar permissão do usuário na filial
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('empresa_id, acesso_empresas')
        .eq('id', user.id)
        .single();

    if (userError || !userData) {
        console.error('Usuário não encontrado:', userError);
        throw new Error('Usuário não encontrado');
    }

    const temAcesso = userData.empresa_id === filialId ||
                      (userData.acesso_empresas?.includes(filialId) === true);
    if (!temAcesso) {
        console.error('Usuário sem acesso à filial:', { userId: user.id, filialId });
        throw new Error('Usuário não tem acesso a esta filial');
    }

    // 3. Verificar saldo disponível
    const { data: saldoData, error: saldoError } = await supabase
        .from('cofre_saldo_atual')
        .select('saldo')
        .eq('loja_id', filialId)
        .maybeSingle(); // Evita erro se não houver registro

    if (saldoError) {
        console.error('Erro ao buscar saldo:', saldoError);
        throw new Error('Erro ao verificar saldo');
    }

    const saldoAtual = saldoData?.saldo ?? 0;
    if (valor > saldoAtual) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${saldoAtual.toFixed(2)}`);
    }

    // 4. Preparar data de depósito
    let dataDepositoDate: Date;
    if (dataDeposito) {
        dataDepositoDate = new Date(dataDeposito);
        if (isNaN(dataDepositoDate.getTime())) {
            throw new Error('Data de depósito inválida');
        }
    } else {
        dataDepositoDate = new Date();
    }

    // 5. Inserir movimentação
    const insertData = {
        tipo: 'saida_deposito',
        valor: valor,
        data_movimentacao: new Date().toISOString(),
        data_deposito: dataDepositoDate.toISOString(),
        operador_id: user.id,
        usuario_id: user.id,
        observacoes: observacoes || null,
        loja_id: filialId,
        status: 'concluido',
    };

    console.log('Inserindo cofre_movimentacoes:', insertData);

    const { data, error } = await supabase
        .from('cofre_movimentacoes')
        .insert(insertData)
        .select();

    if (error) {
        console.error('Erro detalhado ao inserir cofre_movimentacoes:', error);
        throw new Error(`Erro ao registrar movimentação: ${error.message}`);
    }

    revalidatePath('/cofre');
    return { success: true };
}

// (mantenha as demais funções do arquivo: getEntradasCofrePorFechamento, getSaldoCofre, etc.)

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
