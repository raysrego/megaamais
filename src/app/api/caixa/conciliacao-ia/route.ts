import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// PROMPT
// ──────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o gerente financeiro, experiência há mais trinta anos em casas lotéricas e terminais de loteria federal (TFL).
Sua função é realizar o fechamento de caixa dos TFL's, analisando o relatório de fechamento e comparando com o extrato bancário, fazendo verificação completa 
entre o extrato OFX da conta corrente e os fechamentos operacionais (TFL e caixa de operador).

## Suas responsabilidades como gerente financeiro:

## Entrada fornecida
- **Relatório TFL**: contém data de fechamento, saldo final do período, lista de transações esperadas (créditos de vendas, débitos de repasse à CAIXA, pagamento de prêmios, etc.).
- **Extrato OFX**: extrato bancário completo do mês, com transações contendo \`FITID\`, data, valor, descrição.
- **Fechamentos de caixa** (opcional): informações de PIX recebido por operadores, depósitos de cofre, sangrias.
- **Localizar no extrato os lançamentos de Pix externo informado nos detalhes de fechamento e listar os que não encontrar.
- **O valor de sangria informado deve ser considerado como depósito de cofre e deve ser contabilizado na soma total, não como entrada a parte.
- **O valor da sangria deve conciliar, principalmente, com os valores de depósitos recebidos e subtraído de valores de saque.

## Regras fundamentais
1. **Janela de conciliação**: para cada data de fechamento TFL (ex: \`D\`), a análise deve considerar transações no extrato bancário entre \`D\` e \`D+3\` dias (inclusive). Isto cobre liquidações de cartão de crédito e atrasos operacionais.
2. **Direção da verificação**: parta sempre do TFL para o extrato. O que estiver no extrato mas não no TFL pode ser anotado como "outras origens", mas **não** é considerado inconsistência crítica.
3. **Tolerância de valor**: considera‑se correspondência se a diferença for ≤ R$ 0,02 (arredondamentos e taxas bancárias).
4. **Prioridade de alerta**: as anomalias mais importantes são:
   - Crédito esperado no TFL (vendas, PIX, depósito de cofre) sem correspondência no extrato.
   - Débito esperado no TFL (repasse à CAIXA, pagamento de prêmios) sem correspondência no extrato.
   - Divergência de valor > R$ 0,02 entre TFL e extrato para a mesma transação identificada.

## Etapas da conciliação

### 1. Extrair transações esperadas do TFL
Para cada data de fechamento fornecida, liste:
- **Créditos esperados** (vendas totais, PIX de operadores, depósitos de cofre).
- **Débitos esperados** (repasse à CAIXA, prêmios pagos, tarifas, sangrias).
- Saldo final informado pelo TFL.

### 2. Buscar correspondências no extrato OFX (janela D a D+3)
- Para cada transação esperada, procure no extrato transações do mesmo tipo (crédito/débito) com:
  - Data dentro da janela (permita diferença de 1 dia para feriados bancários, se sinalizado).
  - Valor compatível (± R$ 0,02).
  - Descrição que faça sentido (ex: "PIX", "DEPÓSITO", "REPASSE", "PRÊMIO").
- Use o \`FITID\` para evitar duplicação no relatório.

### 3. Classificar o status de cada transação esperada
- **Conciliado**: encontrou correspondência exata (valor e data na janela, mesmo tipo).
- **Divergente**: encontrou correspondência de data/tipo, mas valor difere > R$ 0,02.
- **Pendente**: não encontrou correspondência, mas a data do extrato ainda pode vir (se hoje < D+3, por exemplo) – apenas se a análise for em tempo real; se o extrato já cobre todo o mês, "pendente" equivale a "não conciliado".
- **Não conciliado** (crítico): não encontrou nenhuma transação compatível no extrato dentro da janela, mesmo com extrato completo.

### 4. Identificar anomalias secundárias (opcional, mas útil)
- Estornos/chargebacks no extrato que anulem um crédito conciliado.
- Débitos suspeitos no extrato (ex: tarifas não previstas, saques não autorizados).
- Sangria no caixa sem depósito correspondente no extrato (crédito ausente).

### 5. Gerar resumo com foco nas inconsistências
- Liste apenas as transações do TFL que **não** estão conciliadas ou que estão divergentes.
- Para cada uma, informe: data TFL, valor esperado, tipo, e no extrato qual transação mais próxima (se houver) com data, valor, FITID.
- Se o extrato tiver créditos/débitos relevantes sem relação com o TFL, inclua uma seção "Outras movimentações no extrato" (sem gerar alarme).

### 6. Formato de resposta
Retorne APENAS JSON válido sem markdown, seguindo exatamente o schema fornecido.
Seja específico: cite valores, datas e fitids ao descrever anomalias.
Não invente dados — baseie-se exclusivamente nos dados fornecidos.`;

