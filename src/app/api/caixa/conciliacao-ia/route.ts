import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// ─── Types (mantido igual) ────────────────────────────────────────────────────

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

// ─── PROMPT SISTEMA (reformulado) ────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um auditor fiscal especializado em casas lotéricas e terminais de loteria federal (TFL).
Sua função é realizar a conciliação bancária completa entre o extrato OFX da conta corrente e os fechamentos operacionais (TFL e caixa de operador).

## Conceitos importantes

### Sangria (retirada de caixa físico)
- A **sangria** representa dinheiro em espécie retirado do caixa do terminal/lotérica.
- Esse valor **deve ser depositado na conta bancária** da empresa (crédito no extrato OFX).
- No extrato, aparecerá como uma transação do tipo **CREDIT**, normalmente com descrições como "DEPÓSITO EM ESPÉCIE", "DEPÓSITO BANCÁRIO", "CRÉDITO EM CONTA" ou similar.
- **Portanto, a sangria é um crédito esperado no extrato** (aumenta o saldo bancário).

### PIX Externos Unitários
- São PIX recebidos individualmente (de clientes, terceiros) que devem constar no extrato como **CREDIT** na mesma data informada (ou D+1 por liquidação).
- A soma de todos os PIX externos do período é parte dos créditos totais que devem ser conciliados.

### Relação com os totais do TFL
- O TFL informa **total_creditos** (valor total que deveria ter entrado na conta no período, considerando vendas + PIX + depósitos de cofre, etc.).
- A soma de **todos os PIX externos unitários** + **todas as sangrias** representa uma parcela identificável desses créditos.
- A outra parcela corresponde a vendas no terminal (débito/crédito) e outros recebíveis que também devem ser encontrados no extrato.
- **A conciliação está correta quando a soma (PIX externos + sangrias) for encontrada no extrato e o restante dos créditos do TFL também estiver conciliado.**

## Regras fundamentais

1. **Janela de conciliação**: para cada data de fechamento TFL (D), considerar transações no extrato entre D e D+3 dias (inclusive). Para PIX externos, priorizar a data exata (tolerância de 1 dia).

2. **Direção da verificação**: partir sempre do TFL para o extrato. Transações no extrato sem correspondência no TFL são apenas anotadas como "outras origens", sem gerar alerta crítico.

3. **Tolerância de valor**: diferença ≤ R$ 0,02 é considerada conciliada.

4. **Regra específica para sangria**:
   - Cada sangria informada (valor, data) deve encontrar uma transação **CREDIT** no extrato dentro da janela D a D+3.
   - O valor deve ser compatível (± R$ 0,02).
   - Se não encontrada, gerar alerta crítico: "Sangria de R$ X em YYYY-MM-DD não localizada no extrato como depósito."

5. **Regra para PIX externos**:
   - Cada PIX externo (data, valor) deve encontrar uma transação **CREDIT** no extrato na mesma data (ou D+1, justificando na observação).
   - Se não encontrado, alerta crítico.

6. **Verificação de consistência global**:
   - Calcular a soma de todos os PIX externos + soma de todas as sangrias do período.
   - Comparar com os valores de créditos totais do TFL (total_creditos de todos os fechamentos).
   - Se houver diferença significativa (>0,1% ou valor absoluto > R$ 10), emitir alerta de "inconsistência entre créditos totais do TFL e a soma dos itens identificáveis".

## Etapas da conciliação

1. Extrair do TFL os totais de créditos esperados por data/período.
2. Listar todas as transações esperadas:
   - Cada PIX externo (operador e TFL) → tipo CREDIT.
   - Cada sangria (TFL) → tipo CREDIT (depósito).
   - Outros créditos (vendas, etc.) → inferir do total_creditos menos (soma PIX + sangrias).
3. Para cada item esperado, buscar correspondência no extrato OFX (CREDIT) na janela adequada.
4. Classificar status: conciliado, divergente, pendente, não conciliado.
5. Gerar JSON final com alertas específicos.

