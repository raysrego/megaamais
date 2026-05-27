import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransacaoOFX {
    fitid: string;
    tipo: 'CREDIT' | 'DEBIT';
    data: string;
    valor: number;
    memo: string;
}

interface FechamentoTFL {
    id: string;
    data_referencia: string;
    terminal: string;
    arquivo_nome: string;
    total_creditos: number;
    total_debitos: number;
    saldo_final: number;
    sangria_valor?: number;
    dados_extraidos?: Record<string, unknown>;
    pix_externos?: Array<{ id?: number; data: string; valor: number; descricao?: string }>;
}

interface FechamentoCaixa {
    id: string;
    data_turno: string;
    terminal_id: string;
    operador_nome: string;
    resumo_entradas_pix: number;
    resumo_entradas_dinheiro: number;
    resumo_saidas_sangria: number;
    resumo_saidas_deposito: number;
    valor_enviado_cofre: number;
    pix_externo_informado: number;
    resumo_total_entradas: number;
    valor_final_declarado: number;
    diferenca_caixa: number;
    pix_externos_unitarios?: Array<{ id?: number; data_pix: string; valor: number; descricao?: string }>;
}

export interface ConciliacaoIAPayload {
    lojaId: string;
    periodo: { inicio: string; fim: string };
    transacoesOFX: TransacaoOFX[];
    fechamentosTFL: FechamentoTFL[];
    fechamentosCaixa: FechamentoCaixa[];
}

export interface ItemConciliado {
    tipo: 'pix' | 'deposito' | 'estorno' | 'debito' | 'outros';
    data: string;
    valor: number;
    descricao_ofx: string;
    fitid: string;
    status: 'conciliado' | 'pendente' | 'divergente' | 'suspeito';
    referencia?: string;
    observacao?: string;
}

