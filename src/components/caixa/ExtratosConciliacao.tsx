'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    RefreshCw, Loader as Loader2, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle,
    Clock, ChevronRight, X, Landmark, TrendingUp, Upload, FileText, Calendar, Check, Search,
    Info, Sparkles, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, Eye, EyeOff, Trash2, Plus,
    CalendarDays, CreditCard, Banknote, Wallet, ArrowDownLeft, ArrowUpRight, Receipt, Coins,
    Filter, Brain, CircleAlert as AlertCircle, Loader
} from 'lucide-react';
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

// ──────────────────────────────────────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────────────────────────────────────

type FonteFechamento = 'caixa_sessoes' | 'fechamento_tfl';

interface FechamentoPendente {
    uid: string;
    id: string;
    fonte: FonteFechamento;
    data_turno: string;
    terminal_id: string;
    operador_nome: string;
    // caixa_sessoes
    resumo_entradas_pix: number;
    resumo_entradas_dinheiro: number;
    resumo_saidas_deposito: number;
    resumo_saidas_sangria: number;
    valor_enviado_cofre: number;
    pix_externo_informado: number;
    resumo_total_entradas: number;
    valor_final_declarado: number;
    diferenca_caixa: number;
    // tfl
    total_creditos: number;
    total_debitos: number;
    saldo_final: number;
    arquivo_nome: string;
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

// ──────────────────────────────────────────────────────────────────────────────
// FUNÇÕES AUXILIARES (BUSCA DETALHADA DE PIX E SANGRIA)
// ──────────────────────────────────────────────────────────────────────────────

async function getPixExternosSessao(sessaoId: string): Promise<PixExternoDetalhado[]> {
    const supabase = createBrowserSupabaseClient();
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
    const supabase = createBrowserSupabaseClient();
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
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
        .from('fechamento_tfl')
        .select('sangria_valor')
        .eq('id', tflId)
        .single();
    if (error) return 0;
    return data?.sangria_valor || 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS GERAIS
// ──────────────────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(dataStr: string): string {
    if (!dataStr) return '-';
    const clean = dataStr.split('T')[0];
    const [y, m, d] = clean.split('-');
    return `${d}/${m}/${y}`;
}

function StatusBadge({ status }: { status: 'pendente' | 'conciliado' | 'divergente' }) {
    if (status === 'conciliado')
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20">
                <CheckCircle2 size={10} /> Conciliado
            </span>
        );
    if (status === 'divergente')
        return (
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

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE: OFXUploadPanel
// ──────────────────────────────────────────────────────────────────────────────

function OFXUploadPanel({
    lojaId,
    contas,
    onImportado,
}: {
    lojaId: string;
    contas: ContaBancaria[];
    onImportado: (dados: OFXDados, arquivoNome: string) => void;
}) {
    const [dragging, setDragging] = useState(false);
    const [processando, setProcessando] = useState(false);
    const [preview, setPreview] = useState<OFXDados | null>(null);
    const [arquivoNome, setArquivoNome] = useState('');
    const [contaSelecionada, setContaSelecionada] = useState(contas[0]?.id ?? '');
    const fileRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    async function processar(file: File) {
        setProcessando(true);
        try {
            const text = await file.text();
            const { parseOFX } = await import('@/lib/ofx-parser');
            const dados = parseOFX(text);
            setPreview(dados);
            setArquivoNome(file.name);
        } catch (e) {
            toast({ type: 'error', message: 'Erro ao ler arquivo OFX. Verifique o formato.' });
            console.error(e);
        } finally {
            setProcessando(false);
        }
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.ofx') || file.name.endsWith('.OFX'))) {
            processar(file);
        } else {
            toast({ type: 'error', message: 'Envie um arquivo .OFX válido.' });
        }
    }

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) processar(file);
    }

    async function confirmarImport() {
        if (!preview || !lojaId) return;
        setProcessando(true);
        try {
            const transacoes = preview.transacoes.map(t => ({
                loja_id: lojaId,
                conta_id: contaSelecionada || undefined,
                fitid: t.fitid,
                tipo: t.tipo,
                data: t.data,
                valor: t.valor,
                memo: t.memo,
                checknum: t.checknum,
            }));
            const { inseridas, duplicadas } = await salvarTransacoesOFX(transacoes, lojaId, arquivoNome);
            toast({
                type: 'success',
                message: `${inseridas} transação(ões) importada(s)${duplicadas > 0 ? `, ${duplicadas} já existia(m)` : ''}.`,
            });
            onImportado(preview, arquivoNome);
            setPreview(null);
        } catch (e) {
            toast({ type: 'error', message: 'Erro ao salvar extrato no banco de dados.' });
            console.error(e);
        } finally {
            setProcessando(false);
        }
    }

    if (preview) {
        const creditos = preview.transacoes.filter(t => t.tipo === 'CREDIT');
        const debitos = preview.transacoes.filter(t => t.tipo === 'DEBIT');
        const totalCreditos = creditos.reduce((a, t) => a + t.valor, 0);
        const totalDebitos = debitos.reduce((a, t) => a + t.valor, 0);

        return (
            <div className="card p-5 space-y-5">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-sm font-bold">Extrato OFX carregado</h3>
                        <p className="text-xs text-muted mt-0.5">{arquivoNome}</p>
                    </div>
                    <button className="btn btn-ghost p-1.5" onClick={() => setPreview(null)}>
                        <X size={14} />
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Banco</p>
                        <p className="text-sm font-bold">{preview.bankid || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Período</p>
                        <p className="text-sm font-bold">{fmtData(preview.dtstart)} – {fmtData(preview.dtend)}</p>
                    </div>
                    <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                        <p className="text-[10px] text-success uppercase tracking-wider mb-1">{creditos.length} Créditos</p>
                        <p className="text-sm font-bold text-success">{fmt(totalCreditos)}</p>
                    </div>
                    <div className="rounded-xl border border-error/20 bg-error/5 p-3">
                        <p className="text-[10px] text-error uppercase tracking-wider mb-1">{debitos.length} Débitos</p>
                        <p className="text-sm font-bold text-error">{fmt(totalDebitos)}</p>
                    </div>
                </div>

                <div className="rounded-xl border border-white/5 overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[var(--card-bg)]">
                            <tr className="border-b border-white/5">
                                <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Data</th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Descrição</th>
                                <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase">Valor</th>
                                <th className="text-center px-3 py-2 text-[10px] font-bold text-muted uppercase">Tipo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.transacoes.map((t, i) => (
                                <tr key={i} className="border-b border-white/3 hover:bg-white/2">
                                    <td className="px-3 py-2">{fmtData(t.data)}</td>
                                    <td className="px-3 py-2 text-muted max-w-[200px] truncate">{t.memo || t.fitid}</td>
                                    <td className={`px-3 py-2 text-right font-mono font-semibold ${t.tipo === 'CREDIT' ? 'text-success' : 'text-error'}`}>
                                        {t.tipo === 'CREDIT' ? '+' : '-'}{fmt(t.valor)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.tipo === 'CREDIT' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                                            {t.tipo === 'CREDIT' ? 'C' : 'D'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {contas.length > 0 && (
                    <div>
                        <label className="block text-xs font-semibold text-muted mb-1.5">Vincular à conta bancária</label>
                        <select
                            className="input w-full text-sm"
                            value={contaSelecionada}
                            onChange={e => setContaSelecionada(e.target.value)}
                        >
                            <option value="">Sem vínculo</option>
                            {contas.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}{c.agencia ? ` — Ag. ${c.agencia}` : ''}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex gap-3">
                    <button className="btn btn-ghost flex-1 text-xs" onClick={() => setPreview(null)}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary flex-1 text-xs"
                        onClick={confirmarImport}
                        disabled={processando}
                    >
                        {processando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        Importar {preview.transacoes.length} transações
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`card p-6 border-2 border-dashed transition-colors cursor-pointer ${dragging ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-white/20'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
        >
            <input ref={fileRef} type="file" accept=".ofx,.OFX" className="hidden" onChange={onFileChange} />
            <div className="flex flex-col items-center text-center gap-3">
                {processando
                    ? <Loader2 size={28} className="animate-spin text-muted" />
                    : <Upload size={28} className="text-muted" />
                }
                <div>
                    <p className="text-sm font-semibold">
                        {processando ? 'Processando arquivo...' : 'Arraste o arquivo OFX aqui'}
                    </p>
                    <p className="text-xs text-muted mt-1">ou clique para selecionar — formato .OFX do banco</p>
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE: TabelaOFX
// ──────────────────────────────────────────────────────────────────────────────

function TabelaOFX({ transacoes }: { transacoes: OFXTransacaoSalva[] }) {
    const [filtro, setFiltro] = useState<'todos' | 'CREDIT' | 'DEBIT' | 'sem_match'>('todos');

    const filtradas = transacoes.filter(t => {
        if (filtro === 'CREDIT') return t.tipo === 'CREDIT';
        if (filtro === 'DEBIT') return t.tipo === 'DEBIT';
        if (filtro === 'sem_match') return !t.conciliado;
        return true;
    });

    if (transacoes.length === 0) return null;

    return (
        <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <FileText size={14} className="text-muted" />
                    <span className="text-xs font-bold">Transações Importadas ({transacoes.length})</span>
                </div>
                <div className="flex gap-1">
                    {(['todos', 'CREDIT', 'DEBIT', 'sem_match'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFiltro(f)}
                            className={`text-[10px] px-2 py-1 rounded font-bold transition-colors ${filtro === f ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground'}`}
                        >
                            {f === 'todos' ? 'Todos' : f === 'CREDIT' ? 'Créditos' : f === 'DEBIT' ? 'Débitos' : 'Sem Match'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="overflow-y-auto max-h-80">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--card-bg)]">
                        <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-2 text-[10px] font-bold text-muted uppercase">Data</th>
                            <th className="text-left px-4 py-2 text-[10px] font-bold text-muted uppercase">Descrição</th>
                            <th className="text-right px-4 py-2 text-[10px] font-bold text-muted uppercase">Valor</th>
                            <th className="text-center px-4 py-2 text-[10px] font-bold text-muted uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtradas.map(t => (
                            <tr key={t.id} className="border-b border-white/3 hover:bg-white/2">
                                <td className="px-4 py-2">{fmtData(t.data)}</td>
                                <td className="px-4 py-2 text-muted max-w-[260px] truncate">{t.memo || t.fitid}</td>
                                <td className={`px-4 py-2 text-right font-mono font-semibold ${t.tipo === 'CREDIT' ? 'text-success' : 'text-error'}`}>
                                    {t.tipo === 'CREDIT' ? '+' : '-'}{fmt(t.valor)}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    {t.conciliado ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/10 text-success">
                                            <Check size={9} /> OK
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted/10 text-muted">
                                            <Clock size={9} /> Pendente
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE: PainelConciliacaoIA
// ──────────────────────────────────────────────────────────────────────────────

const NIVEL_COR = {
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    aviso: 'text-warning bg-warning/10 border-warning/20',
    critico: 'text-error bg-error/10 border-error/20',
} as const;

const TIPO_COR: Record<string, string> = {
    pix: 'text-success',
    deposito: 'text-warning',
    estorno: 'text-error',
    debito: 'text-error',
    outros: 'text-muted',
};

const STATUS_COR: Record<string, string> = {
    conciliado: 'bg-success/10 text-success border-success/20',
    pendente: 'bg-muted/10 text-muted border-muted/20',
    divergente: 'bg-warning/10 text-warning border-warning/20',
    suspeito: 'bg-error/10 text-error border-error/20',
};

function PainelConciliacaoIA({
    resultado,
    onFechar,
}: {
    resultado: ConciliacaoIAResultado;
    onFechar: () => void;
}) {
    const [showItens, setShowItens] = useState(false);

    const StatusIcon = resultado.status_geral === 'aprovado'
        ? ShieldCheck
        : resultado.status_geral === 'aprovado_com_ressalvas'
            ? ShieldAlert
            : ShieldX;

    const statusColor = resultado.status_geral === 'aprovado'
        ? 'text-success border-success/30 bg-success/5'
        : resultado.status_geral === 'aprovado_com_ressalvas'
            ? 'text-warning border-warning/30 bg-warning/5'
            : 'text-error border-error/30 bg-error/5';

    // 🔧 CORREÇÃO: fallback para risco
    const risco = resultado.risco || 'medio';
    const riscoColor = risco === 'baixo'
        ? 'bg-success/10 text-success'
        : risco === 'medio'
            ? 'bg-warning/10 text-warning'
            : 'bg-error/10 text-error';

    const resumo = resultado.resumo_financeiro || {
        total_creditos_ofx: 0,
        total_debitos_ofx: 0,
        total_pix_externos: 0,
        total_depositos_cofre: 0,
        total_estornos: 0,
        saldo_tfl_periodo: 0,
        diferenca_apurada: 0,
    };
    const criticos = (resultado.alertas || []).filter(a => a.nivel === 'critico');
    const avisos = (resultado.alertas || []).filter(a => a.nivel === 'aviso');
    const infos = (resultado.alertas || []).filter(a => a.nivel === 'info');

    return (
        <div className="card p-5 space-y-5">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Sparkles size={16} className="text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold">Conciliação por IA — Auditor Fiscal</h3>
                        <p className="text-[10px] text-muted mt-0.5">Análise gerada pelo agente Claude</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riscoColor}`}>
                        RISCO {risco.toUpperCase()}
                    </span>
                    <button className="btn btn-ghost p-1.5" onClick={onFechar}><X size={14} /></button>
                </div>
            </div>

            <div className={`rounded-xl border p-4 ${statusColor}`}>
                <div className="flex items-center gap-2 mb-2">
                    <StatusIcon size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {resultado.status_geral === 'aprovado' ? 'Aprovado'
                            : resultado.status_geral === 'aprovado_com_ressalvas' ? 'Aprovado com Ressalvas'
                                : 'Rejeitado'}
                    </span>
                </div>
                <p className="text-xs leading-relaxed">{resultado.parecer_geral || 'Sem parecer disponível.'}</p>
            </div>

            <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Resumo Financeiro</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                        <p className="text-[10px] text-success uppercase tracking-wider mb-1">Créditos OFX</p>
                        <p className="text-sm font-bold text-success">{fmt(resumo.total_creditos_ofx)}</p>
                    </div>
                    <div className="rounded-xl border border-error/20 bg-error/5 p-3">
                        <p className="text-[10px] text-error uppercase tracking-wider mb-1">Débitos OFX</p>
                        <p className="text-sm font-bold text-error">{fmt(resumo.total_debitos_ofx)}</p>
                    </div>
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                        <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">PIX Externos</p>
                        <p className="text-sm font-bold text-blue-400">{fmt(resumo.total_pix_externos)}</p>
                    </div>
                    <div className="rounded-xl border border-warning/20 bg-warning/5 p-3">
                        <p className="text-[10px] text-warning uppercase tracking-wider mb-1">Depósitos Cofre</p>
                        <p className="text-sm font-bold text-warning">{fmt(resumo.total_depositos_cofre)}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Estornos</p>
                        <p className="text-sm font-bold">{fmt(resumo.total_estornos)}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Saldo TFL</p>
                        <p className="text-sm font-bold">{fmt(resumo.saldo_tfl_periodo)}</p>
                    </div>
                    <div className={`rounded-xl border p-3 col-span-2 ${Math.abs(resumo.diferenca_apurada) > 0.02 ? 'border-error/30 bg-error/5' : 'border-success/20 bg-success/5'}`}>
                        <p className={`text-[10px] uppercase tracking-wider mb-1 ${Math.abs(resumo.diferenca_apurada) > 0.02 ? 'text-error' : 'text-success'}`}>
                            Diferença Apurada
                        </p>
                        <p className={`text-sm font-bold ${Math.abs(resumo.diferenca_apurada) > 0.02 ? 'text-error' : 'text-success'}`}>
                            {fmt(resumo.diferenca_apurada)}
                        </p>
                    </div>
                </div>
            </div>

            {resultado.alertas && resultado.alertas.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Alertas</p>
                    {[...criticos, ...avisos, ...infos].map((alerta, i) => (
                        <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${NIVEL_COR[alerta.nivel]}`}>
                            {alerta.nivel === 'critico' ? <ShieldX size={12} className="mt-0.5 shrink-0" />
                                : alerta.nivel === 'aviso' ? <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                    : <Info size={12} className="mt-0.5 shrink-0" />}
                            <p className="text-xs">{alerta.mensagem}</p>
                        </div>
                    ))}
                </div>
            )}

            {resultado.itens_conciliados && resultado.itens_conciliados.length > 0 && (
                <div>
                    <button
                        className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider hover:text-foreground transition-colors"
                        onClick={() => setShowItens(v => !v)}
                    >
                        <ChevronDown size={12} className={`transition-transform ${showItens ? 'rotate-180' : ''}`} />
                        Itens Conciliados ({resultado.itens_conciliados.length})
                    </button>
                    {showItens && (
                        <div className="mt-3 rounded-xl border border-white/5 overflow-hidden">
                            <div className="overflow-y-auto max-h-72">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[var(--card-bg)]">
                                        <tr className="border-b border-white/5">
                                            <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Data</th>
                                            <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Tipo</th>
                                            <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Descrição</th>
                                            <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase">Valor</th>
                                            <th className="text-center px-3 py-2 text-[10px] font-bold text-muted uppercase">Status</th>
                                        </table>
                                    </thead>
                                    <tbody>
                                        {resultado.itens_conciliados.map((item, i) => (
                                            <tr key={i} className="border-b border-white/3 hover:bg-white/2">
                                                <td className="px-3 py-2">{fmtData(item.data)}</td>
                                                <td className={`px-3 py-2 font-semibold capitalize ${TIPO_COR[item.tipo] ?? 'text-muted'}`}>{item.tipo}</td>
                                                <td className="px-3 py-2 text-muted max-w-[200px] truncate" title={item.observacao ?? item.descricao_ofx}>
                                                    {item.descricao_ofx}
                                                    {item.observacao && (
                                                        <span className="block text-[9px] text-warning truncate">{item.observacao}</span>
                                                    )}
                                                </td>
                                                <td className={`px-3 py-2 text-right font-mono font-semibold ${TIPO_COR[item.tipo] ?? ''}`}>
                                                    {fmt(item.valor)}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COR[item.status]}`}>
                                                        {item.status === 'conciliado' ? 'OK'
                                                            : item.status === 'pendente' ? 'Pend.'
                                                                : item.status === 'divergente' ? 'Diverg.'
                                                                    : 'Suspeito'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {resultado.recomendacoes && resultado.recomendacoes.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Recomendações</p>
                    {resultado.recomendacoes.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{rec}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-xl border border-white/5 bg-white/2 px-4 py-3">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Conclusão do Auditor</p>
                <p className="text-xs font-semibold">{resultado.conclusao || 'Conciliação finalizada.'}</p>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE: TabelaFechamentos
// ──────────────────────────────────────────────────────────────────────────────

function TabelaFechamentos({
    fechamentos,
    selectedIds = [],
    onToggleSelect,
    onSelectAll,
}: {
    fechamentos: FechamentoPendente[];
    selectedIds?: string[];
    onToggleSelect?: (uid: string) => void;
    onSelectAll?: (selected: boolean) => void;
}) {
    const [aberto, setAberto] = useState<string | null>(null);

    const allSelected = fechamentos.length > 0 && fechamentos.every(f => selectedIds.includes(f.uid));
    const someSelected = selectedIds.length > 0 && !allSelected;

    if (fechamentos.length === 0) {
        return (
            <div className="card p-12 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-3 text-success opacity-50" />
                <p className="text-sm font-semibold">Nenhum fechamento pendente de auditoria</p>
                <p className="text-xs text-muted mt-1">Todos os fechamentos foram auditados.</p>
            </div>
        );
    }

    const totalEntradas = fechamentos.reduce((a, f) => a + (f.resumo_total_entradas ?? 0), 0);
    const totalCofre = fechamentos.reduce((a, f) => a + (f.valor_enviado_cofre ?? 0), 0);
    const totalPix = fechamentos.reduce((a, f) => a + (f.pix_externo_informado ?? 0), 0);

    return (
        <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onSelectAll && (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-primary"
                                checked={allSelected}
                                ref={input => {
                                    if (input) input.indeterminate = someSelected;
                                }}
                                onChange={(e) => onSelectAll(e.target.checked)}
                            />
                            <span className="text-[10px] text-muted">Todos</span>
                        </label>
                    )}
                    <div className="flex items-center gap-2">
                        <Search size={13} className="text-muted" />
                        <span className="text-xs font-bold">Fechamentos Pendentes de Auditoria ({fechamentos.length})</span>
                    </div>
                </div>
                <div className="flex gap-4 text-[10px] text-muted">
                    <span>PIX Ext.: <span className="font-bold text-foreground">{fmt(totalPix)}</span></span>
                    <span>Cofre: <span className="font-bold text-foreground">{fmt(totalCofre)}</span></span>
                    <span>Total: <span className="font-bold text-foreground">{fmt(totalEntradas)}</span></span>
                </div>
            </div>
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-white/5">
                        {onToggleSelect && <th className="w-8 px-2 py-3"></th>}
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase">Tipo</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase">Data / Terminal</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase">Operador / Arquivo</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase">PIX Externo</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase">Depósito Cofre</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase">Total / Saldo</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {fechamentos.map((f) => {
                        const isTFL = f.fonte === 'fechamento_tfl';
                        const isOpen = aberto === f.uid;
                        const valorPrincipal = isTFL ? f.saldo_final : f.resumo_total_entradas;
                        const isSelected = selectedIds.includes(f.uid);
                        return (
                            <React.Fragment key={f.uid}>
                                <tr
                                    className="border-b border-white/3 hover:bg-white/2 cursor-pointer transition-colors"
                                    onClick={() => setAberto(isOpen ? null : f.uid)}
                                >
                                    {onToggleSelect && (
                                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-primary"
                                                checked={isSelected}
                                                onChange={() => onToggleSelect(f.uid)}
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        {isTFL ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                                                <FileText size={9} /> TFL
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                OP
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={11} className="text-muted" />
                                            <div>
                                                <p className="font-semibold">{fmtData(f.data_turno)}</p>
                                                <p className="text-muted text-[10px]">{f.terminal_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted max-w-[160px] truncate">
                                        {isTFL ? (f.arquivo_nome || '—') : (f.operador_nome || '—')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {isTFL ? (
                                            <span className="text-muted">—</span>
                                        ) : (
                                            <span className={f.pix_externo_informado > 0 ? 'text-blue-400 font-semibold' : 'text-muted'}>
                                                {fmt(f.pix_externo_informado)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {isTFL ? (
                                            <span className="text-muted">—</span>
                                        ) : (
                                            <span className={f.valor_enviado_cofre > 0 ? 'text-warning font-semibold' : 'text-muted'}>
                                                {fmt(f.valor_enviado_cofre)}
                                            </span>
                                        )}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono font-semibold ${(valorPrincipal ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {fmt(valorPrincipal)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <ChevronRight size={13} className={`text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                    </td>
                                </tr>
                                {isOpen && (
                                    <tr className="bg-white/1">
                                        <td colSpan={onToggleSelect ? 8 : 7} className="px-6 py-4">
                                            {isTFL ? (
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                                                        <p className="text-[10px] text-success uppercase tracking-wider mb-1">Créditos TFL</p>
                                                        <p className="text-sm font-bold text-success">{fmt(f.total_creditos)}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-danger/20 bg-danger/5 p-3">
                                                        <p className="text-[10px] text-danger uppercase tracking-wider mb-1">Débitos TFL</p>
                                                        <p className="text-sm font-bold text-danger">{fmt(f.total_debitos)}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Saldo Final</p>
                                                        <p className="text-sm font-bold">{fmt(f.saldo_final)}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">PIX Entradas</p>
                                                        <p className="text-sm font-bold">{fmt(f.resumo_entradas_pix)}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Dinheiro</p>
                                                        <p className="text-sm font-bold">{fmt(f.resumo_entradas_dinheiro)}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Sangrias</p>
                                                        <p className="text-sm font-bold">{fmt(f.resumo_saidas_sangria)}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Diferença Caixa</p>
                                                        <p className={`text-sm font-bold ${(f.diferenca_caixa ?? 0) !== 0 ? 'text-warning' : 'text-success'}`}>
                                                            {fmt(f.diferenca_caixa)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: ExtratosConciliacao (MODIFICADO)
// ──────────────────────────────────────────────────────────────────────────────

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
    const supabase = createBrowserSupabaseClient();

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
    }, [supabase, toast, lojaId]);

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

            // Busca detalhada para TFL
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

            // Busca detalhada para CAIXA SESSÕES
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