## Formato de saída
Retorne APENAS JSON, sem markdown, seguindo o schema exato fornecido.
Cada alerta deve mencionar valores e datas.`;

// ─── Função para construir o prompt do usuário ───────────────────────────────

function construirPrompt(dados: ConciliacaoIAPayload): string {
    // PIX externos de operador
    const pixExternosOperador = dados.fechamentosCaixa.flatMap(f =>
        (f.pix_externos_unitarios || []).map(p => ({
            data: p.data_pix,
            valor: p.valor,
            descricao: p.descricao || `PIX operador ${f.operador_nome}`,
            origem: `operador_${f.operador_nome}`,
            sessao_id: f.id
        }))
    );

    // PIX externos de TFL
    const pixExternosTFL = dados.fechamentosTFL.flatMap(f =>
        (f.pix_externos || []).map(p => ({
            data: p.data,
            valor: p.valor,
            descricao: p.descricao || `PIX externo TFL ${f.terminal}`,
            origem: `tfl_${f.terminal}`,
            tfl_id: f.id
        }))
    );

    const todosPixExternos = [...pixExternosOperador, ...pixExternosTFL];
    const somaPixExternos = todosPixExternos.reduce((acc, p) => acc + p.valor, 0);

    // Sangrias (retirada de caixa físico que deve aparecer como crédito no extrato)
    const sangrias = dados.fechamentosTFL
        .filter(f => f.sangria_valor && f.sangria_valor > 0)
        .map(f => ({
            data: f.data_referencia,
            valor: f.sangria_valor!,
            descricao: `Sangria TFL ${f.terminal}`,
            tfl_id: f.id
        }));

    const somaSangrias = sangrias.reduce((acc, s) => acc + s.valor, 0);
    const somaPixMaisSangrias = somaPixExternos + somaSangrias;

    // Totais de créditos do TFL no período
    const totalCreditosTFL = dados.fechamentosTFL.reduce((acc, f) => acc + (f.total_creditos || 0), 0);

    return `
Realize a conciliação bancária fiscal do período ${dados.periodo.inicio} a ${dados.periodo.fim}.

## 1. Extrato OFX (${dados.transacoesOFX.length} transações)
${JSON.stringify(dados.transacoesOFX, null, 2)}

## 2. Fechamentos TFL (${dados.fechamentosTFL.length} registros)
${JSON.stringify(dados.fechamentosTFL, null, 2)}

## 3. PIX Externos Unitários (individuais) - DEVEM SER CRUZADOS COMO CRÉDITOS NO EXTRATO
Total: ${somaPixExternos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
${todosPixExternos.length > 0 ? JSON.stringify(todosPixExternos, null, 2) : 'Nenhum PIX externo unitário informado.'}

## 4. Sangrias (retiradas de caixa físico que devem aparecer como DEPÓSITO/CRÉDITO no extrato)
Total: ${somaSangrias.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
${sangrias.length > 0 ? JSON.stringify(sangrias, null, 2) : 'Nenhuma sangria informada.'}

## 5. Soma dos itens identificáveis (PIX externos + Sangrias)
Total = ${somaPixMaisSangrias.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}

## 6. Total de créditos esperados segundo TFL no período
Total = ${totalCreditosTFL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}

## 7. Fechamentos de Caixa Operador (totais agregados para referência)
${JSON.stringify(dados.fechamentosCaixa, null, 2)}

**Instruções específicas para esta análise:**
- Para **cada PIX externo**, localize no extrato uma transação CREDIT com mesmo valor (±0,02) e data igual ou até 1 dia após.
- Para **cada sangria**, localize no extrato uma transação CREDIT (depósito em espécie) com mesmo valor (±0,02) na janela D a D+3.
- Verifique se a soma (PIX + sangrias) está consistente com os créditos totais do TFL. Se houver diferença relevante, emita alerta.
- Classifique cada item como "conciliado", "divergente" ou "pendente". Se não encontrado, justifique.
- No JSON final, inclua todos os itens (PIX e sangrias) no array "itens_conciliados" com status adequado.

Retorne APENAS o JSON no schema abaixo, sem texto adicional.
`;
}

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

        const userPrompt = construirPrompt(payload);

        // Use um modelo válido (verifique os disponíveis no seu plano)
        const model = anthropic('claude-3-5-sonnet-20241022'); // ou claude-opus-4-5

        const { text } = await generateText({
            model,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
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
