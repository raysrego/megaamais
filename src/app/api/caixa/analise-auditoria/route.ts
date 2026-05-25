import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

interface FechamentoParaAnalise {
    id: string;
    data_turno: string;
    terminal_id: string;
    operador_nome: string;
    total_entradas: number;
    total_saidas: number;
    valor_na_conta: number;
    total_pix: number;
    total_dinheiro: number;
    total_sangrias: number;
    total_depositos: number;
    total_boletos: number;
    total_trocados: number;
    valor_cofre: number;
    valor_pix_externo: number;
    divergencia: number;
    justificativa?: string;
}

const PROMPT_AUDITORIA = `Você é um auditor financeiro especializado em gestão de caixa de loterias e casas lotéricas.
Analise os seguintes registros de fechamento de caixa pendentes de auditoria e forneça um parecer detalhado para cada um.

Para cada registro, avalie:
1. Consistência dos valores (entradas vs saídas vs saldo final)
2. Alertas de risco ou anomalias (divergências grandes, valores suspeitos, ausência de depósitos)
3. Recomendação: APROVAR, REJEITAR ou REVISAR
4. Observações específicas para o auditor humano

Critérios de análise:
- Divergência aceitável: até R$ 5,00 (diferença operacional normal)
- Divergência moderada (R$ 5,01 a R$ 50,00): REVISAR — pode ser erro de contagem
- Divergência alta (acima de R$ 50,00): REJEITAR — investigar
- Ausência de depósito com valor alto em caixa: alertar
- PIX externo sem correspondência: alertar

Retorne APENAS um objeto JSON válido, sem markdown, no formato:
{
  "analises": [
    {
      "id": "id_do_fechamento",
      "recomendacao": "APROVAR" | "REJEITAR" | "REVISAR",
      "risco": "BAIXO" | "MEDIO" | "ALTO",
      "parecer": "texto curto (máximo 150 chars) com o parecer principal",
      "alertas": ["alerta 1", "alerta 2"]
    }
  ],
  "resumo": "texto com resumo geral da auditoria em lote"
}`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const fechamentos: FechamentoParaAnalise[] = body.fechamentos;

        if (!fechamentos || fechamentos.length === 0) {
            return NextResponse.json({ error: 'Nenhum fechamento para analisar' }, { status: 400 });
        }

        const dadosFormatados = fechamentos.map(f => ({
            id: f.id,
            data: f.data_turno,
            terminal: f.terminal_id,
            operador: f.operador_nome,
            entradas: {
                pix: f.total_pix,
                dinheiro: f.total_dinheiro,
                total: f.total_entradas,
            },
            saidas: {
                sangrias: f.total_sangrias,
                depositos: f.total_depositos,
                boletos: f.total_boletos,
                trocados: f.total_trocados,
                total: f.total_saidas,
            },
            valor_na_conta: f.valor_na_conta,
            valor_cofre: f.valor_cofre,
            pix_externo: f.valor_pix_externo,
            divergencia: f.divergencia,
            justificativa_operador: f.justificativa || null,
        }));

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
