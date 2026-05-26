'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PixExternoInput {
    sessao_id: number;
    loja_id: string;
    valor: number;
    data_pix: string; // YYYY-MM-DD
    descricao?: string;
}

export interface PixExterno {
    id: number;
    sessao_id: number;
    loja_id: string;
    valor: number;
    data_pix: string;
    descricao: string;
    fitid_ofx: string | null;
    conciliado: boolean;
    created_by: string;
    created_at: string;
}

export interface OFXTransacaoInput {
    loja_id: string;
    conta_id?: string;
    fitid: string;
    tipo: 'CREDIT' | 'DEBIT';
    data: string; // YYYY-MM-DD
    valor: number;
    memo: string;
    checknum: string;
    arquivo_nome?: string;
}

export interface OFXTransacaoSalva {
    id: number;
    loja_id: string;
    conta_id: string | null;
    fitid: string;
    tipo: 'CREDIT' | 'DEBIT';
    data: string;
    valor: number;
    memo: string;
    checknum: string;
    conciliado: boolean;
    matched_tipo: string | null;
    matched_ref_id: number | null;
    arquivo_nome: string;
    importado_em: string;
    importado_por: string | null;
}

export interface ResultadoConciliacao {
    total_ofx: number;
    total_pix_externos: number;
    total_depositos_cofre: number;
    pix_conciliados: number;
    depositos_conciliados: number;
    pix_nao_encontrados: OFXTransacaoSalva[];
    depositos_nao_encontrados: OFXTransacaoSalva[];
    pix_extras_sistema: PixExterno[];
    depositos_divergentes: { cofre_id: number; valor_cofre: number; valor_ofx: number; data: string }[];
}

// ─── PIX Externos ─────────────────────────────────────────────────────────────

export async function adicionarPixExterno(input: PixExternoInput): Promise<PixExterno> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const { data, error } = await supabase
        .from('pix_externos_sessao')
        .insert({
            sessao_id: input.sessao_id,
            loja_id: input.loja_id,
            valor: input.valor,
            data_pix: input.data_pix,
            descricao: input.descricao ?? '',
            created_by: user.id,
        })
        .select()
        .single();

    if (error) throw new Error(`Erro ao adicionar PIX externo: ${error.message}`);

    revalidatePath('/caixa');
    return data as PixExterno;
}

