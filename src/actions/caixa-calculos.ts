'use server';

import { createClient } from '@/lib/supabase';

/**
 * Calcula o total de PIX lançado manualmente (outras chaves, não do TFL)
 * @param sessao_id ID da sessão de caixa
 * @returns Total de PIX manual
 */
export async function getTotalPixManual(sessao_id: number): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .select('valor')
        .eq('sessao_id', sessao_id)
        .eq('tipo', 'pix');

    if (error) {
        console.error('Erro ao buscar PIX manual:', error);
        return 0;
    }

    const total = data.reduce((sum: number, mov: { valor: number }) => sum + (mov.valor || 0), 0);
    return total;
}

/**
 * Calcula totais de sangrias para uma sessão
 * @param sessao_id ID da sessão de caixa
 * @returns Total de sangrias
 */
export async function getTotalSangrias(sessao_id: number): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .select('valor')
        .eq('sessao_id', sessao_id)
        .eq('tipo', 'sangria');

    if (error) {
        console.error('Erro ao buscar sangrias:', error);
        return 0;
    }

    const total = data.reduce((sum: number, mov: { valor: number }) => sum + (mov.valor || 0), 0);
    return total;
}

/**
 * Calcula totais de depósitos em outras filiais
 * @param sessao_id ID da sessão de caixa
 * @returns Total de depósitos
 */
export async function getTotalDepositos(sessao_id: number): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .select('valor')
        .eq('sessao_id', sessao_id)
        .eq('tipo', 'deposito');

    if (error) {
        console.error('Erro ao buscar depósitos:', error);
        return 0;
    }

    const total = data.reduce((sum: number, mov: { valor: number }) => sum + (mov.valor || 0), 0);
    return total;
}

/**
 * Calcula o saldo líquido final
 * Fórmula: Saldo TFL - PIX TFL - PIX Manual - Sangrias - Depósitos
 */
export async function calcularSaldoLiquido(params: {
    saldoTFL: number;
    pixTFL: number;
    pixManual: number;
    sangrias: number;
    depositos: number;
}): Promise<number> {
    const { saldoTFL, pixTFL, pixManual, sangrias, depositos } = params;

    const saldoLiquido = saldoTFL - pixTFL - pixManual - sangrias - depositos;

    return saldoLiquido;
}

/**
 * Atualiza a sessão de caixa com os dados de fechamento
 */
export async function atualizarFechamentoCaixa(params: {
    sessao_id: number;
    tfl_pix_total: number;
    total_pix_manual: number;
    total_sangrias: number;
    total_depositos_filial: number;
    saldo_liquido_final: number;
    justificativa?: string;
}) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('caixa_sessoes')
        .update({
            tfl_pix_total: params.tfl_pix_total,
            total_pix_manual: params.total_pix_manual,
            total_sangrias: params.total_sangrias,
            total_depositos_filial: params.total_depositos_filial,
            saldo_liquido_final: params.saldo_liquido_final,
            observacoes: params.justificativa,
            status: 'fechado',
            status_validacao: 'pendente', // Aguardando validação do gerente
            data_fechamento: new Date().toISOString()
        })
        .eq('id', params.sessao_id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}
