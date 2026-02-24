'use server';

import { createClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export interface PerformanceOperador {
    operadorId: string;
    operadorNome: string;
    lojaId: string;
    filialNome: string;
    qtdVendas: number;
    totalVendasBruto: number;
    comissaoTotalGerada: number;
    parteCasa70: number;
    partePool30: number;
    tierAtingido: number;
    premioAReceber: number;
    proximaMetaValor: number | null;
    faltaParaProximaMeta: number;
}

export interface HistoricoVenda {
    id: number;
    dataHora: string;
    bolao: string;
    concurso: string;
    valor: number;
    comissaoGerada: number;
}

/**
 * Busca a performance do operador logado (ou específico se passado ID)
 */
export async function getPerformanceOperador(operadorId?: string): Promise<PerformanceOperador | null> {
    const supabase = await createClient();

    // Se não passar ID, pega do usuário logado
    let targetId = operadorId;
    if (!targetId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        targetId = user.id;
    }

    const { data, error } = await supabase
        .from('vw_performance_operadores')
        .select('*')
        .eq('operador_id', targetId)
        .single();

    if (error) {
        console.error('Erro ao buscar performance do operador:', error);
        return null;
    }

    return {
        operadorId: data.operador_id,
        operadorNome: data.operador_nome,
        lojaId: data.loja_id,
        filialNome: data.filial_nome,
        qtdVendas: data.qtd_vendas,
        totalVendasBruto: Number(data.total_vendas_bruto),
        comissaoTotalGerada: Number(data.comissao_total_gerada),
        parteCasa70: Number(data.parte_casa_70),
        partePool30: Number(data.parte_pool_30),
        tierAtingido: data.tier_atingido,
        premioAReceber: Number(data.premio_a_receber),
        proximaMetaValor: data.proxima_meta_valor ? Number(data.proxima_meta_valor) : null,
        faltaParaProximaMeta: Number(data.falta_para_proxima_meta)
    };
}

/**
 * Busca as vendas do operador (Histórico)
 * Se dataFiltro for informada, busca daquele dia. Senão, busca as últimas (limit).
 */
export async function getUltimasVendasOperador(limit: number = 20, dataFiltro?: string): Promise<HistoricoVenda[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    let query = supabase
        .from('vendas_boloes')
        .select(`
            id,
            created_at,
            valor_total,
            boloes (
                nome,
                concurso,
                preco_venda_cota,
                valor_cota_base
            )
        `)
        .eq('usuario_id', user.id);

    // Filtro de Data Específica
    if (dataFiltro) {
        query = query
            .gte('created_at', `${dataFiltro}T00:00:00`)
            .lte('created_at', `${dataFiltro}T23:59:59`);
    } else {
        // Se não tem data, limita para não sobrecarregar
        query = query.limit(limit);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar vendas:', error);
        return [];
    }

    return data.map((v: any) => {
        // Recalcular comissão unitária aqui para exibir
        const lucroPorCota = (v.boloes?.preco_venda_cota || 0) - (v.boloes?.valor_cota_base || 0);
        // Assumindo que venda.valor_total = qtd * preco_venda. Então qtd = valor_total / preco_venda
        const precoVenda = v.boloes?.preco_venda_cota || 1;
        const qtdCotas = v.valor_total / precoVenda;
        const lucroTotal = lucroPorCota * qtdCotas;
        const comissaoPool = lucroTotal * 0.30; // 30% pro pool

        return {
            id: v.id,
            dataHora: v.created_at,
            bolao: v.boloes?.nome || 'Bolão',
            concurso: v.boloes?.concurso || '-',
            valor: Number(v.valor_total),
            comissaoGerada: comissaoPool
        };
    });
}

/**
 * Busca a performance de toda a equipe (Para Gerentes/Admins)
 * Pode filtrar por loja
 */
export async function getPerformanceEquipe(lojaId?: string): Promise<PerformanceOperador[]> {
    const supabase = await createClient();

    let query = supabase
        .from('vw_performance_operadores')
        .select('*');

    if (lojaId) {
        query = query.eq('loja_id', lojaId);
    }

    const { data, error } = await query.order('total_vendas_bruto', { ascending: false });

    if (error) {
        console.error('Erro ao buscar performance da equipe:', error);
        return [];
    }

    return (data || []).map(item => ({
        operadorId: item.operador_id,
        operadorNome: item.operador_nome,
        lojaId: item.loja_id,
        filialNome: item.filial_nome,
        qtdVendas: item.qtd_vendas,
        totalVendasBruto: Number(item.total_vendas_bruto),
        comissaoTotalGerada: Number(item.comissao_total_gerada),
        parteCasa70: Number(item.parte_casa_70),
        partePool30: Number(item.parte_pool_30),
        tierAtingido: item.tier_atingido,
        premioAReceber: Number(item.premio_a_receber),
        proximaMetaValor: item.proxima_meta_valor ? Number(item.proxima_meta_valor) : null,
        faltaParaProximaMeta: Number(item.falta_para_proxima_meta)
    }));
}
