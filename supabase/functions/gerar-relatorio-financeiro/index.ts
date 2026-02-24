import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/database.ts';

interface RelatorioFinanceiroParams {
    ano: number;
    mes?: number; // 0 = ano todo
    loja_id?: string | null;
}

serve(async (req: Request) => {
    // CORS preflight
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        // Validar autenticação
        const supabase = createSupabaseClient(req);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Não autenticado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Parse dos parâmetros
        const params: RelatorioFinanceiroParams = await req.json();
        const { ano, mes = 0, loja_id } = params;

        // Definir período
        let startDate: string;
        let endDate: string;

        if (mes === 0) {
            // Ano todo
            startDate = `${ano}-01-01`;
            endDate = `${ano}-12-31`;
        } else {
            // Mês específico
            const start = new Date(ano, mes - 1, 1);
            const end = new Date(ano, mes, 0);
            startDate = start.toISOString().split('T')[0];
            endDate = end.toISOString().split('T')[0];
        }

        // Buscar transações
        let query = supabase
            .from('financeiro_contas')
            .select('*')
            .gte('data_vencimento', startDate)
            .lte('data_vencimento', endDate);

        if (loja_id) {
            query = query.eq('loja_id', loja_id);
        }

        const { data: transacoes, error } = await query;

        if (error) throw error;

        // PROCESSAR DADOS (DRE)
        const receitas = transacoes?.filter((t: any) => t.tipo === 'receita') || [];
        const despesas = transacoes?.filter((t: any) => t.tipo === 'despesa') || [];

        const totalReceitas = receitas.reduce((acc: number, t: any) => acc + t.valor, 0);
        const totalDespesas = despesas.reduce((acc: number, t: any) => acc + t.valor, 0);
        const lucroLiquido = totalReceitas - totalDespesas;

        // Agrupar por categoria
        const agruparPorItem = (lista: any[]) => {
            const map = new Map<string, number>();
            lista.forEach(t => {
                const val = map.get(t.item) || 0;
                map.set(t.item, val + t.valor);
            });
            return Array.from(map.entries())
                .map(([item, total]) => ({ item, total }))
                .sort((a, b) => b.total - a.total);
        };

        const receitasPorCategoria = agruparPorItem(receitas);
        const despesasPorCategoria = agruparPorItem(despesas);

        // Análise mensal (para gráficos)
        const analiseAnual = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const mesTransacoes = transacoes?.filter((t: any) => {
                const tMes = parseInt(t.data_vencimento.split('-')[1]);
                return tMes === m;
            }) || [];

            const recs = mesTransacoes.filter((t: any) => t.tipo === 'receita');
            const desps = mesTransacoes.filter((t: any) => t.tipo === 'despesa');

            return {
                mes: m,
                mesNome: new Date(ano, i).toLocaleString('pt-BR', { month: 'short' }),
                receitas: recs.reduce((acc: number, t: any) => acc + t.valor, 0),
                despesas: desps.reduce((acc: number, t: any) => acc + t.valor, 0),
                lucro: recs.reduce((acc: number, t: any) => acc + t.valor, 0) - desps.reduce((acc: number, t: any) => acc + t.valor, 0)
            };
        });

        // RESPOSTA
        const relatorio = {
            periodo: mes === 0 ? `Ano ${ano}` : `${mes}/${ano}`,
            geradoEm: new Date().toISOString(),
            resumo: {
                totalReceitas,
                totalDespesas,
                lucroLiquido,
                margemLucro: totalReceitas > 0 ? ((lucroLiquido / totalReceitas) * 100).toFixed(2) : '0.00'
            },
            detalhamento: {
                receitas: receitasPorCategoria,
                despesas: despesasPorCategoria
            },
            analiseAnual
        };

        return new Response(
            JSON.stringify(relatorio),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Erro ao gerar relatório financeiro:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
