import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const JogoTFLSchema = z.object({
  descricao: z.string(),
  numero_sorteio: z.string().nullable().optional(),
  quantidade: z.number(),
  valor: z.number(),
});

const ContaTFLSchema = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});

const PremioTFLSchema = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});

const PagamentoTFLSchema = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});

const ServicoContaTFLSchema = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});

const RelatorioTFLSchema = z.object({
  data_referencia: z.string().nullable().describe('Data de referência no formato DD/MM/AAAA'),
  terminal: z.string().nullable().describe('Número do terminal'),
  total_creditos: z.number().nullable().describe('Total de créditos TFL'),
  total_debitos: z.number().nullable().describe('Total de débitos TFL'),
  saldo_final: z.number().nullable().describe('Saldo final em caixa'),

  lancamentos_manuais: z.boolean().describe('Se houve lançamentos manuais'),

  recebimentos: z.object({
    jogos: z.array(JogoTFLSchema).describe('Jogos da loteria recebidos'),
    total_jogos_quantidade: z.number().nullable(),
    total_jogos_valor: z.number().nullable(),
    contas: z.array(ContaTFLSchema).describe('Contas recebidas (NPC, GPS, GOVERNO, etc.)'),
    total_contas_quantidade: z.number().nullable(),
    total_contas_valor: z.number().nullable(),
    total_recebimentos_quantidade: z.number().nullable(),
    total_recebimentos_valor: z.number().nullable(),
  }),

  premios_pagos: z.object({
    itens: z.array(PremioTFLSchema),
    total_quantidade: z.number().nullable(),
    total_valor: z.number().nullable(),
  }),

  pagamentos: z.object({
    itens: z.array(PagamentoTFLSchema),
    total_quantidade: z.number().nullable(),
    total_valor: z.number().nullable(),
  }),

  servicos_conta: z.object({
    itens: z.array(ServicoContaTFLSchema).describe('CART CRED, CART DEB, DEPOSITO, PIX, SAQUE etc.'),
    total_quantidade: z.number().nullable(),
    total_valor: z.number().nullable(),
  }),

  total_em_caixa: z.number().nullable().describe('TOTAL EM CAIXA conforme relatório'),

  servicos_sem_movimentacao: z.boolean().describe('Se houve serviços sem movimentação de caixa'),
  invalidacoes: z.boolean().describe('Se houve invalidações de jogos'),
  estornos: z.boolean().describe('Se houve estornos'),
  reimpressoes: z.boolean().describe('Se houve reimpressão'),

  totais_finais: z.object({
    creditos_manuais: z.number().nullable(),
    creditos_tfl: z.number().nullable(),
    debitos_manuais: z.number().nullable(),
    debitos_tfl: z.number().nullable(),
    total_creditos: z.number().nullable(),
    total_debitos: z.number().nullable(),
    saldo_final: z.number().nullable(),
  }),
});

const PROMPT = `Você é um especialista em documentos financeiros da Caixa Econômica Federal — Conexão Parceiros.
Analise o documento fornecido. É um relatório de fechamento de caixa TFL (Terminal de Loteria Federal) chamado "DETALHES".

Extraia TODOS os dados do relatório com precisão absoluta.

**Regras:**
- Datas: formato DD/MM/AAAA.
- Valores monetários: converter para número (ex: "R$ 44.871,89" → 44871.89). Remover "R$" e separadores de milhar.
- Campos ausentes: retornar null ou array vazio.
- Quando aparecer "NÃO HOUVE X", setar o campo booleano correspondente como false.
- Para jogos com número de sorteio (ex: "LOTOFACIL-3678"), extrair o número separado.

Retorne JSON estritamente de acordo com o schema fornecido. Sem texto adicional.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    type ContentPart =
      | { type: 'text'; text: string }
      | { type: 'file'; data: Buffer; mediaType: string }
      | { type: 'image'; image: string; mediaType: string };

    const content: ContentPart[] = [{ type: 'text', text: PROMPT }];

    if (isPDF) {
      content.push({ type: 'file', data: buffer, mediaType: 'application/pdf' });
    } else {
      const base64 = buffer.toString('base64');
      const mediaType = file.type || 'image/jpeg';
      content.push({ type: 'image', image: base64, mediaType });
    }

    const { object: dados } = await generateObject({
      model: anthropic('claude-opus-4-5'),
      schema: RelatorioTFLSchema,
      messages: [{ role: 'user', content: content as any }],
    });

    return NextResponse.json(dados);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[PARSE-TFL] Erro:', msg);
    return NextResponse.json({ error: `Erro ao processar arquivo: ${msg}` }, { status: 500 });
  }
}
