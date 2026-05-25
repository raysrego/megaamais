import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

interface FechamentoParaAnalise {
    id: string;
    tipo: 'operador' | 'tfl';
    data_turno: string;
    terminal_id: string;
    operador_nome: string;
    justificativa?: string;
    // Operador fields
    valor_inicial?: number;
    saldo_esperado?: number;
    saldo_declarado?: number;
    divergencia?: number;
    total_pix?: number;
    total_dinheiro?: number;
    total_sangrias?: number;
    total_depositos?: number;
    total_boletos?: number;
    total_trocados?: number;
    valor_cofre?: number;
    valor_pix_externo?: number;
    valor_na_conta?: number;
    // TFL fields
    dados_tfl?: {
        total_creditos: number | null;
        total_debitos: number | null;
        saldo_final: number | null;
        recebimentos?: {
            jogos?: { descricao: string; quantidade: number; valor: number }[];
            total_jogos_valor?: number | null;
            contas?: { descricao: string; quantidade: number; valor: number }[];
            total_contas_valor?: number | null;
            total_recebimentos_valor?: number | null;
        };
        premios_pagos?: { itens?: { descricao: string; quantidade: number; valor: number }[]; total_valor?: number | null };
        pagamentos?: { itens?: { descricao: string; quantidade: number; valor: number }[]; total_valor?: number | null };
        servicos_conta?: { itens?: { descricao: string; quantidade: number; valor: number }[]; total_valor?: number | null };
        totais_finais?: {
            creditos_manuais?: number | null;
            creditos_tfl?: number | null;
            debitos_manuais?: number | null;
            debitos_tfl?: number | null;
            total_creditos?: number | null;
            total_debitos?: number | null;
            saldo_final?: number | null;
        };
    };
}

const PROMPT_AUDITORIA = `Você é um auditor financeiro especializado em gestão de caixa de loterias e casas lotéricas.

Analise os fechamentos de caixa pendentes abaixo. Os dados incluem o detalhamento completo de cada fechamento — use TODOS os campos disponíveis para emitir um parecer preciso e fundamentado.

Para registros do tipo "operador":
- Verifique a coerência entre fundo inicial + entradas - saídas = saldo esperado vs. saldo declarado
- Avalie a proporção PIX/Dinheiro (PIX muito baixo pode indicar subfaturamento)
- Analise sangrias: valores atípicos ou ausência de depósito com caixa alto
- Divergência: ≤ R$5 → BAIXO, R$5–50 → MÉDIO (REVISAR), > R$50 → ALTO (REJEITAR)
- PIX externo informado sem correspondência: alerta de risco
- Cofre: verifique se o valor enviado é razoável em relação ao saldo disponível

Para registros do tipo "tfl" (Relatório TFL):
- Verifique cada jogo individualmente: valores unitários e totais devem ser coerentes
- Analise prêmios pagos: valores elevados em relação aos recebimentos são suspeitos
- Créditos manuais vs. créditos TFL: discrepância alta é sinal de alerta
- Confira se total_recebimentos - premios - pagamentos - servicos ≈ saldo_final
- Itens de serviços conta-corrente incomuns: alertar

Regras gerais:
- Use os dados de detalhe (jogos, contas, prêmios, pagamentos) para sustentar o parecer, não apenas os totais
- O parecer deve ser objetivo e indicar os valores específicos que chamaram atenção
- Alertas devem mencionar o campo e o valor problemático

Retorne APENAS um objeto JSON válido, sem markdown, no formato:
{
  "analises": [
    {
      "id": "id_do_fechamento",
      "recomendacao": "APROVAR" | "REJEITAR" | "REVISAR",
      "risco": "BAIXO" | "MEDIO" | "ALTO",
      "parecer": "texto objetivo (máximo 200 chars) referenciando os valores que determinaram a conclusão",
      "alertas": ["alerta 1 com valor específico", "alerta 2"]
    }
  ],
  "resumo": "resumo geral da auditoria em lote, citando padrões encontrados"
}`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const fechamentos: FechamentoParaAnalise[] = body.fechamentos;

        if (!fechamentos || fechamentos.length === 0) {
            return NextResponse.json({ error: 'Nenhum fechamento para analisar' }, { status: 400 });
        }

        const dadosFormatados = fechamentos.map(f => {
            if (f.tipo === 'tfl') {
                return {
                    id: f.id,
                    tipo: 'TFL',
                    data: f.data_turno,
                    terminal: f.terminal_id,
                    arquivo: f.operador_nome,
                    resumo: {
                        total_creditos: f.dados_tfl?.total_creditos,
                        total_debitos: f.dados_tfl?.total_debitos,
                        saldo_final: f.dados_tfl?.saldo_final,
                    },
                    recebimentos: {
                        jogos: f.dados_tfl?.recebimentos?.jogos ?? [],
                        total_jogos: f.dados_tfl?.recebimentos?.total_jogos_valor,
                        contas: f.dados_tfl?.recebimentos?.contas ?? [],
                        total_contas: f.dados_tfl?.recebimentos?.total_contas_valor,
                        total_recebimentos: f.dados_tfl?.recebimentos?.total_recebimentos_valor,
                    },
                    premios_pagos: {
                        itens: f.dados_tfl?.premios_pagos?.itens ?? [],
                        total: f.dados_tfl?.premios_pagos?.total_valor,
                    },
                    pagamentos: {
                        itens: f.dados_tfl?.pagamentos?.itens ?? [],
                        total: f.dados_tfl?.pagamentos?.total_valor,
                    },
                    servicos_conta: {
                        itens: f.dados_tfl?.servicos_conta?.itens ?? [],
                        total: f.dados_tfl?.servicos_conta?.total_valor,
                    },
                    totais_finais: f.dados_tfl?.totais_finais,
                    observacoes: f.justificativa || null,
                };
            }

            // operador
            return {
                id: f.id,
                tipo: 'OPERADOR',
                data: f.data_turno,
                terminal: f.terminal_id,
                operador: f.operador_nome,
                fundo_inicial: f.valor_inicial,
                entradas: {
                    pix: f.total_pix,
                    dinheiro: f.total_dinheiro,
                    total: (f.total_pix ?? 0) + (f.total_dinheiro ?? 0),
                },
                saidas: {
                    sangrias: f.total_sangrias,
                    depositos: f.total_depositos,
                    boletos: f.total_boletos,
                    trocados: f.total_trocados,
                    total: (f.total_sangrias ?? 0) + (f.total_depositos ?? 0) + (f.total_boletos ?? 0) + (f.total_trocados ?? 0),
                },
                pix_externo: f.valor_pix_externo,
                valor_cofre: f.valor_cofre,
                saldo_esperado: f.saldo_esperado,
                saldo_declarado: f.saldo_declarado,
                divergencia: f.divergencia,
                valor_na_conta: f.valor_na_conta,
                justificativa_operador: f.justificativa || null,
            };
        });

        const { text } = await generateText({
            model: anthropic('claude-opus-4-5'),
            messages: [
                {
                    role: 'user',
                    content: `${PROMPT_AUDITORIA}\n\nDados dos fechamentos pendentes:\n${JSON.stringify(dadosFormatados, null, 2)}`,
                },
            ],
        });

        let jsonText = text.trim();
        const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) jsonText = fenceMatch[1].trim();

        const resultado = JSON.parse(jsonText);
        return NextResponse.json(resultado);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('[ANALISE-AUDITORIA] Erro:', msg);
        return NextResponse.json({ error: `Erro ao processar análise: ${msg}` }, { status: 500 });
    }
}
