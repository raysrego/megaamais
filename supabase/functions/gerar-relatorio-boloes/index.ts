import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/database.ts';

interface RelatorioBaloesParams {
    periodo_inicio?: string;
    periodo_fim?: string;
    loja_id?: string | null;
    status?: 'ativo' | 'encerrado' | 'cancelado' | null;
}

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const supabase = createSupabaseClient(req);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Não autenticado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const params: RelatorioBaloesParams = await req.json();
        const { periodo_inicio, periodo_fim, loja_id, status } = params;

        // Buscar bolões
        let queryBoloes = supabase.from('boloes').select(`
      *,
      vendas_boloes(*)
    `);

        if (periodo_inicio) {
            queryBoloes = queryBoloes.gte('data_sorteio', periodo_inicio);
        }
        if (periodo_fim) {
            queryBoloes = queryBoloes.lte('data_sorteio', periodo_fim);
        }
        if (loja_id) {
            queryBoloes = queryBoloes.eq('loja_id', loja_id);
        }
        if (status) {
            queryBoloes = queryBoloes.eq('status', status);
        }

        const { data: boloes, error: errorBoloes } = await queryBoloes;
        if (errorBoloes) throw errorBoloes;

        // PROCESSAR DADOS
        const analiseBoloes = boloes?.map((bolao: any) => {
            const vendas = bolao.vendas_boloes || [];
            const cotasVendidas = vendas.length;
            const totalVendas = cotasVendidas * bolao.preco_venda_cota;

            // CMV (Custo da Mercadoria Vendida)
            const custoTotal = bolao.preco_compra || 0;
            const cmv = (custoTotal / bolao.total_cotas) * cotasVendidas;

            // Lucro Bruto
            const lucroBruto = totalVendas - cmv;

            // Margem de Contribuição
            const margemContribuicao = totalVendas > 0
                ? ((lucroBruto / totalVendas) * 100).toFixed(2)
                : '0.00';

            // Comissões (se configuradas)
            const comissaoOperador = vendas
                .filter((v: any) => v.comissao_operador)
                .reduce((acc: number, v: any) => acc + (v.comissao_operador || 0), 0);

            const comissaoMaster = vendas
                .filter((v: any) => v.comissao_master)
                .reduce((acc: number, v: any) => acc + (v.comissao_master || 0), 0);

            const totalComissoes = comissaoOperador + comissaoMaster;

            // Lucro Líquido
            const lucroLiquido = lucroBruto - totalComissoes;

            return {
                bolao_id: bolao.id,
                uid: bolao.uid,
                modalidade: bolao.modalidade,
                data_sorteio: bolao.data_sorteio,
                status: bolao.status,
                financeiro: {
                    cotasVendidas,
                    cotasTotais: bolao.total_cotas,
                    percentualVendido: ((cotasVendidas / bolao.total_cotas) * 100).toFixed(2),
                    precoVendaCota: bolao.preco_venda_cota,
                    totalVendas,
                    custoTotal,
                    cmv,
                    lucroBruto,
                    margemContribuicao: parseFloat(margemContribuicao),
                    comissoes: {
                        operador: comissaoOperador,
                        master: comissaoMaster,
                        total: totalComissoes
                    },
                    lucroLiquido
                }
            };
        }) || [];

        // RESUMO GERAL
        const resumo: any = {
            totalBoloes: analiseBoloes.length,
            cotasVendidas: analiseBoloes.reduce((acc: number, b: any) => acc + b.financeiro.cotasVendidas, 0),
            faturamentoTotal: analiseBoloes.reduce((acc: number, b: any) => acc + b.financeiro.totalVendas, 0),
            cmvTotal: analiseBoloes.reduce((acc: number, b: any) => acc + b.financeiro.cmv, 0),
            lucroBruto: analiseBoloes.reduce((acc: number, b: any) => acc + b.financeiro.lucroBruto, 0),
            comissoesTotal: analiseBoloes.reduce((acc: number, b: any) => acc + b.financeiro.comissoes.total, 0),
            lucroLiquido: analiseBoloes.reduce((acc: number, b: any) => acc + b.financeiro.lucroLiquido, 0)
        };

        resumo['margemMedia'] = resumo.faturamentoTotal > 0
            ? parseFloat(((resumo.lucroBruto / resumo.faturamentoTotal) * 100).toFixed(2))
            : 0;

        const relatorio = {
            periodo: {
                inicio: periodo_inicio || 'Início',
                fim: periodo_fim || 'Atual'
            },
            geradoEm: new Date().toISOString(),
            resumo,
            boloes: analiseBoloes
        };

        return new Response(
            JSON.stringify(relatorio),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Erro ao gerar relatório de bolões:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
