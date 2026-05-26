'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader as Loader2, ArrowRightLeft, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Clock, ChevronRight, X, Landmark, Banknote, CreditCard, TrendingUp, TrendingDown, Calendar, FileText } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import { getFechamentosAuditoria } from '@/actions/auditoria';
import { registrarExtratoDiario } from '@/actions/conciliacao';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FechamentoPendente {
    id: number;
    data_turno: string;
    terminal_id: string;
    operador_nome: string;
    resumo_entradas_pix: number;
    resumo_entradas_dinheiro: number;
    resumo_saidas_deposito: number;
    resumo_saidas_sangria: number;
    valor_enviado_cofre: number;
    pix_externo_informado: number;
    resumo_total_entradas: number;
    valor_final_declarado: number;
    diferenca_caixa: number;
    auditoria_status: string;
    loja_id: string;
    conta_bancaria_id?: string;
}

interface ConciliacaoItem {
    fechamento: FechamentoPendente;
    extrato?: {
        depositos_confirmados: number;
        pix_ted_recebidos: number;
        saldo_extrato: number | null;
    };
    status: 'pendente' | 'conciliado' | 'divergente';
    diferencaDepositos: number;
    diferencaPix: number;
}

interface ContaBancaria {
    id: string;
    nome: string;
    banco: string;
    agencia: string;
    conta: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined) {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(dataStr: string) {
    if (!dataStr) return '-';
    if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = dataStr.split('-');
        return `${d}/${m}/${y}`;
    }
    return dataStr;
}

function statusBadge(status: ConciliacaoItem['status']) {
    switch (status) {
        case 'conciliado':
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20"><CheckCircle2 size={10} /> Conciliado</span>;
        case 'divergente':
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20"><AlertTriangle size={10} /> Divergente</span>;
        default:
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/10 text-muted border border-muted/20"><Clock size={10} /> Pendente</span>;
    }
}

// ─── Modal de conciliação individual ─────────────────────────────────────────