export async function removerPixExterno(id: number): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const { error } = await supabase
        .from('pix_externos_sessao')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Erro ao remover PIX externo: ${error.message}`);
    revalidatePath('/caixa');
}

export async function getPixExternosPorSessao(sessaoId: number): Promise<PixExterno[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('pix_externos_sessao')
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('data_pix', { ascending: true });

    if (error) throw new Error(`Erro ao buscar PIX externos: ${error.message}`);
    return (data ?? []) as PixExterno[];
}

// ─── OFX Transações ───────────────────────────────────────────────────────────

export async function salvarTransacoesOFX(
    transacoes: OFXTransacaoInput[],
    lojaId: string,
    arquivoNome: string
): Promise<{ inseridas: number; duplicadas: number }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const rows = transacoes.map(t => ({
        loja_id: lojaId,
        conta_id: t.conta_id ?? null,
        fitid: t.fitid,
        tipo: t.tipo,
        data: t.data,
        valor: t.valor,
        memo: t.memo,
        checknum: t.checknum,
        arquivo_nome: arquivoNome,
        importado_por: user.id,
    }));

    // Upsert by (loja_id, fitid) — ignora duplicatas do mesmo arquivo
    const { data, error } = await supabase
        .from('ofx_transacoes')
        .upsert(rows, { onConflict: 'loja_id,fitid', ignoreDuplicates: true })
        .select('id');

    if (error) throw new Error(`Erro ao salvar transações OFX: ${error.message}`);

    const inseridas = data?.length ?? 0;
    const duplicadas = transacoes.length - inseridas;

    revalidatePath('/caixa');
    return { inseridas, duplicadas };
}

export async function getTransacoesOFX(
    lojaId: string,
    dataInicio?: string,
    dataFim?: string
): Promise<OFXTransacaoSalva[]> {
    const supabase = await createClient();

    let query = supabase
        .from('ofx_transacoes')
        .select('*')
        .eq('loja_id', lojaId)
        .order('data', { ascending: true });

    if (dataInicio) query = query.gte('data', dataInicio);
    if (dataFim) query = query.lte('data', dataFim);

    const { data, error } = await query.limit(500);
    if (error) throw new Error(`Erro ao buscar transações OFX: ${error.message}`);
    return (data ?? []) as OFXTransacaoSalva[];
}

// ─── Conciliação Detalhada ────────────────────────────────────────────────────

export async function executarConciliacaoDetalhada(
    lojaId: string,
    dataInicio: string,
    dataFim: string
): Promise<ResultadoConciliacao> {
    const supabase = await createClient();

    // Buscar transações OFX do período
    const { data: ofxRaw, error: ofxError } = await supabase
        .from('ofx_transacoes')
        .select('*')
        .eq('loja_id', lojaId)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .eq('tipo', 'CREDIT')
        .order('data', { ascending: true });

    if (ofxError) throw new Error(`Erro ao buscar OFX: ${ofxError.message}`);
    const ofxCreditos = (ofxRaw ?? []) as OFXTransacaoSalva[];

    // Buscar PIX externos do sistema no período
    const { data: pixRaw, error: pixError } = await supabase
        .from('pix_externos_sessao')
        .select('*')
        .eq('loja_id', lojaId)
        .gte('data_pix', dataInicio)
        .lte('data_pix', dataFim)
        .order('data_pix', { ascending: true });

    if (pixError) throw new Error(`Erro ao buscar PIX externos: ${pixError.message}`);
    const pixExternos = (pixRaw ?? []) as PixExterno[];

    // Buscar depósitos do cofre no período
    const { data: cofreRaw, error: cofreError } = await supabase
        .from('cofre_movimentacoes')
        .select('id, valor, data_deposito, data_movimentacao, conta_bancaria_id')
        .eq('loja_id', lojaId)
        .eq('tipo', 'saida_deposito')
        .gte('data_movimentacao', `${dataInicio}T00:00:00`)
        .lte('data_movimentacao', `${dataFim}T23:59:59`);

    if (cofreError) throw new Error(`Erro ao buscar depósitos cofre: ${cofreError.message}`);
    const depositosCofre = cofreRaw ?? [];

    // Cruzamento: PIX externos vs OFX créditos
    const pixConciliados: number[] = [];
    const pixNaoEncontrados: OFXTransacaoSalva[] = [];
    const ofxUsados = new Set<number>();

    for (const pix of pixExternos) {
        const match = ofxCreditos.find(ofx =>
            !ofxUsados.has(ofx.id) &&
            ofx.data === pix.data_pix &&
            Math.abs(ofx.valor - pix.valor) < 0.02
        );

        if (match) {
            pixConciliados.push(pix.id);
            ofxUsados.add(match.id);

            // Marcar como conciliado no DB
            await supabase
                .from('ofx_transacoes')
                .update({ conciliado: true, matched_tipo: 'pix_externo', matched_ref_id: pix.id })
                .eq('id', match.id);

            await supabase
                .from('pix_externos_sessao')
                .update({ conciliado: true, fitid_ofx: match.fitid })
                .eq('id', pix.id);
        }
    }

    // PIX externos sem correspondência no OFX
    const pixExtrasSistema = pixExternos.filter(p => !pixConciliados.includes(p.id));

    // OFX créditos sem correspondência (possíveis PIX não registrados)
    const ofxSemMatch = ofxCreditos.filter(o => !ofxUsados.has(o.id) && !o.conciliado);
    for (const ofx of ofxSemMatch) {
        pixNaoEncontrados.push(ofx);
    }

    // Cruzamento: depósitos cofre vs OFX (verificar valores próximos)
    const depositosConciliados: number[] = [];
    const depositosNaoConciliados: OFXTransacaoSalva[] = [];
    const depositosDivergentes: ResultadoConciliacao['depositos_divergentes'] = [];

    for (const dep of depositosCofre) {
        const dataDeposito = dep.data_deposito
            ? dep.data_deposito.split('T')[0]
            : dep.data_movimentacao.split('T')[0];

        const match = ofxCreditos.find(ofx =>
            !ofxUsados.has(ofx.id) &&
            ofx.data === dataDeposito &&
            Math.abs(ofx.valor - dep.valor) < 0.02
        );

        if (match) {
            depositosConciliados.push(dep.id);
            ofxUsados.add(match.id);

            await supabase
                .from('ofx_transacoes')
                .update({ conciliado: true, matched_tipo: 'deposito_cofre', matched_ref_id: dep.id })
                .eq('id', match.id);
        } else {
            // Verifica se tem mesmo dia mas valor diferente (divergência)
            const mesmo_dia = ofxCreditos.find(o => !ofxUsados.has(o.id) && o.data === dataDeposito);
            if (mesmo_dia) {
                depositosDivergentes.push({
                    cofre_id: dep.id,
                    valor_cofre: dep.valor,
                    valor_ofx: mesmo_dia.valor,
                    data: dataDeposito,
                });
            }
        }
    }

    // OFX depósitos sem correspondência
    ofxCreditos
        .filter(o => !ofxUsados.has(o.id) && !o.conciliado)
        .forEach(o => depositosNaoConciliados.push(o));

    revalidatePath('/caixa');

    return {
        total_ofx: ofxCreditos.length,
        total_pix_externos: pixExternos.length,
        total_depositos_cofre: depositosCofre.length,
        pix_conciliados: pixConciliados.length,
        depositos_conciliados: depositosConciliados.length,
        pix_nao_encontrados: pixNaoEncontrados,
        depositos_nao_encontrados: depositosNaoConciliados,
        pix_extras_sistema: pixExtrasSistema,
        depositos_divergentes: depositosDivergentes,
    };
}
