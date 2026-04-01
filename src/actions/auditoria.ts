'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function aprovarFechamento(sessaoId: number, observacoes?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');

    // Buscar dados da sessão (incluindo loja_id e valor_enviado_cofre)
    const { data: sessao, error: fetchError } = await supabase
        .from('caixa_sessoes')
        .select('resumo_total_entradas, valor_enviado_cofre, loja_id, data_turno')
        .eq('id', sessaoId)
        .single();

    if (fetchError || !sessao) throw new Error('Fechamento não encontrado');

    // 1. Calcular valor líquido para conciliação
    const valorConciliacao = (sessao.resumo_total_entradas || 0) - (sessao.valor_enviado_cofre || 0);

    // 2. Registrar entrada no cofre (se houver valor a ser depositado)
    if (sessao.valor_enviado_cofre && sessao.valor_enviado_cofre > 0) {
        const { error: cofreError } = await supabase
            .from('cofre_movimentacoes')
            .insert({
                tipo: 'entrada_fechamento',
                valor: sessao.valor_enviado_cofre,
                data_movimentacao: new Date().toISOString(),
                operador_id: user.id,        // auditor que aprova
                usuario_id: user.id,
                loja_id: sessao.loja_id,
                origem_sessao_id: sessaoId,
                observacoes: `Entrada referente ao fechamento do turno ${sessao.data_turno}`,
                status: 'concluido'
            });

        if (cofreError) {
            console.error('Erro ao registrar entrada no cofre:', cofreError);
            throw new Error(`Erro ao atualizar cofre: ${cofreError.message}`);
        }
    }

    // 3. Atualizar status da sessão e campo de conciliação
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

    if (updateError) throw new Error(`Erro ao aprovar: ${updateError.message}`);

    // Revalidar páginas afetadas
    revalidatePath('/auditoria');
    revalidatePath('/cofre');
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