function ModalConciliarItem({
    item,
    contas,
    onClose,
    onSalvar,
}: {
    item: ConciliacaoItem;
    contas: ContaBancaria[];
    onClose: () => void;
    onSalvar: (dados: {
        conta_id: string;
        depositos_confirmados: number;
        pix_ted_recebidos: number;
        debitos_pagamentos: number;
        tarifas_bancarias: number;
        saldo_extrato: number;
    }) => Promise<void>;
}) {
    const [contaId, setContaId] = useState(contas[0]?.id ?? '');
    const [depositosConfirmados, setDepositosConfirmados] = useState(
        item.fechamento.resumo_saidas_deposito ?? 0
    );
    const [pixRecebidos, setPixRecebidos] = useState(
        item.fechamento.resumo_entradas_pix ?? 0
    );
    const [debitoPagamentos, setDebitoPagamentos] = useState(0);
    const [tarifas, setTarifas] = useState(0);
    const [saldoExtrato, setSaldoExtrato] = useState(0);
    const [saving, setSaving] = useState(false);

    async function handleSalvar() {
        if (!contaId) return;
        setSaving(true);
        try {
            await onSalvar({
                conta_id: contaId,
                depositos_confirmados: depositosConfirmados,
                pix_ted_recebidos: pixRecebidos,
                debitos_pagamentos: debitoPagamentos,
                tarifas_bancarias: tarifas,
                saldo_extrato: saldoExtrato,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="card w-full max-w-lg mx-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-base font-bold">Registrar Extrato Bancário</h3>
                        <p className="text-xs text-muted mt-0.5">
                            Terminal {item.fechamento.terminal_id} — {fmtData(item.fechamento.data_turno)}
                        </p>
                    </div>
                    <button className="btn btn-ghost p-2" onClick={onClose}><X size={16} /></button>
                </div>

                {/* Referência do fechamento */}
                <div className="rounded-xl border border-white/5 bg-white/2 p-4 mb-5 grid grid-cols-2 gap-3">
                    <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Entradas PIX (sistema)</p>
                        <p className="text-sm font-bold text-foreground">{fmt(item.fechamento.resumo_entradas_pix)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Depósitos Cofre (sistema)</p>
                        <p className="text-sm font-bold text-foreground">{fmt(item.fechamento.resumo_saidas_deposito)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider">PIX Externo (sistema)</p>
                        <p className="text-sm font-bold text-foreground">{fmt(item.fechamento.pix_externo_informado)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Total Entradas (sistema)</p>
                        <p className="text-sm font-bold text-foreground">{fmt(item.fechamento.resumo_total_entradas)}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {contas.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-muted mb-1.5">Conta Bancária</label>
                            <select
                                className="input w-full text-sm"
                                value={contaId}
                                onChange={e => setContaId(e.target.value)}
                            >
                                {contas.map(c => (
                                    <option key={c.id} value={c.id}>{c.banco} — {c.nome}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted mb-1.5">Depósitos Confirmados</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input w-full text-sm"
                                value={depositosConfirmados}
                                onChange={e => setDepositosConfirmados(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted mb-1.5">PIX / TED Recebidos</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input w-full text-sm"
                                value={pixRecebidos}
                                onChange={e => setPixRecebidos(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted mb-1.5">Débitos / Pagamentos</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input w-full text-sm"
                                value={debitoPagamentos}
                                onChange={e => setDebitoPagamentos(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted mb-1.5">Tarifas Bancárias</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input w-full text-sm"
                                value={tarifas}
                                onChange={e => setTarifas(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted mb-1.5">Saldo no Extrato</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input w-full text-sm"
                            value={saldoExtrato}
                            onChange={e => setSaldoExtrato(parseFloat(e.target.value) || 0)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
                    <button
                        className="btn btn-primary flex-1"
                        onClick={handleSalvar}
                        disabled={saving || !contaId}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                        Conciliar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExtratosConciliacao() {
    const [fechamentos, setFechamentos] = useState<FechamentoPendente[]>([]);
    const [itens, setItens] = useState<ConciliacaoItem[]>([]);
    const [contas, setContas] = useState<ContaBancaria[]>([]);
    const [loading, setLoading] = useState(true);
    const [processando, setProcessando] = useState(false);
    const [itemSelecionado, setItemSelecionado] = useState<ConciliacaoItem | null>(null);
    const [detalheAberto, setDetalheAberto] = useState<number | null>(null);
    const { toast: addToast } = useToast();
    const supabase = createBrowserSupabaseClient();

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const [raw, { data: contasData }] = await Promise.all([
                getFechamentosAuditoria({ status: 'pendente' }),
                supabase.from('financeiro_contas_bancarias').select('id, nome, banco, agencia, conta').eq('ativo', true),
            ]);

            const pendentes = raw as FechamentoPendente[];
            setFechamentos(pendentes);
            setContas((contasData ?? []) as ContaBancaria[]);

            // Para cada fechamento, verificar se já existe extrato registrado
            const itensCalculados: ConciliacaoItem[] = await Promise.all(
                pendentes.map(async (f) => {
                    const { data: extrato } = await supabase
                        .from('conciliacao_extratos')
                        .select('depositos_confirmados, pix_ted_recebidos, saldo_extrato, status, diferenca_depositos, diferenca_pix')
                        .eq('data_extrato', f.data_turno)
                        .maybeSingle();

                    const diferencaDepositos = extrato
                        ? Math.abs(extrato.depositos_confirmados - (f.resumo_saidas_deposito ?? 0))
                        : 0;
                    const diferencaPix = extrato
                        ? Math.abs(extrato.pix_ted_recebidos - (f.resumo_entradas_pix ?? 0))
                        : 0;

                    let status: ConciliacaoItem['status'] = 'pendente';
                    if (extrato) {
                        status = (extrato.status === 'conciliado' || (diferencaDepositos < 0.01 && diferencaPix < 0.01))
                            ? 'conciliado'
                            : 'divergente';
                    }

                    return {
                        fechamento: f,
                        extrato: extrato ? {
                            depositos_confirmados: extrato.depositos_confirmados,
                            pix_ted_recebidos: extrato.pix_ted_recebidos,
                            saldo_extrato: extrato.saldo_extrato,
                        } : undefined,
                        status,
                        diferencaDepositos,
                        diferencaPix,
                    };
                })
            );

            setItens(itensCalculados);
        } catch (err) {
            addToast({ type: 'error', message: 'Erro ao carregar fechamentos pendentes.' });
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [supabase, addToast]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    async function fazerConciliacaoGeral() {
        const itensPendentes = itens.filter(i => i.status === 'pendente');
        if (itensPendentes.length === 0) {
            addToast({ type: 'info', message: 'Não há fechamentos pendentes de conciliação.' });
            return;
        }

        if (contas.length === 0) {
            addToast({ type: 'error', message: 'Nenhuma conta bancária cadastrada para conciliação.' });
            return;
        }

        setProcessando(true);
        let conciliados = 0;
        let divergentes = 0;

        try {
            for (const item of itensPendentes) {
                try {
                    await registrarExtratoDiario({
                        conta_id: contas[0].id,
                        data_extrato: item.fechamento.data_turno,
                        depositos_confirmados: item.fechamento.resumo_saidas_deposito ?? 0,
                        pix_ted_recebidos: item.fechamento.resumo_entradas_pix ?? 0,
                        debitos_pagamentos: 0,
                        tarifas_bancarias: 0,
                        outros_creditos: item.fechamento.pix_externo_informado ?? 0,
                        saldo_extrato: item.fechamento.valor_final_declarado ?? 0,
                    });
                    conciliados++;
                } catch {
                    divergentes++;
                }
            }

            addToast({
                type: conciliados > 0 ? 'success' : 'error',
                message: `Conciliação concluída: ${conciliados} registrado(s)${divergentes > 0 ? `, ${divergentes} com erro` : ''}.`,
            });

            await carregarDados();
        } finally {
            setProcessando(false);
        }
    }

    async function conciliarItem(item: ConciliacaoItem, dados: {
        conta_id: string;
        depositos_confirmados: number;
        pix_ted_recebidos: number;
        debitos_pagamentos: number;
        tarifas_bancarias: number;
        saldo_extrato: number;
    }) {
        await registrarExtratoDiario({
            conta_id: dados.conta_id,
            data_extrato: item.fechamento.data_turno,
            depositos_confirmados: dados.depositos_confirmados,
            pix_ted_recebidos: dados.pix_ted_recebidos,
            debitos_pagamentos: dados.debitos_pagamentos,
            tarifas_bancarias: dados.tarifas_bancarias,
            saldo_extrato: dados.saldo_extrato,
        });

        addToast({ type: 'success', message: 'Extrato registrado e conciliação realizada.' });
        await carregarDados();
    }

    // ─── KPIs ─────────────────────────────────────────────────────────────────
    const totalPendentes = itens.filter(i => i.status === 'pendente').length;
    const totalConciliados = itens.filter(i => i.status === 'conciliado').length;
    const totalDivergentes = itens.filter(i => i.status === 'divergente').length;
    const totalDepositos = itens.reduce((acc, i) => acc + (i.fechamento.resumo_saidas_deposito ?? 0), 0);
    const totalPix = itens.reduce((acc, i) => acc + (i.fechamento.resumo_entradas_pix ?? 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-muted" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold">Extratos & Conciliação</h2>
                    <p className="text-xs text-muted mt-0.5">
                        Fechamentos pendentes aguardando cruzamento com o extrato bancário
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        className="btn btn-ghost text-xs"
                        onClick={carregarDados}
                        disabled={loading}
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                    <button
                        className="btn btn-primary text-xs"
                        onClick={fazerConciliacaoGeral}
                        disabled={processando || totalPendentes === 0}
                    >
                        {processando
                            ? <Loader2 size={13} className="animate-spin" />
                            : <ArrowRightLeft size={13} />
                        }
                        Fazer Conciliação
                        {totalPendentes > 0 && (
                            <span className="ml-1 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {totalPendentes}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-muted/10 flex items-center justify-center">
                            <Clock size={13} className="text-muted" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Pendentes</span>
                    </div>
                    <p className="text-2xl font-bold">{totalPendentes}</p>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                            <CheckCircle2 size={13} className="text-success" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Conciliados</span>
                    </div>
                    <p className="text-2xl font-bold text-success">{totalConciliados}</p>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
                            <AlertTriangle size={13} className="text-warning" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Divergentes</span>
                    </div>
                    <p className="text-2xl font-bold text-warning">{totalDivergentes}</p>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Banknote size={13} className="text-blue-400" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Total Depósitos</span>
                    </div>
                    <p className="text-sm font-bold">{fmt(totalDepositos)}</p>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <CreditCard size={13} className="text-blue-400" />
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Total PIX</span>
                    </div>
                    <p className="text-sm font-bold">{fmt(totalPix)}</p>
                </div>
            </div>

            {/* Lista de fechamentos */}
            {itens.length === 0 ? (
                <div className="card p-12 text-center">
                    <CheckCircle2 size={32} className="mx-auto mb-3 text-success opacity-50" />
                    <p className="text-sm font-semibold">Nenhum fechamento pendente</p>
                    <p className="text-xs text-muted mt-1">Todos os fechamentos foram conciliados.</p>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Data / Terminal</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Operador</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">
                                    <span className="flex items-center justify-end gap-1"><TrendingUp size={10} /> Entradas PIX</span>
                                </th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">
                                    <span className="flex items-center justify-end gap-1"><Landmark size={10} /> Depósitos</span>
                                </th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">
                                    <span className="flex items-center justify-end gap-1"><TrendingDown size={10} /> Total Entradas</span>
                                </th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {itens.map((item) => {
                                const isOpen = detalheAberto === item.fechamento.id;
                                return (
                                    <>
                                        <tr
                                            key={item.fechamento.id}
                                            className="border-b border-white/3 hover:bg-white/2 transition-colors cursor-pointer"
                                            onClick={() => setDetalheAberto(isOpen ? null : item.fechamento.id)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={12} className="text-muted flex-shrink-0" />
                                                    <div>
                                                        <p className="font-semibold">{fmtData(item.fechamento.data_turno)}</p>
                                                        <p className="text-muted">{item.fechamento.terminal_id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted">{item.fechamento.operador_nome || '—'}</td>
                                            <td className="px-4 py-3 text-right font-mono">{fmt(item.fechamento.resumo_entradas_pix)}</td>
                                            <td className="px-4 py-3 text-right font-mono">{fmt(item.fechamento.resumo_saidas_deposito)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(item.fechamento.resumo_total_entradas)}</td>
                                            <td className="px-4 py-3 text-center">{statusBadge(item.status)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    {item.status === 'pendente' && (
                                                        <button
                                                            className="btn btn-ghost text-[10px] h-7 px-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setItemSelecionado(item);
                                                            }}
                                                        >
                                                            <ArrowRightLeft size={11} />
                                                            Conciliar
                                                        </button>
                                                    )}
                                                    <ChevronRight
                                                        size={14}
                                                        className={`text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                                    />
                                                </div>
                                            </td>
                                        </tr>

                                        {isOpen && (
                                            <tr key={`detail-${item.fechamento.id}`} className="bg-white/1">
                                                <td colSpan={7} className="px-6 py-4">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                            <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Entradas Dinheiro</p>
                                                            <p className="text-sm font-bold">{fmt(item.fechamento.resumo_entradas_dinheiro)}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                            <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Sangrias</p>
                                                            <p className="text-sm font-bold">{fmt(item.fechamento.resumo_saidas_sangria)}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                            <p className="text-[10px] text-muted uppercase tracking-wider mb-1">PIX Externo</p>
                                                            <p className="text-sm font-bold">{fmt(item.fechamento.pix_externo_informado)}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                                                            <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Diferença Caixa</p>
                                                            <p className={`text-sm font-bold ${(item.fechamento.diferenca_caixa ?? 0) !== 0 ? 'text-warning' : 'text-success'}`}>
                                                                {fmt(item.fechamento.diferenca_caixa)}
                                                            </p>
                                                        </div>

                                                        {item.extrato && (
                                                            <>
                                                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                                                                    <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                        <FileText size={9} /> Depósitos Extrato
                                                                    </p>
                                                                    <p className="text-sm font-bold">{fmt(item.extrato.depositos_confirmados)}</p>
                                                                    {item.diferencaDepositos > 0.01 && (
                                                                        <p className="text-[10px] text-warning mt-0.5">Dif: {fmt(item.diferencaDepositos)}</p>
                                                                    )}
                                                                </div>
                                                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                                                                    <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                        <FileText size={9} /> PIX Extrato
                                                                    </p>
                                                                    <p className="text-sm font-bold">{fmt(item.extrato.pix_ted_recebidos)}</p>
                                                                    {item.diferencaPix > 0.01 && (
                                                                        <p className="text-[10px] text-warning mt-0.5">Dif: {fmt(item.diferencaPix)}</p>
                                                                    )}
                                                                </div>
                                                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                                                                    <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                        <Landmark size={9} /> Saldo Extrato
                                                                    </p>
                                                                    <p className="text-sm font-bold">{fmt(item.extrato.saldo_extrato)}</p>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal conciliar item individual */}
            {itemSelecionado && (
                <ModalConciliarItem
                    item={itemSelecionado}
                    contas={contas}
                    onClose={() => setItemSelecionado(null)}
                    onSalvar={(dados) => conciliarItem(itemSelecionado, dados)}
                />
            )}
        </div>
    );
}