export interface ConciliacaoIAResultado {
    parecer_geral: string;
    status_geral: 'aprovado' | 'aprovado_com_ressalvas' | 'rejeitado';
    risco: 'baixo' | 'medio' | 'alto';
    resumo_financeiro: {
        total_creditos_ofx: number;
        total_debitos_ofx: number;
        total_pix_externos: number;
        total_depositos_cofre: number;
        total_estornos: number;
        saldo_tfl_periodo: number;
        diferenca_apurada: number;
    };
    itens_conciliados: ItemConciliado[];
    alertas: { nivel: 'info' | 'aviso' | 'critico'; mensagem: string }[];
    recomendacoes: string[];
    conclusao: string;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um auditor fiscal especializado em casas lotéricas e terminais de loteria federal (TFL).
Sua função é realizar a conciliação bancária completa entre o extrato OFX da conta corrente e os fechamentos operacionais (TFL e caixa de operador).

## Suas responsabilidades como auditor:

### 1. Análise do Extrato OFX
- Faça a análise com base na data do relatório do fechamento
- Se o extrato tem transações de uma ou mais datas, a análise deve ter foco apenas nas datas dos fechamentos selecionados
- Classifique cada transação: PIX recebido, depósito, estorno/chargeback, débito de tarifa, TEDs recebidas, etc.
- Identifique créditos que correspondem a PIX registrados pelos operadores
- Identifique créditos que correspondem a depósitos do cofre no banco
- Identifique débitos suspeitos ou não esperados
- Detecte estornos (valores negativos ou descrição com "ESTORNO", "DEVOLUCAO", "REVERSAL")

### 2. Cruzamento com TFL
- Compare o saldo final do TFL com o saldo esperado na conta bancária no mesmo período
- Identifique discrepâncias entre créditos TFL e créditos no extrato bancário
- Valores de jogos cobrados no TFL devem aparecer como débitos no extrato (repasse à CAIXA)
- Prêmios pagos no TFL aparecem como débitos no extrato (saída para pagamento)

### 3. Cruzamento com Fechamentos de Caixa
- PIX externos informados pelos operadores devem ter correspondência no extrato como créditos
- Depósitos do cofre devem aparecer como crédito no extrato na mesma data (tolerância 1 dia)
- Sangrias sem depósito correspondente no extrato são suspeitas
- Divergências de caixa > R$50 com créditos não explicados no extrato são críticas

### 4. Regras de Classificação
- Conciliado: transação OFX tem correspondência exata (data + valor ±R$0,02) nos fechamentos
- Pendente: transação OFX sem correspondência clara, mas sem indício de fraude
- Divergente: valor no extrato difere do registrado no sistema (> R$0,02)
- Suspeito: padrão incomum (horário atípico, valor quebrado não usual, memo inconsistente)

### 5. Formato de resposta
Retorne APENAS JSON válido sem markdown, seguindo exatamente o schema fornecido.
Seja específico: cite valores, datas e fitids ao descrever anomalias.
Não invente dados — baseie-se exclusivamente nos dados fornecidos.`;

function construirPrompt(dados: ConciliacaoIAPayload): string {
    const pixExternosOperador = dados.fechamentosCaixa.flatMap(f =>
        (f.pix_externos_unitarios || []).map(p => ({
            ...p,
            data: p.data_pix,
            origem: `operador_${f.operador_nome}`,
            sessao_id: f.id
        }))
    );

    const pixExternosTFL = dados.fechamentosTFL.flatMap(f =>
        (f.pix_externos || []).map(p => ({
            ...p,
            origem: `tfl_${f.terminal}`,
            tfl_id: f.id
        }))
    );

    const todosPixExternos = [...pixExternosOperador, ...pixExternosTFL];
    const sangrias = dados.fechamentosTFL
        .filter(f => f.sangria_valor && f.sangria_valor > 0)
        .map(f => ({ tfl_id: f.id, data: f.data_referencia, valor: f.sangria_valor }));

    return `
Realize a conciliação bancária fiscal do período ${dados.periodo.inicio} a ${dados.periodo.fim}.

## Extrato OFX (${dados.transacoesOFX.length} transações)
${JSON.stringify(dados.transacoesOFX, null, 2)}

## Fechamentos TFL (${dados.fechamentosTFL.length} registros)
${JSON.stringify(dados.fechamentosTFL, null, 2)}

## PIX Externos Unitários (individuais) - DEVEM SER CRUZADOS COM O EXTRATO NA MESMA DATA:
${todosPixExternos.length > 0 ? JSON.stringify(todosPixExternos, null, 2) : 'Nenhum PIX externo unitário informado.'}

## Sangrias informadas (valores retirados do caixa físico que devem aparecer como débito no extrato):
${sangrias.length > 0 ? JSON.stringify(sangrias, null, 2) : 'Nenhuma sangria informada.'}

## Fechamentos de Caixa Operador (totais agregados para referência):
${JSON.stringify(dados.fechamentosCaixa, null, 2)}

Retorne APENAS o JSON no seguinte schema, sem nenhum texto adicional:
{
  "parecer_geral": "string com parecer objetivo de 2-3 frases citando valores relevantes",
  "status_geral": "aprovado" | "aprovado_com_ressalvas" | "rejeitado",
  "risco": "baixo" | "medio" | "alto",
  "resumo_financeiro": {
    "total_creditos_ofx": number,
    "total_debitos_ofx": number,
    "total_pix_externos": number,
    "total_depositos_cofre": number,
    "total_estornos": number,
    "saldo_tfl_periodo": number,
    "diferenca_apurada": number
  },
  "itens_conciliados": [
    {
      "tipo": "pix" | "deposito" | "estorno" | "debito" | "outros",
      "data": "YYYY-MM-DD",
      "valor": number,
      "descricao_ofx": "string",
      "fitid": "string",
      "status": "conciliado" | "pendente" | "divergente" | "suspeito",
      "referencia": "id do fechamento relacionado ou null",
      "observacao": "motivo específico quando status != conciliado"
    }
  ],
  "alertas": [
    { "nivel": "info" | "aviso" | "critico", "mensagem": "string específica com valor e data" }
  ],
  "recomendacoes": ["string"],
  "conclusao": "string resumo final de 1 frase"
}
`;
}

// ─── Route Handler (corrigido) ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const payload: ConciliacaoIAPayload = await request.json();

        if (!payload.transacoesOFX?.length && !payload.fechamentosTFL?.length) {
            return NextResponse.json(
                { error: 'É necessário fornecer extrato OFX e/ou fechamentos TFL para conciliação.' },
                { status: 400 }
            );
        }

        const userPrompt = construirPrompt(payload);

        // Modelo válido - use um dos abaixo:
        // const model = anthropic('claude-opus-4-5');
        const model = anthropic('claude-opus-4-5'); // mais leve e rápido

        const { text } = await generateText({
            model,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
            maxOutputTokens: 8000,
        });

        let jsonText = text.trim();
        const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) jsonText = fenceMatch[1].trim();

        const parsed: Partial<ConciliacaoIAResultado> = JSON.parse(jsonText);

        // Garantir que todos os campos obrigatórios existam
        const safeResultado: ConciliacaoIAResultado = {
            parecer_geral: parsed.parecer_geral || 'Não foi possível gerar um parecer completo.',
            status_geral: parsed.status_geral || 'rejeitado',
            risco: parsed.risco || 'medio',
            resumo_financeiro: {
                total_creditos_ofx: parsed.resumo_financeiro?.total_creditos_ofx ?? 0,
                total_debitos_ofx: parsed.resumo_financeiro?.total_debitos_ofx ?? 0,
                total_pix_externos: parsed.resumo_financeiro?.total_pix_externos ?? 0,
                total_depositos_cofre: parsed.resumo_financeiro?.total_depositos_cofre ?? 0,
                total_estornos: parsed.resumo_financeiro?.total_estornos ?? 0,
                saldo_tfl_periodo: parsed.resumo_financeiro?.saldo_tfl_periodo ?? 0,
                diferenca_apurada: parsed.resumo_financeiro?.diferenca_apurada ?? 0,
            },
            itens_conciliados: parsed.itens_conciliados || [],
            alertas: parsed.alertas || [],
            recomendacoes: parsed.recomendacoes || [],
            conclusao: parsed.conclusao || 'Conciliação finalizada, mas com campos incompletos retornados pela IA.',
        };

        return NextResponse.json(safeResultado);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('[CONCILIACAO-IA] Erro:', msg);
        return NextResponse.json({ error: `Erro ao processar conciliação: ${msg}` }, { status: 500 });
    }
}
