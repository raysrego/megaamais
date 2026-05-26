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
    dados_extraidos?: Record<string, unknown>;
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
    referencia?: string; // id do fechamento correspondente
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

## Entrada fornecida
- **Relatório TFL**: contém data de fechamento, saldo final do período, lista de transações esperadas (créditos de vendas, débitos de repasse à CAIXA, pagamento de prêmios, etc.).
- **Extrato OFX**: extrato bancário completo do mês, com transações contendo \`FITID\`, data, valor, descrição.
- **Fechamentos de caixa** (opcional): informações de PIX recebido por operadores, depósitos de cofre, sangrias.

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

### 5. Formato de resposta
Retorne APENAS JSON válido sem markdown, seguindo exatamente o schema fornecido.
Seja específico: cite valores, datas e fitids ao descrever anomalias.
Não invente dados — baseie-se exclusivamente nos dados fornecidos.`;

const USER_PROMPT_TEMPLATE = (dados: ConciliacaoIAPayload) => `
Realize a conciliação bancária fiscal do período ${dados.periodo.inicio} a ${dados.periodo.fim}.

## Extrato OFX (${dados.transacoesOFX.length} transações)
${JSON.stringify(dados.transacoesOFX, null, 2)}

## Fechamentos TFL (${dados.fechamentosTFL.length} registros)
${JSON.stringify(dados.fechamentosTFL, null, 2)}

## PIX Externos Unitários (Operador):
${JSON.stringify(fechamentosCaixa.flatMap(f => f.pix_externos_unitarios), null, 2)}

## Sangria TFL:
${JSON.stringify(fechamentosTFL.map(f => ({ id: f.id, sangria: f.sangria_valor })), null, 2)}

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
}`;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const payload: ConciliacaoIAPayload = await request.json();

        if (!payload.transacoesOFX?.length && !payload.fechamentosTFL?.length) {
            return NextResponse.json(
                { error: 'É necessário fornecer extrato OFX e/ou fechamentos TFL para conciliação.' },
                { status: 400 }
            );
        }

        const { text } = await generateText({
            model: anthropic('claude-opus-4-5'),
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: USER_PROMPT_TEMPLATE(payload),
                },
            ],
            maxOutputTokens: 8000,
        });

        let jsonText = text.trim();
        const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) jsonText = fenceMatch[1].trim();

        const resultado: ConciliacaoIAResultado = JSON.parse(jsonText);
        return NextResponse.json(resultado);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('[CONCILIACAO-IA] Erro:', msg);
        return NextResponse.json({ error: `Erro ao processar conciliação: ${msg}` }, { status: 500 });
    }
}
