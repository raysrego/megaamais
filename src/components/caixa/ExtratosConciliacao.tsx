'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Loader as Loader2, ArrowRightLeft, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Clock, ChevronRight, X, Landmark, TrendingUp, Upload, FileText, Calendar, Check, Search, CircleAlert, Info, Sparkles, ShieldCheck, ShieldAlert, ShieldX, ChevronDown } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import React from 'react';
import { useToast } from '@/contexts/ToastContext';
import { getFechamentosAuditoria } from '@/actions/auditoria';
import {
    salvarTransacoesOFX,
    getTransacoesOFX,
    type OFXTransacaoSalva,
} from '@/actions/extrato-conciliacao';
import type { OFXDados } from '@/lib/ofx-parser';
import type { ConciliacaoIAResultado } from '@/app/api/caixa/conciliacao-ia/route';
import { useLoja } from '@/contexts/LojaContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type FonteFechamento = 'caixa_sessoes' | 'fechamento_tfl';

interface FechamentoPendente {
    uid: string; // fonte + id
    id: string;
    fonte: FonteFechamento;
    data_turno: string;
    terminal_id: string;
    operador_nome: string;
    // caixa_sessoes fields
    resumo_entradas_pix: number;
    resumo_entradas_dinheiro: number;
    resumo_saidas_deposito: number;
    resumo_saidas_sangria: number;
    valor_enviado_cofre: number;
    pix_externo_informado: number;
    resumo_total_entradas: number;
    valor_final_declarado: number;
    diferenca_caixa: number;
    // tfl fields
    total_creditos: number;
    total_debitos: number;
    saldo_final: number;
    arquivo_nome: string;
    // shared
    auditoria_status: string;
    loja_id: string;
}

interface ContaBancaria {
    id: string;
    nome: string;
    agencia: string;
    conta_numero: string;
}

interface PixExternoDetalhado {
    data: string;
    valor: number;
    descricao: string;
}

// ─── Funções auxiliares para buscar detalhes (PIX e sangria) ─────────────────

const supabase = createBrowserSupabaseClient();

async function getPixExternosSessao(sessaoId: string): Promise<PixExternoDetalhado[]> {
    const { data, error } = await supabase
        .from('pix_externos_sessao')
        .select('data_pix, valor, descricao')
        .eq('sessao_id', parseInt(sessaoId))
        .order('data_pix', { ascending: true });
    if (error) {
        console.error('Erro ao buscar PIX externos da sessão:', error);
        return [];
    }
    return (data || []).map(p => ({ data: p.data_pix, valor: p.valor, descricao: p.descricao || '' }));
}

async function getPixExternosTFL(tflId: string): Promise<PixExternoDetalhado[]> {
    const { data, error } = await supabase
        .from('pix_externos_tfl')
        .select('data, valor, descricao')
        .eq('tfl_id', tflId)
        .order('data', { ascending: true });
    if (error) {
        console.error('Erro ao buscar PIX externos do TFL:', error);
        return [];
    }
    return (data || []).map(p => ({ data: p.data, valor: p.valor, descricao: p.descricao || '' }));
}

async function getSangriaTFL(tflId: string): Promise<number> {
    const { data, error } = await supabase
        .from('fechamento_tfl')
        .select('sangria_valor')
        .eq('id', tflId)
        .single();
    if (error) return 0;
    return data?.sangria_valor || 0;
}

// ─── Helpers (mesmos do código original) ──────────────────────────────────────

function fmt(v: number | null | undefined) {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(dataStr: string) {
    if (!dataStr) return '-';
    const clean = dataStr.split('T')[0];
    const [y, m, d] = clean.split('-');
    return `${d}/${m}/${y}`;
}

function StatusBadge({ status }: { status: 'pendente' | 'conciliado' | 'divergente' }) {
    if (status === 'conciliado') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20">
            <CheckCircle2 size={10} /> Conciliado
        </span>
    );
    if (status === 'divergente') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">
            <AlertTriangle size={10} /> Divergente
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/10 text-muted border border-muted/20">
            <Clock size={10} /> Pendente
        </span>
    );
}

