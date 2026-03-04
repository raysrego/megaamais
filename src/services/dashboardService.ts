import { SupabaseClient } from '@supabase/supabase-js';
import { FINANCIAL_RULES } from '@/lib/financial-constants';

export interface DashboardKPIs {
    faturamentoHoje: number;
    vendasJogos: number;
    vendasBoloes: number;
    lucroBoloes: number;
    terminaisAtivos: number;
    terminaisTotal: number;
    caixasAbertos: number;
    quebrasHoje: number;
    saldoCofre: number;
    saldoBancos: number;
}

export const getDashboardKPIs = async (supabase: SupabaseClient, lojaId: string): Promise<DashboardKPIs> => {
    console.log('[KPI] Iniciando busca para loja:', lojaId);

    // 1. Buscar nome da loja
    const { data: nomeData, error: nomeError } = await supabase
        .from('empresas')
        .select('nome_fantasia')
        .eq('id', lojaId)
        .single();

    if (nomeError) {
        console.error('[KPI] Erro ao buscar nome da loja:', nomeError);
    }

    // 2. Dados da view consolidada (já corrigida)
    let resumo = { vendas_jogos: 0, vendas_boloes: 0, premios_pagos: 0, resultado_liquido: 0 };
    if (nomeData?.nome_fantasia) {
        const { data: consolidado, error: viewError } = await supabase
            .from('vw_dashboard_consolidado')
            .select('*')
            .eq('filial', nomeData.nome_fantasia);

        if (viewError) {
            console.error('[KPI] Erro na view:', viewError);
        } else if (consolidado && consolidado.length > 0) {
            resumo = consolidado[0];
        }
    }

    // 3. Lucro real de bolões (hoje)
    const hoje = new Date().toISOString().split('T')[0];
    const { data: boloesData } = await supabase
        .from('boloes')
        .select('valor_cota_base, preco_venda_cota, cotas_vendidas')
        .eq('loja_id', lojaId)
        .gte('created_at', hoje);

    const lucroRealBoloes = (boloesData || []).reduce((acc, bolao) => {
        const comissaoPorCota = Number(bolao.preco_venda_cota) - Number(bolao.valor_cota_base);
        return acc + comissaoPorCota * Number(bolao.cotas_vendidas);
    }, 0);

    // 4. Terminais
    const { count: totalTerminais } = await supabase
        .from('terminais')
        .select('*', { count: 'exact', head: true })
        .eq('loja_id', lojaId);

    const { count: ativosTerminais } = await supabase
        .from('caixa_sessoes')
        .select('*', { count: 'exact', head: true })
        .eq('loja_id', lojaId)
        .eq('status', 'aberto');

    // 5. Quebras
    const { data: quebras } = await supabase
        .from('caixa_sessoes')
        .select('diferenca_quebra')
        .eq('loja_id', lojaId)
        .eq('status', 'fechado')
        .gte('created_at', hoje);

    const quebrasTotal = (quebras || []).reduce((acc, q) => acc + Math.abs(Number(q.diferenca_quebra)), 0);

    // 6. Saldo do cofre (mesma view usada pelo hook useCofre)
    const { data: saldoCofreView } = await supabase
        .from('cofre_saldo_atual')
        .select('saldo')
        .maybeSingle();

    // 7. Saldo bancário
    const { data: saldoBancosData } = await supabase
        .from('financeiro_contas_bancarias')
        .select('saldo_atual')
        .eq('loja_id', lojaId);

    const saldoBancosTotal = (saldoBancosData || []).reduce((acc, b) => acc + Number(b.saldo_atual), 0);

    return {
        faturamentoHoje: Number(resumo.vendas_jogos) + Number(resumo.vendas_boloes),
        vendasJogos: Number(resumo.vendas_jogos),
        vendasBoloes: Number(resumo.vendas_boloes),
        lucroBoloes: lucroRealBoloes,
        terminaisAtivos: ativosTerminais || 0,
        terminaisTotal: totalTerminais || 0,
        caixasAbertos: ativosTerminais || 0,
        quebrasHoje: quebrasTotal,
        saldoCofre: Number(saldoCofreView?.saldo || 0),
        saldoBancos: saldoBancosTotal
    };
};

export const getFluxoSemanal = async (supabase: SupabaseClient, lojaId: string) => {
    console.log('[Fluxo] Iniciando para loja:', lojaId);
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('financeiro_contas')
        .select('valor, tipo, data_pagamento')
        .eq('loja_id', lojaId)
        .eq('status', 'pago')
        .gte('data_pagamento', startDate);

    if (error) {
        console.error('[Fluxo] Erro:', error);
        return [];
    }

    const daysMap = new Map<string, { dia: string; entradas: number; saidas: number; sortDate: string }>();
    for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
        daysMap.set(dateStr, {
            dia: dayName.charAt(0).toUpperCase() + dayName.slice(1),
            entradas: 0,
            saidas: 0,
            sortDate: dateStr
        });
    }

    data?.forEach(t => {
        const dateKey = t.data_pagamento ? t.data_pagamento.split('T')[0] : '';
        const entry = daysMap.get(dateKey);
        if (entry) {
            if (t.tipo === 'receita') entry.entradas += t.valor;
            if (t.tipo === 'despesa') entry.saidas += t.valor;
        }
    });

    const result = Array.from(daysMap.values()).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    console.log('[Fluxo] Resultado:', result);
    return result;
};

export const getConsolidadoFiliais = async (supabase: SupabaseClient) => {
    console.log('[Consolidado] Buscando dados da view');
    const { data, error } = await supabase
        .from('vw_dashboard_consolidado')
        .select('*')
        .order('filial', { ascending: true });

    if (error) {
        console.error('[Consolidado] Erro:', error);
        return [];
    }
    console.log('[Consolidado] Dados:', data);
    return data || [];
};

