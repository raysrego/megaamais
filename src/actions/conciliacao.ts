'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Tipos ───
export interface ExtratoRegistro {
    conta_id: string;
    data_extrato: string; // YYYY-MM-DD
    depositos_confirmados: number;
    pix_ted_recebidos: number;
    debitos_pagamentos: number;
    tarifas_bancarias: number;
    outros_creditos?: number;
    outros_debitos?: number;
    saldo_extrato?: number;
}

export interface ConciliacaoExtrato {
    id: number;
    conta_id: string;
    conta_nome?: string;
    conta_banco?: string;
    data_extrato: string;
    depositos_confirmados: number;
    pix_ted_recebidos: number;
    debitos_pagamentos: number;
    tarifas_bancarias: number;
    saldo_extrato: number | null;
    depositos_sistema: number;
    pix_sistema: number;
    pagamentos_sistema: number;
    diferenca_depositos: number;
    diferenca_pix: number;
    diferenca_pagamentos: number;
    status: string;
    justificativa: string | null;
    tem_divergencia?: boolean;
    total_entradas_extrato?: number;
    total_saidas_extrato?: number;
    created_at: string;
    conciliado_at: string | null;
}

// ─── Registrar extrato do dia ───
export async function registrarExtratoDiario(dados: ExtratoRegistro) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');

    const { data, error } = await supabase.rpc('registrar_extrato_diario', {
        p_conta_id: dados.conta_id,
        p_data: dados.data_extrato,
        p_depositos_confirmados: dados.depositos_confirmados,
        p_pix_ted_recebidos: dados.pix_ted_recebidos,
        p_debitos_pagamentos: dados.debitos_pagamentos,
        p_tarifas_bancarias: dados.tarifas_bancarias,
        p_outros_creditos: dados.outros_creditos ?? 0,
        p_outros_debitos: dados.outros_debitos ?? 0,
        p_saldo_extrato: dados.saldo_extrato ?? null,
        p_usuario_id: user.id,
    });

    if (error) throw new Error(`Erro ao registrar extrato: ${error.message}`);

    revalidatePath('/conciliacao');
    return data;
}

// ─── Listar extratos por conta e período ───
export async function getExtratosConciliacao(
    contaId?: string,
    mesAno?: string // YYYY-MM
): Promise<ConciliacaoExtrato[]> {
    const supabase = await createClient();

    let query = supabase
        .from('vw_conciliacao_resumo_diario')
        .select('*')
        .order('data_extrato', { ascending: false });

    if (contaId) {
        query = query.eq('conta_id', contaId);
    }

    if (mesAno) {
        const [ano, mes] = mesAno.split('-');
        const inicio = `${ano}-${mes}-01`;
        const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
        const fim = `${ano}-${mes}-${ultimoDia}`;
        query = query.gte('data_extrato', inicio).lte('data_extrato', fim);
    }

    const { data, error } = await query.limit(62); // ~2 meses

    if (error) throw new Error(`Erro ao buscar extratos: ${error.message}`);
    return (data ?? []) as ConciliacaoExtrato[];
}

// ─── Justificar divergência ───
export async function justificarDivergencia(
    conciliacaoId: number,
    justificativa: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Não autenticado');

    const { data, error } = await supabase.rpc('justificar_conciliacao', {
        p_conciliacao_id: conciliacaoId,
        p_justificativa: justificativa,
        p_usuario_id: user.id,
    });

    if (error) throw new Error(`Erro ao justificar: ${error.message}`);

    revalidatePath('/conciliacao');
    return data;
}

// ─── Recalcular uma conciliação ───
export async function recalcularConciliacao(conciliacaoId: number) {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('recalcular_conciliacao', {
        p_conciliacao_id: conciliacaoId,
    });

    if (error) throw new Error(`Erro ao recalcular: ${error.message}`);

    revalidatePath('/conciliacao');
    return data;
}

// ─── Buscar depósitos do cofre para uma conta/período ───
export async function getDepositosCofre(
    contaId?: string,
    dataInicio?: string,
    dataFim?: string
) {
    const supabase = await createClient();

    let query = supabase
        .from('vw_cofre_depositos_rastreio')
        .select('*')
        .order('data_movimentacao', { ascending: false });

    if (contaId) {
        query = query.eq('conta_bancaria_id', contaId);
    }
    if (dataInicio) {
        query = query.gte('data_movimentacao', dataInicio);
    }
    if (dataFim) {
        query = query.lte('data_movimentacao', dataFim + 'T23:59:59');
    }

    const { data, error } = await query.limit(100);

    if (error) throw new Error(`Erro ao buscar depósitos: ${error.message}`);
    return data ?? [];
}

// ─── Buscar resumo de conciliação do período ───
export async function getResumoConciliacao(
    contaId: string,
    mesAno: string // YYYY-MM
) {
    const extratos = await getExtratosConciliacao(contaId, mesAno);

    const resumo = {
        total_conciliados: 0,
        total_divergentes: 0,
        total_pendentes: 0,
        total_justificados: 0,
        soma_depositos_extrato: 0,
        soma_depositos_sistema: 0,
        soma_pix_extrato: 0,
        soma_pix_sistema: 0,
        soma_pagamentos_extrato: 0,
        soma_pagamentos_sistema: 0,
        percentual_conciliado: 0,
    };

    const stats = extratos.reduce((acc, e) => {
        switch (e.status) {
            case 'conciliado': acc.total_conciliados++; break;
            case 'divergente': acc.total_divergentes++; break;
            case 'pendente': acc.total_pendentes++; break;
            case 'justificado': acc.total_justificados++; break;
        }
        acc.soma_depositos_extrato += e.depositos_confirmados;
        acc.soma_depositos_sistema += e.depositos_sistema;
        acc.soma_pix_extrato += e.pix_ted_recebidos;
        acc.soma_pix_sistema += e.pix_sistema;
        acc.soma_pagamentos_extrato += e.debitos_pagamentos;
        acc.soma_pagamentos_sistema += e.pagamentos_sistema;
        return acc;
    }, resumo);

    const total = extratos.length;
    if (total > 0) {
        stats.percentual_conciliado = Math.round(
            ((stats.total_conciliados + stats.total_justificados) / total) * 100
        );
    }

    return stats;
}
