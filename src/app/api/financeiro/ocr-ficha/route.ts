// app/api/financeiro/ocr-ficha/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

// Definição do schema esperado (mesmo DadosExtraidos que o frontend usa)
const JogoSchema = z.object({
  nome: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});

const DadosFichaSchema = z.object({
  data: z.string().describe('Data no formato DD/MM/AAAA encontrada no campo "RESUMO DO DIA" ou similar'),
  terminal: z.string().describe('Número do terminal, ex: "024409"'),
  jogos: z.array(JogoSchema).describe('Lista de jogos vendidos com nome, quantidade e valor total em reais'),
  totalJogos: z.number().describe('Soma total de todos os jogos (campo TOTAL JOGOS)'),
  totalContas: z.number().describe('Soma total das contas (campo TOTAL CONTAS)'),
  premiosPagos: z.number().describe('Total de prêmios pagos (campo TOTAL de PRÊMIOS PAGOS)'),
  quantidadePremios: z.number().describe('Quantidade de prêmios pagos (número antes do total)'),
  servicos: z.array(z.object({
    tipo: z.string(),
    quantidade: z.number(),
    valor: z.number(),
  })).describe('Lista de serviços como depósito, saque, PIX, com quantidade e valor total'),
  totalEmCaixa: z.number().optional().describe('Valor do campo TOTAL EM CAIXA, se existir'),
  npcBoletos: z.array(z.object({
    valor: z.number(),
  })).optional().describe('Lista de boletos NPC com valor individual (apenas se aparecerem discriminados)'),
});

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

    // Instrução para o modelo
    const prompt = `Você é um extrator de dados de fichas de fechamento de terminal de lotérica da CAIXA.
A imagem contém um "RESUMO DO DIA" ou similar. Extraia todas as informações listadas.
Importante:
- Identifique a data no topo (formato DD/MM/AAAA).
- O número do terminal aparece após "TERM" ou "TERMINAL".
- Jogos: procure a seção de "RECEBIMENTOS" com colunas QTDE e VALOR. Cada linha geralmente tem um nome de jogo (como MEGA, QUINA, LFACIL) seguido de um código e números.
- Some corretamente o total de jogos.
- O total de contas (TOTAL CONTAS) e os totais de prêmios pagos estão em seções separadas.
- Serviços: depósitos, saques, PIX, cartão de crédito etc., listados em "SERVICOS C.CORRENTE/POUPANCA" ou seção similar.
- Se houver "NPC - PGTO." com valores individuais, coloque-os em npcBoletos.
- Valores monetários podem conter separadores de milhar e vírgula decimal (ex: R$ 1.445,00). Converta para número (ex: 1445.00).

Retorne um JSON estruturado conforme o schema.`;

    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const { object: dados } = await generateObject({
      model: anthropic('claude-opus-4-5'),
      schema: DadosFichaSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: base64Image, mediaType },
          ],
        },
      ],
    });

    return NextResponse.json(dados);
  } catch (error: any) {
    console.error('[OCR AI] Erro:', error);
    return NextResponse.json(
      { error: `Erro ao processar imagem: ${error.message}` },
      { status: 500 }
    );
  }
}
