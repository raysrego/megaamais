'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Tipos ───
export interface FechamentoAuditoria {
    id: number;
    data_turno: string;
    data_fechamento: string;
    terminal_id: string;
    operador_id: string;
    operador_nome: string;
    valor_inicial: number;
    resumo_total_entradas: number;
    valor_enviado_cofre: number;
    pix_externo_informado: number;
    // ... outros campos conforme necessário
}

// ─── Buscar fechamentos para auditoria com filtros ───
export async function getFechamentosAuditoria(filters?: {
    status?: string;
    dataInicio?: string;
    dataFim?: string;
}) {
    const supabase = await createClient();

    let query = supabase
        .from('caixa_sessoes')
        .select('*')
        .order('data_turno', { ascending: false });

    if (filters?.status) {
        query = query.eq('auditoria_status', filters.status);
    }
    if (filters?.dataInicio) {
        query = query.gte('data_turno', filters.dataInicio);
    }
    if (filters?.dataFim) {
        query = query.lte('data_turno', filters.dataFim);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao buscar fechamentos:', error);
        throw new Error(`Erro ao buscar fechamentos: ${error.message}`);
    }

    return data ?? [];
}

// ─── Aprovar fechamento e atualizar valor_para_conciliacao ───
export async function aprovarFechamento(sessaoId: number, observacoes?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');

    // Buscar dados necessários para calcular valor_para_conciliacao
    const { data: sessao, error: fetchError } = await supabase
        .from('caixa_sessoes')
        .select('resumo_total_entradas, valor_enviado_cofre')
        .eq('id', sessaoId)
        .single();

    if (fetchError || !sessao) {
        console.error('Erro ao buscar fechamento:', fetchError);
        throw new Error('Fechamento não encontrado');
    }

    const valorConciliacao = (sessao.resumo_total_entradas || 0) - (sessao.valor_enviado_cofre || 0);

    // Atualizar status e valor_para_conciliacao
    const { error: updateError } = await supabase
        .from('caixa_sessoes')
        .update({
            auditoria_status: 'aprovado',
            auditoria_por: user.id,
            auditoria_data: new Date().toISOString(),
            auditoria_observacoes: observacoes,
            valor_para_conciliacao: valorConciliacao,
            updated_at: new Date().toISOString(),
        })
        .eq('id', sessaoId);

    if (updateError) {
        console.error('Erro ao aprovar fechamento:', updateError);
        throw new Error(`Erro ao aprovar: ${updateError.message}`);
    }

    // Revalidar páginas afetadas
    revalidatePath('/auditoria');
    revalidatePath('/conciliacao');

    return { success: true };
}

// ─── Rejeitar fechamento ───
export async function rejeitarFechamento(
    sessaoId: number,
    justificativa: string,
    corrigir?: boolean
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');

    const novoStatus = corrigir ? 'correcao_solicitada' : 'rejeitado';

    const { error } = await supabase
        .from('caixa_sessoes')
        .update({
            auditoria_status: novoStatus,
            auditoria_por: user.id,
            auditoria_data: new Date().toISOString(),
            auditoria_observacoes: justificativa,
            updated_at: new Date().toISOString(),
        })
        .eq('id', sessaoId);

    if (error) {
        console.error('Erro ao rejeitar fechamento:', error);
        throw new Error(`Erro ao rejeitar: ${error.message}`);
    }

    revalidatePath('/auditoria');

    return { success: true };
}

// ─── Buscar movimentações de uma sessão (para detalhes) ───
export async function getMovimentacoesSessao(sessaoId: number) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erro ao buscar movimentações:', error);
        throw new Error(`Erro ao buscar movimentações: ${error.message}`);
    }

    return data ?? [];
}