// ─── OFXUploadPanel (idêntico ao original, sem alterações) ────────────────────
// ... (mantenha o mesmo código do componente OFXUploadPanel do original)

// ─── TabelaOFX (idêntico ao original) ─────────────────────────────────────────
// ... (mantenha o mesmo código do componente TabelaOFX)

// ─── PainelConciliacaoIA (idêntico ao original) ───────────────────────────────
// ... (mantenha o mesmo código do componente PainelConciliacaoIA)

// ─── TabelaFechamentos (idêntico ao original) ─────────────────────────────────
// ... (mantenha o mesmo código do componente TabelaFechamentos)

// ─── Main Component Modificado ─────────────────────────────────────────────────

export function ExtratosConciliacao() {
    const { lojaAtual } = useLoja();
    const lojaId = lojaAtual?.id ?? '';

    const [fechamentos, setFechamentos] = useState<FechamentoPendente[]>([]);
    const [transacoesOFX, setTransacoesOFX] = useState<OFXTransacaoSalva[]>([]);
    const [contas, setContas] = useState<ContaBancaria[]>([]);
    const [loading, setLoading] = useState(true);
    const [processando, setProcessando] = useState(false);
    const [resultado, setResultado] = useState<ConciliacaoIAResultado | null>(null);
    const [selectedFechamentoIds, setSelectedFechamentoIds] = useState<string[]>([]);
    const { toast } = useToast();

    // Instância do supabase já criada fora do componente para evitar múltiplas chamadas
    // Mas como usamos a mesma em todo lugar, mantemos a referência.

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const [sessoesRaw, { data: tflRaw }, { data: contasData }] = await Promise.all([
                getFechamentosAuditoria({ status: 'pendente' }),
                supabase
                    .from('fechamento_tfl')
                    .select('id, data_referencia, terminal, total_creditos, total_debitos, saldo_final, arquivo_nome, status_auditoria, loja_id')
                    .eq('status_auditoria', 'pendente')
                    .order('data_referencia', { ascending: false })
                    .limit(100),
                supabase.from('financeiro_contas_bancarias').select('id, nome, agencia, conta_numero').eq('ativo', true),
            ]);

            const deSessoes: FechamentoPendente[] = (sessoesRaw as any[]).map(f => ({
                uid: `sessao-${f.id}`,
                id: String(f.id),
                fonte: 'caixa_sessoes' as FonteFechamento,
                data_turno: f.data_turno || '',
                terminal_id: f.terminal_id || '—',
                operador_nome: f.operador_nome || '—',
                resumo_entradas_pix: f.resumo_entradas_pix || 0,
                resumo_entradas_dinheiro: f.resumo_entradas_dinheiro || 0,
                resumo_saidas_deposito: f.resumo_saidas_deposito || 0,
                resumo_saidas_sangria: f.resumo_saidas_sangria || 0,
                valor_enviado_cofre: f.valor_enviado_cofre || 0,
                pix_externo_informado: f.pix_externo_informado || 0,
                resumo_total_entradas: f.resumo_total_entradas || 0,
                valor_final_declarado: f.valor_final_declarado || 0,
                diferenca_caixa: f.diferenca_caixa || 0,
                total_creditos: 0,
                total_debitos: 0,
                saldo_final: 0,
                arquivo_nome: '',
                auditoria_status: f.auditoria_status || 'pendente',
                loja_id: f.loja_id || '',
            }));

            const deTFL: FechamentoPendente[] = (tflRaw ?? []).map((r: any) => ({
                uid: `tfl-${r.id}`,
                id: String(r.id),
                fonte: 'fechamento_tfl' as FonteFechamento,
                data_turno: r.data_referencia || '',
                terminal_id: r.terminal || '—',
                operador_nome: r.arquivo_nome || '—',
                resumo_entradas_pix: 0,
                resumo_entradas_dinheiro: 0,
                resumo_saidas_deposito: 0,
                resumo_saidas_sangria: 0,
                valor_enviado_cofre: 0,
                pix_externo_informado: 0,
                resumo_total_entradas: r.total_creditos || 0,
                valor_final_declarado: r.saldo_final || 0,
                diferenca_caixa: 0,
                total_creditos: r.total_creditos || 0,
                total_debitos: r.total_debitos || 0,
                saldo_final: r.saldo_final || 0,
                arquivo_nome: r.arquivo_nome || '',
                auditoria_status: r.status_auditoria || 'pendente',
                loja_id: r.loja_id || '',
            }));

            const todos = [...deSessoes, ...deTFL].sort((a, b) =>
                (b.data_turno || '').localeCompare(a.data_turno || '')
            );

            setFechamentos(todos);
            setContas((contasData ?? []) as ContaBancaria[]);

            if (todos.length > 0 && lojaId) {
                const datas = todos.map(f => f.data_turno).filter(Boolean).sort();
                const transacoes = await getTransacoesOFX(lojaId, datas[0], datas[datas.length - 1]);
                setTransacoesOFX(transacoes);
            }

            setSelectedFechamentoIds([]);
        } catch (err) {
            toast({ type: 'error', message: 'Erro ao carregar dados.' });
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [toast, lojaId]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    const toggleSelect = (uid: string) => {
        setSelectedFechamentoIds(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const selectAll = (select: boolean) => {
        setSelectedFechamentoIds(select ? fechamentos.map(f => f.uid) : []);
    };

    async function fazerConciliacaoIA() {
        if (!lojaId) {
            toast({ type: 'error', message: 'Selecione uma loja para continuar.' });
            return;
        }
        if (transacoesOFX.length === 0) {
            toast({ type: 'warning', message: 'Importe um extrato OFX antes de conciliar.' });
            return;
        }
        if (selectedFechamentoIds.length === 0) {
            toast({ type: 'warning', message: 'Selecione pelo menos um fechamento para conciliar.' });
            return;
        }

        setProcessando(true);
        setResultado(null);
        try {
            const fechamentosSelecionados = fechamentos.filter(f => selectedFechamentoIds.includes(f.uid));

            // Para cada fechamento TFL, buscar PIX externos unitários e sangria
            const fechamentosTFLComDetalhes = await Promise.all(
                fechamentosSelecionados
                    .filter(f => f.fonte === 'fechamento_tfl')
                    .map(async (f) => ({
                        id: f.id,
                        data_referencia: f.data_turno,
                        terminal: f.terminal_id,
                        arquivo_nome: f.arquivo_nome,
                        total_creditos: f.total_creditos,
                        total_debitos: f.total_debitos,
                        saldo_final: f.saldo_final,
                        pix_externos: await getPixExternosTFL(f.id),
                        sangria_valor: await getSangriaTFL(f.id),
                    }))
            );

            // Para cada fechamento de operador, buscar PIX externos unitários da sessão
            const fechamentosCaixaComDetalhes = await Promise.all(
                fechamentosSelecionados
                    .filter(f => f.fonte === 'caixa_sessoes')
                    .map(async (f) => ({
                        id: f.id,
                        data_turno: f.data_turno,
                        terminal_id: f.terminal_id,
                        operador_nome: f.operador_nome,
                        resumo_entradas_pix: f.resumo_entradas_pix,
                        resumo_entradas_dinheiro: f.resumo_entradas_dinheiro,
                        resumo_saidas_sangria: f.resumo_saidas_sangria,
                        resumo_saidas_deposito: f.resumo_saidas_deposito,
                        valor_enviado_cofre: f.valor_enviado_cofre,
                        pix_externo_informado: f.pix_externo_informado,
                        resumo_total_entradas: f.resumo_total_entradas,
                        valor_final_declarado: f.valor_final_declarado,
                        diferenca_caixa: f.diferenca_caixa,
                        pix_externos_unitarios: await getPixExternosSessao(f.id),
                        // Nota: não há campo específico para sangria manual na caixa_sessoes além do resumo_saidas_sangria
                        sangria_valor: f.resumo_saidas_sangria,
                    }))
            );

            const datas = [
                ...transacoesOFX.map(t => t.data),
                ...fechamentosSelecionados.map(f => f.data_turno).filter(Boolean),
            ].sort();
            const inicio = datas[0] ?? '';
            const fim = datas[datas.length - 1] ?? '';

            const response = await fetch('/api/caixa/conciliacao-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lojaId,
                    periodo: { inicio, fim },
                    transacoesOFX: transacoesOFX.map(t => ({
                        fitid: t.fitid,
                        tipo: t.tipo,
                        data: t.data,
                        valor: t.valor,
                        memo: t.memo,
                    })),
                    fechamentosTFL: fechamentosTFLComDetalhes,
                    fechamentosCaixa: fechamentosCaixaComDetalhes,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error ?? 'Erro na API');
            }

            const res: ConciliacaoIAResultado = await response.json();
            setResultado(res);
            toast({
                type: res.status_geral === 'rejeitado' ? 'error'
                    : res.status_geral === 'aprovado_com_ressalvas' ? 'warning' : 'success',
                message: `Conciliação IA concluída — ${res.status_geral === 'aprovado' ? 'Aprovado' : res.status_geral === 'aprovado_com_ressalvas' ? 'Aprovado com ressalvas' : 'Rejeitado'}.`,
            });
        } catch (err) {
            toast({ type: 'error', message: 'Erro ao executar conciliação por IA.' });
            console.error(err);
        } finally {
            setProcessando(false);
        }
    }

    const totalPendentes = fechamentos.length;
    const totalOFX = transacoesOFX.length;
    const ofxConciliados = transacoesOFX.filter(t => t.conciliado).length;
    const totalCreditosOFX = transacoesOFX.filter(t => t.tipo === 'CREDIT').reduce((a, t) => a + t.valor, 0);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold">Extratos & Conciliação Bancária</h2>
                    <p className="text-xs text-muted mt-0.5">
                        Selecione os fechamentos e use o auditor IA para cruzar com o extrato OFX
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-ghost text-xs" onClick={carregarDados} disabled={loading}>
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </button>
                    <button
                        className="btn btn-primary text-xs"
                        onClick={fazerConciliacaoIA}
                        disabled={processando || totalOFX === 0 || selectedFechamentoIds.length === 0}
                    >
                        {processando
                            ? <><Loader2 size={13} className="animate-spin" /> Analisando...</>
                            : <><Sparkles size={13} /> Conciliar {selectedFechamentoIds.length} selecionado(s)</>
                        }
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-muted/10 flex items-center justify-center">
                            <Clock size={13} className="text-muted" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Fechamentos Pend.</span>
                    </div>
                    <p className="text-2xl font-bold">{totalPendentes}</p>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FileText size={13} className="text-blue-400" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Transações OFX</span>
                    </div>
                    <p className="text-2xl font-bold">{totalOFX}</p>
                    {ofxConciliados > 0 && <p className="text-[10px] text-success mt-0.5">{ofxConciliados} conciliadas</p>}
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                            <TrendingUp size={13} className="text-success" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Total Créditos OFX</span>
                    </div>
                    <p className="text-sm font-bold">{fmt(totalCreditosOFX)}</p>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
                            <Landmark size={13} className="text-warning" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Depósitos Cofre</span>
                    </div>
                    <p className="text-sm font-bold">
                        {fmt(fechamentos.reduce((a, f) => a + (f.valor_enviado_cofre ?? 0), 0))}
                    </p>
                </div>
            </div>

            {/* Upload OFX */}
            {lojaId ? (
                <OFXUploadPanel
                    lojaId={lojaId}
                    contas={contas}
                    onImportado={async () => { await carregarDados(); }}
                />
            ) : (
                <div className="card p-6 text-center">
                    <p className="text-xs text-muted">Selecione uma loja para importar o extrato OFX.</p>
                </div>
            )}

            {/* Resultado da conciliação IA */}
            {resultado && (
                <PainelConciliacaoIA
                    resultado={resultado}
                    onFechar={() => setResultado(null)}
                />
            )}

            {/* Transações OFX importadas */}
            {transacoesOFX.length > 0 && <TabelaOFX transacoes={transacoesOFX} />}

            {/* Fechamentos pendentes com seleção */}
            <TabelaFechamentos
                fechamentos={fechamentos}
                selectedIds={selectedFechamentoIds}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
            />
        </div>
    );
}
