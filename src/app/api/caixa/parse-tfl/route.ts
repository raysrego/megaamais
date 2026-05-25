import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const PROMPT = `Você é um especialista em documentos financeiros da Caixa Econômica Federal — Conexão Parceiros.
Analise o documento fornecido. É um relatório de fechamento de caixa TFL (Terminal de Loteria Federal) chamado "DETALHES".

Extraia TODOS os dados do relatório com precisão absoluta.

**Regras:**
- Datas: formato DD/MM/AAAA.
- Valores monetários: converter para número (ex: "R$ 44.871,89" → 44871.89). Remover "R$" e separadores de milhar.
- Campos ausentes: retornar null ou array vazio.
- Quando aparecer "NÃO HOUVE X", setar o campo booleano correspondente como false.
- Para jogos com número de sorteio (ex: "LOTOFACIL-3678"), extrair o número separado.

Retorne APENAS um objeto JSON válido com a seguinte estrutura (sem markdown, sem texto extra):
{
  "data_referencia": "DD/MM/AAAA ou null",
  "terminal": "número do terminal ou null",
  "total_creditos": número ou null,
  "total_debitos": número ou null,
  "saldo_final": número ou null,
  "lancamentos_manuais": true/false,
  "recebimentos": {
    "jogos": [{ "descricao": "", "numero_sorteio": "" ou null, "quantidade": 0, "valor": 0 }],
    "total_jogos_quantidade": número ou null,
    "total_jogos_valor": número ou null,
    "contas": [{ "descricao": "", "quantidade": 0, "valor": 0 }],
    "total_contas_quantidade": número ou null,
    "total_contas_valor": número ou null,
    "total_recebimentos_quantidade": número ou null,
    "total_recebimentos_valor": número ou null
  },
  "premios_pagos": {
    "itens": [{ "descricao": "", "quantidade": 0, "valor": 0 }],
    "total_quantidade": número ou null,
    "total_valor": número ou null
  },
  "pagamentos": {
    "itens": [{ "descricao": "", "quantidade": 0, "valor": 0 }],
    "total_quantidade": número ou null,
    "total_valor": número ou null
  },
  "servicos_conta": {
    "itens": [{ "descricao": "", "quantidade": 0, "valor": 0 }],
    "total_quantidade": número ou null,
    "total_valor": número ou null
  },
  "total_em_caixa": número ou null,
  "servicos_sem_movimentacao": true/false,
  "invalidacoes": true/false,
  "estornos": true/false,
  "reimpressoes": true/false,
  "totais_finais": {
    "creditos_manuais": número ou null,
    "creditos_tfl": número ou null,
    "debitos_manuais": número ou null,
    "debitos_tfl": número ou null,
    "total_creditos": número ou null,
    "total_debitos": número ou null,
    "saldo_final": número ou null
  }
}`;

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
    const content: any[] = [{ type: 'text', text: PROMPT }];

    if (isPDF) {
      content.push({ type: 'file', data: buffer, mediaType: 'application/pdf' });
    } else {
      const mediaType = file.type || 'image/jpeg';
      content.push({ type: 'image', image: base64Data, mediaType });
    }

    const { text } = await generateText({
      model: anthropic('claude-opus-4-5'),
      messages: [{ role: 'user', content }],
    });

    let jsonText = text.trim();
    // Strip markdown code fences if present
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonText = fenceMatch[1].trim();

    const dados = JSON.parse(jsonText);

    return NextResponse.json(dados);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[PARSE-TFL] Erro:', msg);
    return NextResponse.json({ error: `Erro ao processar arquivo: ${msg}` }, { status: 500 });
  }
}
