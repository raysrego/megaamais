import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const PROMPT = `Você é um assistente financeiro especializado em documentos de terminais de loteria da CAIXA.
Analise o documento fornecido. Ele pode ser um dos seguintes tipos:
1. "RESUMO DO DIA" ou "RESUMO DO DIA - TERMINAL"
2. "TERMINAL DEPOSITARIO - EXTRATO SALDO" (com lista de cédulas)
3. "Lista Geral Depositos" (depósitos por atendente)
4. "ACERTO VENDAS COTAS DIGITAIS" (vendas de cotas pelo marketplace)

Identifique automaticamente qual é o tipo e extraia APENAS as informações relevantes para aquele tipo.

**Regras gerais:**
- Datas: sempre no formato DD/MM/AAAA.
- Valores monetários: converter para número (ex: "1.445,00" → 1445.00). Remover "R$".
- Campos ausentes: retornar null ou array vazio, nunca inventar.
- Se houver ambiguidade, priorize a extração mais conservadora.

**Para "RESUMO DO DIA":**
- tipoDocumento: "RESUMO_DO_DIA"
- data: a data que aparece no topo.
- terminal: número após "TERM" ou "TERMINAL".
- jogos: array com { nome, quantidade, valor } para cada linha da seção RECEBIMENTOS.
- totalJogos: valor da linha "TOTAL JOGOS".
- contas: array com { descricao, valor } para itens como "NPC - PGTO.", "PRE PAGO", "SANEAMENTO".
- totalContas: valor da linha "TOTAL CONTAS".
- premiosPagos: valor total da seção "PREMIOS PAGOS".
- quantidadePremios: quantidade total de prêmios pagos.
- servicos: array com { tipo, quantidade, valor } da seção "SERVICOS C.CORRENTE/POUPANCA".
- totalEmCaixa: valor do campo "TOTAL EM CAIXA" se existir.

**Para "TERMINAL DEPOSITARIO":**
- tipoDocumento: "TERMINAL_DEPOSITARIO"
- data, terminal, valorGeral, valorCedulas, valorEnvelopes.
- cedulas: array com { valor, quantidade } da lista de cédulas.

**Para "Lista Geral Depositos":**
- tipoDocumento: "LISTA_DEPOSITOS"
- depositos: array com { matricula, nome, totalDepositado }.
- totalGeral, dataInicio, dataFim.

**Para "ACERTO VENDAS COTAS DIGITAIS":**
- tipoDocumento: "ACERTO_COTAS_DIGITAIS"
- concursos: array com { jogo, concurso, quantidade, valorCota, custoCota, meioPagamento }.
- totalCreditos, totalDebitos.

Se não reconhecer o tipo, use tipoDocumento: "DESCONHECIDO".

Retorne APENAS um objeto JSON válido, sem markdown, sem texto extra, sem blocos de código.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fileContent: any;
    if (isPDF) {
      fileContent = {
        type: 'file',
        data: `data:application/pdf;base64,${base64Data}`,
        mimeType: 'application/pdf',
      };
    } else {
      const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      fileContent = {
        type: 'image',
        image: base64Data,
        mediaType,
      };
    }

    const { text } = await generateText({
      model: anthropic('claude-opus-4-5'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            fileContent,
          ],
        },
      ],
    });

    let jsonText = text.trim();
    // Strip markdown code fences if present
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonText = fenceMatch[1].trim();

    const dados = JSON.parse(jsonText);

    if (!dados.tipoDocumento) {
      dados.tipoDocumento = 'DESCONHECIDO';
    }

    return NextResponse.json(dados);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[ANALISE-FICHA] Erro:', msg);
    return NextResponse.json({ error: `Erro ao processar arquivo: ${msg}` }, { status: 500 });
  }
}