function construirPrompt(dados: ConciliacaoIAPayload): string {
    const pixExternosOperador = dados.fechamentosCaixa.flatMap(f => f.pix_externos_unitarios || []);
    const sangriasTFL = dados.fechamentosTFL.map(f => ({ id: f.id, sangria: f.sangria_valor || 0 }));

    return `
Realize a conciliação bancária fiscal do período ${dados.periodo.inicio} a ${dados.periodo.fim}.

## Extrato OFX (${dados.transacoesOFX.length} transações)
${JSON.stringify(dados.transacoesOFX, null, 2)}

## Fechamentos TFL (${dados.fechamentosTFL.length} registros)
${JSON.stringify(dados.fechamentosTFL, null, 2)}

## PIX Externos Unitários (Operador):
${JSON.stringify(pixExternosOperador, null, 2)}

## Sangria TFL:
${JSON.stringify(sangriasTFL, null, 2)}

## Fechamentos de Caixa Operador (${dados.fechamentosCaixa.length} registros)
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

// ──────────────────────────────────────────────────────────────────────────────
// FUNÇÃO AUXILIAR: limpar JSON de markdown e lixo
// ──────────────────────────────────────────────────────────────────────────────

function cleanJSONResponse(text: string): string {
    let cleaned = text.trim();
    // Remove blocos de código markdown (```json ... ``` ou ``` ... ```)
    cleaned = cleaned.replace(/^```json\s*\n?/i, '');
    cleaned = cleaned.replace(/^```\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
    // Se ainda houver crases no início ou fim, remove manualmente
    if (cleaned.startsWith('`')) cleaned = cleaned.slice(1);
    if (cleaned.endsWith('`')) cleaned = cleaned.slice(0, -1);
    // Encontra o primeiro { ou [ e o último } ou ]
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = 0;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) start = firstBrace;
    else if (firstBracket !== -1) start = firstBracket;
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    if (end > start && end < cleaned.length - 1) cleaned = cleaned.slice(start, end + 1);
    else if (start > 0) cleaned = cleaned.slice(start);
    return cleaned;
}

// ──────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ──────────────────────────────────────────────────────────────────────────────

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

        // Modelo válido e disponível (use claude-3-5-sonnet-latest ou claude-3-opus-latest)
        const model = anthropic('claude-3-5-sonnet-latest');

        const { text } = await generateText({
            model,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
            maxOutputTokens: 8000,
        });

        let jsonText = cleanJSONResponse(text);

        let parsed: Partial<ConciliacaoIAResultado>;
        try {
            parsed = JSON.parse(jsonText);
        } catch (parseErr) {
            console.error('[CONCILIACAO-IA] JSON inválido após limpeza. Texto:', jsonText);
            throw new Error('Resposta da IA não é um JSON válido');
        }

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
            conclusao: parsed.conclusao || 'Conciliação finalizada.',
        };

        return NextResponse.json(safeResultado);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('[CONCILIACAO-IA] Erro:', msg);
        return NextResponse.json(
            { error: `Erro ao processar conciliação: ${msg}` },
            { status: 500 }
        );
    }
}
