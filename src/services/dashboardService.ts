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
    // 1. Dados Consolidados da View (Multi-filial)
    const { data: nomeData, error: nomeError } = await supabase.from('empresas').select('nome_fantasia').eq('id', lojaId).single();
    if (nomeError) console.error('[KPI] Erro ao buscar nome da loja:', nomeError);


    const { data: consolidado, error: viewError } = await supabase
        .from('vw_dashboard_consolidado')
        .select('*')
        .eq('filial', nomeData?.nome_fantasia);

    if (viewError) console.error('[KPI] Erro na View Consolidada:', viewError);

    const resumo = consolidado?.[0] || { vendas_jogos: 0, vendas_boloes: 0, premios_pagos: 0, resultado_liquido: 0 };

    // 2. Lucro Real de Bolões (calculado com base nos bolões vendidos)
    const { data: boloesData } = await supabase
        .from('boloes')
        .select('valor_cota_base, preco_venda_cota, cotas_vendidas, loja_id')
        .eq('loja_id', lojaId)
        .gte('created_at', new Date().toISOString().split('T')[0]); // Bolões de hoje

    // Calcular lucro real: (PrecoVenda - ValorBase) * CotasVendidas para cada bolão
    const lucroRealBoloes = (boloesData || []).reduce((acc, bolao) => {
        const comissaoPorCota = Number(bolao.preco_venda_cota) - Number(bolao.valor_cota_base);
        const lucroTotal = comissaoPorCota * Number(bolao.cotas_vendidas);
        return acc + lucroTotal;
    }, 0);

    // 3. Terminais (Contagem Real)
    const { count: totalTerminais } = await supabase
        .from('terminais')
        .select('*', { count: 'exact', head: true })
        .eq('loja_id', lojaId);

    const { count: ativosTerminais } = await supabase
        .from('caixa_sessoes')
        .select('*', { count: 'exact', head: true })
        .eq('loja_id', lojaId)
        .eq('status', 'aberto');

    // 4. Quebras Hoje
    const { data: quebras } = await supabase
        .from('caixa_sessoes')
        .select('diferenca_quebra')
        .eq('loja_id', lojaId)
        .eq('status', 'fechado')
        .gte('created_at', new Date().toISOString().split('T')[0]);

    const quebrasTotal = (quebras || []).reduce((acc, q) => acc + Math.abs(Number(q.diferenca_quebra)), 0);

    // 5. Saldos (Cofre e Bancos)
    const { data: saldoCofreView } = await supabase.from('cofre_saldo_atual').select('saldo').single();
    const { data: saldoBancosData } = await supabase.from('financeiro_contas_bancarias').select('saldo_atual').eq('loja_id', lojaId);

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
    // Definir intervalo de 7 dias
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Inclui hoje
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('financeiro_contas')
        .select('valor, tipo, data_pagamento')
        .eq('loja_id', lojaId)
        .eq('status', 'pago') // Apenas concretizados
        .gte('data_pagamento', startDate);

    if (error) {
        console.error('Erro ao buscar fluxo semanal:', error);
        return [];
    }

    // Inicializar mapa dos últimos 7 dias
    const daysMap = new Map<string, { dia: string, entradas: number, saidas: number, sortDate: string }>();

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

    // Preencher com dados
    data?.forEach(t => {
        // data_pagamento pode vir com hora ou só data, pegar só data YYYY-MM-DD
        const dateKey = t.data_pagamento ? t.data_pagamento.split('T')[0] : '';
        const entry = daysMap.get(dateKey);
        if (entry) {
            if (t.tipo === 'receita') entry.entradas += t.valor;
            if (t.tipo === 'despesa') entry.saidas += t.valor;
        }
    });

    return Array.from(daysMap.values()).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
};

export const getConsolidadoFiliais = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase
        .from('vw_dashboard_consolidado')
        .select('*')
        .order('filial', { ascending: true });

    if (error) {
        console.error('Erro ao buscar consolidado de filiais:', error);
        return [];
    }

    return data || [];
};
