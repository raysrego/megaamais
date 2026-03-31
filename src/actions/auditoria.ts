'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Tipos ───
export interface FechamentoAuditoria {
    id: number;
    tipo: string;
    terminal_id: string;
    operador_id: string;
    operador_nome: string;
    data_turno: string;
    data_abertura: string;
    data_fechamento: string;
    valor_inicial: number;
    valor_final_calculado: number;
    resumo_entradas_pix: number;
    resumo_entradas_dinheiro: number;
    resumo_entradas_bolao_dinheiro: number;
    resumo_entradas_bolao_pix: number;
    resumo_saidas_sangria: number;
    resumo_saidas_deposito: number;
    resumo_saidas_boleto: number;
    resumo_saidas_trocados: number;
    resumo_total_entradas: number;
    resumo_total_saidas: number;
    dinheiro_em_maos: number;
    valor_enviado_cofre: number;
    pix_externo_informado: number;
    fundo_caixa_devolvido: boolean;
    saldo_esperado_dinheiro: number;
    diferenca_caixa: number;
    auditoria_status: string;
    auditoria_por: string | null;
    auditoria_data: string | null;
    auditoria_observacoes: string | null;
    observacoes_operador: string | null;
    cofre_confirmado: boolean;
    cofre_movimentacao_id: number | null;
    tem_fundo_caixa: boolean;
    loja_id: string | null;
}

// ─── Listar fechamentos para auditoria ───
export async function getFechamentosAuditoria(
    filtros?: {
        status?: string;
        dataInicio?: string;
        dataFim?: string;
        terminalId?: string;
        lojaId?: string;
    }
): Promise<FechamentoAuditoria[]> {
    const supabase = await createClient();

    let query = supabase
        .from('vw_auditoria_fechamentos')
        .select('*')
        .order('data_turno', { ascending: false })
        .order('data_fechamento', { ascending: false });

    if (filtros?.status && filtros.status !== 'todos') {
        query = query.eq('auditoria_status', filtros.status);
    }
    if (filtros?.dataInicio) {
        query = query.gte('data_turno', filtros.dataInicio);
    }
    if (filtros?.dataFim) {
        query = query.lte('data_turno', filtros.dataFim);
    }
    if (filtros?.terminalId) {
        query = query.eq('terminal_id', filtros.terminalId);
    }
    if (filtros?.lojaId) {
        query = query.eq('loja_id', filtros.lojaId);
    }

    const { data, error } = await query.limit(50);

    if (error) throw new Error(`Erro ao buscar fechamentos: ${error.message}`);
    return (data ?? []) as FechamentoAuditoria[];
}

// ─── Aprovar fechamento (cria entrada no cofre automaticamente) ───
export async function aprovarFechamento(
    sessaoId: number,
    observacoes?: string,
    contaBancariaId?: string  // NOVO: conta bancária padrão para depósito
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');

    // Se não informou conta bancária, busca a conta padrão
    let contaId = contaBancariaId;
    if (!contaId) {
        const { data: contaPadrao, error: contaError } = await supabase
            .from('financeiro_contas_bancarias')
            .select('id')
            .eq('is_padrao_pix', true)
            .maybeSingle();

        if (contaError) throw new Error(`Erro ao buscar conta padrão: ${contaError.message}`);
        if (contaPadrao) contaId = contaPadrao.id;
    }

    const { data, error } = await supabase.rpc('aprovar_fechamento_caixa', {
        p_sessao_id: sessaoId,
        p_gerente_id: user.id,
        p_observacoes: observacoes ?? null,
        p_conta_bancaria_id: contaId ?? null,
    });

    if (error) throw new Error(`Erro ao aprovar: ${error.message}`);

    const resultado = data as { success: boolean; error?: string };
    if (!resultado.success) {
        throw new Error(resultado.error || 'Erro desconhecido');
    }

    revalidatePath('/auditoria');
    revalidatePath('/cofre');
    revalidatePath('/conciliacao');
    return resultado;
}

// ─── Rejeitar fechamento ───
export async function rejeitarFechamento(
    sessaoId: number,
    observacoes: string,
    solicitarCorrecao: boolean = false
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');
    if (!observacoes.trim()) throw new Error('Observação obrigatória ao rejeitar');

    const { data, error } = await supabase.rpc('rejeitar_fechamento_caixa', {
        p_sessao_id: sessaoId,
        p_gerente_id: user.id,
        p_observacoes: observacoes,
        p_solicitar_correcao: solicitarCorrecao,
    });

    if (error) throw new Error(`Erro ao rejeitar: ${error.message}`);

    const resultado = data as { success: boolean; error?: string };
    if (!resultado.success) {
        throw new Error(resultado.error || 'Erro desconhecido');
    }

    revalidatePath('/auditoria');
    return resultado;
}

// ─── Buscar movimentações detalhadas de uma sessão ───
export async function getMovimentacoesSessao(sessaoId: number) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .eq('sessao_id', sessaoId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Erro ao buscar movimentações: ${error.message}`);
    return data ?? [];
}

// ─── Resumo de auditoria para KPIs ───
export async function getResumoAuditoria(lojaId?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('vw_auditoria_fechamentos')
        .select('auditoria_status, diferenca_caixa');

    if (lojaId) {
        query = query.eq('loja_id', lojaId);
    }

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    query = query.gte('data_turno', seteDiasAtras.toISOString().split('T')[0]);

    const { data, error } = await query;

    if (error) throw new Error(`Erro: ${error.message}`);

    const resumo = {
        pendentes: 0,
        aprovados: 0,
        rejeitados: 0,
        correcao_solicitada: 0,
        total_diferenca: 0,
        total: 0,
    };

    for (const item of data ?? []) {
        resumo.total++;
        switch (item.auditoria_status) {
            case 'pendente': resumo.pendentes++; break;
            case 'aprovado': resumo.aprovados++; break;
            case 'rejeitado': resumo.rejeitados++; break;
            case 'correcao_solicitada': resumo.correcao_solicitada++; break;
        }
        resumo.total_diferenca += Math.abs(item.diferenca_caixa || 0);
    }

    return resumo;
}

// ─── Registrar depósito bancário a partir do cofre ───
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
