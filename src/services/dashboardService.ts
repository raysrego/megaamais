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
    
    // 1. Buscar nome da loja (necessário para filtrar a view)
    const { data: nomeData, error: nomeError } = await supabase
        .from('empresas')
        .select('nome_fantasia')
        .eq('id', lojaId)
        .single();
    
    if (nomeError) {
        console.error('[KPI] Erro ao buscar nome da loja:', nomeError);
    } else {
        console.log('[KPI] Nome da loja encontrado:', nomeData?.nome_fantasia);
    }

    // 2. Dados Consolidados da View (Multi-filial)
    let resumo = { vendas_jogos: 0, vendas_boloes: 0, premios_pagos: 0, resultado_liquido: 0 };
    if (nomeData?.nome_fantasia) {
        const { data: consolidado, error: viewError } = await supabase
            .from('vw_dashboard_consolidado')
            .select('*')
            .eq('filial', nomeData.nome_fantasia);
        
        if (viewError) {
            console.error('[KPI] Erro na View Consolidada:', viewError);
        } else {
            console.log('[KPI] Dados da view consolidada:', consolidado);
            if (consolidado && consolidado.length > 0) {
                resumo = consolidado[0];
            } else {
                console.warn('[KPI] Nenhum dado encontrado na view para a filial:', nomeData.nome_fantasia);
            }
        }
    } else {
        console.warn('[KPI] Não foi possível obter o nome da loja, pulando consulta à view');
    }

    // 3. Lucro Real de Bolões (calculado com base nos bolões vendidos hoje)
    const hoje = new Date().toISOString().split('T')[0];
    console.log('[KPI] Buscando bolões de hoje:', hoje);
    const { data: boloesData, error: boloesError } = await supabase
        .from('boloes')
        .select('valor_cota_base, preco_venda_cota, cotas_vendidas, loja_id')
        .eq('loja_id', lojaId)
        .gte('created_at', hoje);
    
    if (boloesError) {
        console.error('[KPI] Erro ao buscar bolões:', boloesError);
    } else {
        console.log('[KPI] Bolões encontrados hoje:', boloesData?.length || 0);
    }

    const lucroRealBoloes = (boloesData || []).reduce((acc, bolao) => {
        const comissaoPorCota = Number(bolao.preco_venda_cota) - Number(bolao.valor_cota_base);
        const lucroTotal = comissaoPorCota * Number(bolao.cotas_vendidas);
        return acc + lucroTotal;
    }, 0);
    console.log('[KPI] Lucro real bolões calculado:', lucroRealBoloes);

    // 4. Terminais (Contagem Real)
    console.log('[KPI] Contando terminais totais para loja:', lojaId);
    const { count: totalTerminais, error: totalTermError } = await supabase
        .from('terminais')
        .select('*', { count: 'exact', head: true })
        .eq('loja_id', lojaId);
    
    if (totalTermError) {
        console.error('[KPI] Erro ao contar terminais totais:', totalTermError);
    }
    console.log('[KPI] Total terminais:', totalTerminais);

    console.log('[KPI] Contando terminais ativos via sessões abertas');
    const { count: ativosTerminais, error: ativosError } = await supabase
        .from('caixa_sessoes')
        .select('*', { count: 'exact', head: true })
        .eq('loja_id', lojaId)
        .eq('status', 'aberto');
    
    if (ativosError) {
        console.error('[KPI] Erro ao contar terminais ativos:', ativosError);
    }
    console.log('[KPI] Terminais ativos:', ativosTerminais);

    // 5. Quebras Hoje
    console.log('[KPI] Buscando quebras de hoje');
    const { data: quebras, error: quebrasError } = await supabase
        .from('caixa_sessoes')
        .select('diferenca_quebra')
        .eq('loja_id', lojaId)
        .eq('status', 'fechado')
        .gte('created_at', hoje);
    
    if (quebrasError) {
        console.error('[KPI] Erro ao buscar quebras:', quebrasError);
    }
    const quebrasTotal = (quebras || []).reduce((acc, q) => acc + Math.abs(Number(q.diferenca_quebra)), 0);
    console.log('[KPI] Total quebras hoje:', quebrasTotal);

    // 6. Saldo do Cofre
    console.log('[KPI] Buscando saldo do cofre');
    const { data: saldoCofreView, error: cofreError } = await supabase
        .from('cofre_saldo_atual')
        .select('saldo')
        .maybeSingle();
    
    if (cofreError) {
        console.error('[KPI] Erro ao buscar saldo do cofre:', cofreError);
    }
    console.log('[KPI] Saldo cofre:', saldoCofreView?.saldo);

    // 7. Saldo em Bancos
    console.log('[KPI] Buscando saldo bancário para loja:', lojaId);
    const { data: saldoBancosData, error: bancosError } = await supabase
        .from('financeiro_contas_bancarias')
        .select('saldo_atual')
        .eq('loja_id', lojaId);
    
    if (bancosError) {
        console.error('[KPI] Erro ao buscar saldo bancário:', bancosError);
    }
    const saldoBancosTotal = (saldoBancosData || []).reduce((acc, b) => acc + Number(b.saldo_atual), 0);
    console.log('[KPI] Saldo bancos total:', saldoBancosTotal);

    const result = {
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
    console.log('[KPI] Resultado final:', result);
    return result;
};

export const getFluxoSemanal = async (supabase: SupabaseClient, lojaId: string) => {
    console.log('[Fluxo] Iniciando para loja:', lojaId);
    // Definir intervalo de 7 dias
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Inclui hoje
    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    console.log('[Fluxo] Buscando de', startDate, 'até hoje');

    const { data, error } = await supabase
        .from('financeiro_contas')
        .select('valor, tipo, data_pagamento')
        .eq('loja_id', lojaId)
        .eq('status', 'pago') // Apenas concretizados
        .gte('data_pagamento', startDate);

    if (error) {
        console.error('[Fluxo] Erro ao buscar:', error);
        return [];
    }
    console.log('[Fluxo] Registros encontrados:', data?.length);

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
        const dateKey = t.data_pagamento ? t.data_pagamento.split('T')[0] : '';
        const entry = daysMap.get(dateKey);
        if (entry) {
            if (t.tipo === 'receita') entry.entradas += t.valor;
            if (t.tipo === 'despesa') entry.saidas += t.valor;
        }
    });

    const result = Array.from(daysMap.values()).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    console.log('[Fluxo] Resultado final:', result);
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
    console.log('[Consolidado] Dados encontrados:', data?.length);
    return data || [];
};
