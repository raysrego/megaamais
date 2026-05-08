import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const JogoSchema = z.object({
  nome: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});

const ServicoSchema = z.object({
  tipo: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});

const CedulaSchema = z.object({
  valor: z.number(),
  quantidade: z.number(),
});

const DepositoSchema = z.object({
  matricula: z.string(),
  nome: z.string(),
  totalDepositado: z.number(),
});

const ConcursoSchema = z.object({
  jogo: z.string(),
  concurso: z.string(),
  quantidade: z.number(),
  valorCota: z.number(),
  custoCota: z.number(),
  meioPagamento: z.string(),
});

const ContaSchema = z.object({
  descricao: z.string(),
  valor: z.number(),
});

const FichaAnalisadaSchema = z.object({
  tipoDocumento: z.enum([
    'RESUMO_DO_DIA',
    'TERMINAL_DEPOSITARIO',
    'LISTA_DEPOSITOS',
    'ACERTO_COTAS_DIGITAIS',
    'DESCONHECIDO',
  ]).describe('Tipo do documento identificado automaticamente'),

  // Campos comuns
  data: z.string().nullable().describe('Data no formato DD/MM/AAAA'),
  terminal: z.string().nullable().describe('Número do terminal'),

  // RESUMO DO DIA
  jogos: z.array(JogoSchema).optional().describe('Jogos da seção RECEBIMENTOS'),
  totalJogos: z.number().nullable().optional(),
  contas: z.array(ContaSchema).optional().describe('NPC, PRE PAGO, SANEAMENTO etc.'),
  totalContas: z.number().nullable().optional(),
  premiosPagos: z.number().nullable().optional(),
  quantidadePremios: z.number().nullable().optional(),
  servicos: z.array(ServicoSchema).optional().describe('DEPOSITO, SAQUE, PIX etc.'),
  totalEmCaixa: z.number().nullable().optional(),

  // TERMINAL DEPOSITARIO
  valorGeral: z.number().nullable().optional(),
  valorCedulas: z.number().nullable().optional(),
  valorEnvelopes: z.number().nullable().optional(),
  cedulas: z.array(CedulaSchema).optional(),

  // LISTA DEPOSITOS
  depositos: z.array(DepositoSchema).optional(),
  totalGeral: z.number().nullable().optional(),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),

  // ACERTO COTAS DIGITAIS
  concursos: z.array(ConcursoSchema).optional(),
  totalCreditos: z.number().nullable().optional(),
  totalDebitos: z.number().nullable().optional(),
});

const PROMPT = `Você é um assistente financeiro especializado em documentos de terminais de loteria da CAIXA.
Analise a imagem fornecida. Ela pode ser um dos seguintes tipos de documento:
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
- data, terminal, valorGeral, valorCedulas, valorEnvelopes.
- cedulas: array com { valor, quantidade } da lista de cédulas.

**Para "Lista Geral Depositos":**
- depositos: array com { matricula, nome, totalDepositado }.
- totalGeral, dataInicio, dataFim.

**Para "ACERTO VENDAS COTAS DIGITAIS":**
- concursos: array com { jogo, concurso, quantidade, valorCota, custoCota, meioPagamento }.
- totalCreditos, totalDebitos.

Retorne JSON estritamente de acordo com o schema. Nenhum texto adicional.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const { object: dados } = await generateObject({
      model: anthropic('claude-opus-4-5'),
      schema: FichaAnalisadaSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image', image: base64Image, mediaType },
          ],
        },
      ],
    });

    return NextResponse.json(dados);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[ANALISE-FICHA] Erro:', msg);
    return NextResponse.json({ error: `Erro ao processar imagem: ${msg}` }, { status: 500 });
  }
}
