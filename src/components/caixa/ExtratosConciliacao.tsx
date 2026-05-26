'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Loader as Loader2, ArrowRightLeft, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Clock, ChevronRight, X, Landmark, Banknote, CreditCard, TrendingUp, Upload, FileText, Calendar, Check, Search, CircleAlert, Info } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import { getFechamentosAuditoria } from '@/actions/auditoria';
import {
    salvarTransacoesOFX,
    getTransacoesOFX,
    executarConciliacaoDetalhada,
    type OFXTransacaoSalva,
    type ResultadoConciliacao,
} from '@/actions/extrato-conciliacao';
import type { OFXDados } from '@/lib/ofx-parser';
import { useLoja } from '@/contexts/LojaContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type FonteFechamento = 'caixa_sessoes' | 'fechamento_tfl';

interface FechamentoPendente {
    uid: string; // fonte + id, unique key for rendering
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── OFX Upload Panel ─────────────────────────────────────────────────────────

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

                {/* Resumo do arquivo */}
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

                {/* Tabela de transações */}
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

// ─── Resultado de Conciliação ─────────────────────────────────────────────────

function ResultadoConciliacaoPanel({ resultado, onFechar }: {
    resultado: ResultadoConciliacao;
    onFechar: () => void;
}) {
    const total = resultado.total_ofx;
    const conciliados = resultado.pix_conciliados + resultado.depositos_conciliados;
    const percentual = total > 0 ? Math.round((conciliados / total) * 100) : 0;

    return (
        <div className="card p-5 space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Resultado da Conciliação</h3>
                <button className="btn btn-ghost p-1.5" onClick={onFechar}><X size={14} /></button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-center">
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Trans. OFX</p>
                    <p className="text-2xl font-bold">{resultado.total_ofx}</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-center">
                    <p className="text-[10px] text-success uppercase tracking-wider mb-1">Conciliados</p>
                    <p className="text-2xl font-bold text-success">{conciliados}</p>
                </div>
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-center">
                    <p className="text-[10px] text-warning uppercase tracking-wider mb-1">Sem Match</p>
                    <p className="text-2xl font-bold text-warning">{resultado.pix_nao_encontrados.length}</p>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                    <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">% Conciliado</p>
                    <p className="text-2xl font-bold text-blue-400">{percentual}%</p>
                </div>
            </div>

            {/* Barra de progresso */}
            <div className="space-y-1">
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-success rounded-full transition-all duration-700"
                        style={{ width: `${percentual}%` }}
                    />
                </div>
                <p className="text-[10px] text-muted text-right">{conciliados} de {total} transações conciliadas</p>
            </div>

            {/* Transações sem correspondência */}
            {resultado.pix_nao_encontrados.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <CircleAlert size={13} className="text-warning" />
                        <p className="text-xs font-bold text-warning">Créditos no extrato sem PIX registrado</p>
                    </div>
                    <div className="rounded-xl border border-warning/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/5 bg-warning/5">
                                    <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Data</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Descrição</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultado.pix_nao_encontrados.map((t, i) => (
                                    <tr key={i} className="border-b border-white/3">
                                        <td className="px-3 py-2">{fmtData(t.data)}</td>
                                        <td className="px-3 py-2 text-muted max-w-[200px] truncate">{t.memo || t.fitid}</td>
                                        <td className="px-3 py-2 text-right font-mono font-semibold text-warning">{fmt(t.valor)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PIX extras no sistema */}
            {resultado.pix_extras_sistema.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={13} className="text-blue-400" />
                        <p className="text-xs font-bold text-blue-400">PIX registrados sem correspondência no extrato</p>
                    </div>
                    <div className="rounded-xl border border-blue-500/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/5 bg-blue-500/5">
                                    <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Data</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Descrição</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultado.pix_extras_sistema.map((p, i) => (
                                    <tr key={i} className="border-b border-white/3">
                                        <td className="px-3 py-2">{fmtData(p.data_pix)}</td>
                                        <td className="px-3 py-2 text-muted">{p.descricao || '—'}</td>
                                        <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(p.valor)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Divergências de depósitos */}
            {resultado.depositos_divergentes.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={13} className="text-error" />
                        <p className="text-xs font-bold text-error">Divergências em depósitos do cofre</p>
                    </div>
                    <div className="rounded-xl border border-error/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/5 bg-error/5">
                                    <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Data</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase">Valor Cofre</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase">Valor OFX</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase">Diferença</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultado.depositos_divergentes.map((d, i) => (
                                    <tr key={i} className="border-b border-white/3">
                                        <td className="px-3 py-2">{fmtData(d.data)}</td>
                                        <td className="px-3 py-2 text-right font-mono">{fmt(d.valor_cofre)}</td>
                                        <td className="px-3 py-2 text-right font-mono">{fmt(d.valor_ofx)}</td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-error">
                                            {fmt(Math.abs(d.valor_cofre - d.valor_ofx))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {conciliados === total && total > 0 && (
                <div className="flex items-center justify-center gap-3 py-4 rounded-xl bg-success/5 border border-success/20">
                    <CheckCircle2 size={20} className="text-success" />
                    <p className="text-sm font-bold text-success">Conciliação 100% completa!</p>
                </div>
            )}
        </div>
    );
}

// ─── Tabela de transações OFX importadas ──────────────────────────────────────

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

// ─── Tabela de fechamentos ────────────────────────────────────────────────────

function TabelaFechamentos({ fechamentos }: { fechamentos: FechamentoPendente[] }) {
    const [aberto, setAberto] = useState<string | null>(null);

    if (fechamentos.length === 0) return (
        <div className="card p-12 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-success opacity-50" />
            <p className="text-sm font-semibold">Nenhum fechamento pendente de auditoria</p>
            <p className="text-xs text-muted mt-1">Todos os fechamentos foram auditados.</p>
        </div>
    );

    const totalEntradas = fechamentos.reduce((a, f) => a + (f.resumo_total_entradas ?? 0), 0);
    const totalCofre = fechamentos.reduce((a, f) => a + (f.valor_enviado_cofre ?? 0), 0);
    const totalPix = fechamentos.reduce((a, f) => a + (f.pix_externo_informado ?? 0), 0);

    return (
        <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Search size={13} className="text-muted" />
                    <span className="text-xs font-bold">Fechamentos Pendentes de Auditoria ({fechamentos.length})</span>
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
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase">Tipo</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase">Data / Terminal</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase">Operador / Arquivo</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase">PIX Externo</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase">Depósito Cofre</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase">Total / Saldo</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody>
                    {fechamentos.map(f => {
                        const isTFL = f.fonte === 'fechamento_tfl';
                        const isOpen = aberto === f.uid;
                        const valorPrincipal = isTFL ? f.saldo_final : f.resumo_total_entradas;
                        return (
                            <>
                                <tr
                                    key={f.uid}
                                    className="border-b border-white/3 hover:bg-white/2 cursor-pointer transition-colors"
                                    onClick={() => setAberto(isOpen ? null : f.uid)}
                                >
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
                                    <tr key={`d-${f.uid}`} className="bg-white/1">
                                        <td colSpan={7} className="px-6 py-4">
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
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExtratosConciliacao() {
    const { lojaAtual } = useLoja();
    const lojaId = lojaAtual?.id ?? '';

    const [fechamentos, setFechamentos] = useState<FechamentoPendente[]>([]);
    const [transacoesOFX, setTransacoesOFX] = useState<OFXTransacaoSalva[]>([]);
    const [contas, setContas] = useState<ContaBancaria[]>([]);
    const [loading, setLoading] = useState(true);
    const [processando, setProcessando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoConciliacao | null>(null);
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
        } catch (err) {
            toast({ type: 'error', message: 'Erro ao carregar dados.' });
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [supabase, toast, lojaId]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    async function fazerConciliacao() {
        if (!lojaId) {
            toast({ type: 'error', message: 'Selecione uma loja para continuar.' });
            return;
        }
        if (transacoesOFX.length === 0) {
            toast({ type: 'warning', message: 'Importe um extrato OFX antes de conciliar.' });
            return;
        }
        if (fechamentos.length === 0) {
            toast({ type: 'info', message: 'Não há fechamentos pendentes.' });
            return;
        }

        setProcessando(true);
        try {
            const datas = fechamentos.map(f => f.data_turno).sort();
            const res = await executarConciliacaoDetalhada(lojaId, datas[0], datas[datas.length - 1]);
            setResultado(res);
            await carregarDados();
            toast({
                type: res.pix_nao_encontrados.length === 0 ? 'success' : 'warning',
                message: `Conciliação concluída: ${res.pix_conciliados + res.depositos_conciliados} match(es) encontrado(s).`,
            });
        } catch (err) {
            toast({ type: 'error', message: 'Erro ao executar conciliação.' });
            console.error(err);
        } finally {
            setProcessando(false);
        }
    }

    // KPIs
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
                        Importe o extrato OFX e cruze com fechamentos de caixa, PIX externos e depósitos do cofre
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-ghost text-xs" onClick={carregarDados} disabled={loading}>
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </button>
                    <button
                        className="btn btn-primary text-xs"
                        onClick={fazerConciliacao}
                        disabled={processando || totalOFX === 0 || totalPendentes === 0}
                    >
                        {processando ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />}
                        Fazer Conciliação
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

            {/* Resultado da conciliação */}
            {resultado && (
                <ResultadoConciliacaoPanel
                    resultado={resultado}
                    onFechar={() => setResultado(null)}
                />
            )}

            {/* Transações OFX importadas */}
            {transacoesOFX.length > 0 && <TabelaOFX transacoes={transacoesOFX} />}

            {/* Fechamentos pendentes */}
            <TabelaFechamentos fechamentos={fechamentos} />
        </div>
    );
}
