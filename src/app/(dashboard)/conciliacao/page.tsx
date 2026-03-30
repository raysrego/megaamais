'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building, Loader as Loader2, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Clock, Plus, RefreshCw, FileText, Smartphone, DollarSign, CircleArrowDown as ArrowDownCircle, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import {
    registrarExtratoDiario,
    getExtratosConciliacao,
    getResumoConciliacao,
    justificarDivergencia,
    type ConciliacaoExtrato
} from '@/actions/conciliacao';
import { getContasBancarias } from '@/actions/financeiro';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { useToast } from '@/contexts/ToastContext';

const STATUS_LABELS: Record<string, { label: string; cor: string; icon: any }> = {
    conciliado: { label: 'Conciliado', cor: '#22c55e', icon: CheckCircle2 },
    divergente: { label: 'Divergente', cor: '#ef4444', icon: AlertTriangle },
    pendente: { label: 'Pendente', cor: '#eab308', icon: Clock },
    justificado: { label: 'Justificado', cor: '#3b82f6', icon: FileText },
};

export default function ConciliacaoPage() {
    const { toast } = useToast();
    const [contas, setContas] = useState<any[]>([]);
    const [contaSelecionada, setContaSelecionada] = useState('');
    const [mesAno, setMesAno] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [extratos, setExtratos] = useState<ConciliacaoExtrato[]>([]);
    const [resumo, setResumo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showRegistrar, setShowRegistrar] = useState(false);
    const [tab, setTab] = useState<'depositos' | 'pix' | 'pagamentos'>('depositos');

    // Form do extrato
    const [formData, setFormData] = useState({
        data: new Date().toISOString().split('T')[0],
        depositos: 0, pix: 0, debitos: 0, tarifas: 0, saldo: 0,
    });
    const [registrando, setRegistrando] = useState(false);

    // Justificativa
    const [justificando, setJustificando] = useState<number | null>(null);
    const [justificativaText, setJustificativaText] = useState('');

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContasBancarias();
            setContas(c);
            if (c.length > 0 && !contaSelecionada) {
                setContaSelecionada(c[0].id);
            }
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [toast, contaSelecionada]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    const carregarExtratos = useCallback(async () => {
        if (!contaSelecionada) return;
        try {
            const [e, r] = await Promise.all([
                getExtratosConciliacao(contaSelecionada, mesAno),
                getResumoConciliacao(contaSelecionada, mesAno),
            ]);
            setExtratos(e);
            setResumo(r);
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        }
    }, [contaSelecionada, mesAno, toast]);

    useEffect(() => { carregarExtratos(); }, [carregarExtratos]);

    const handleRegistrar = async () => {
        if (!contaSelecionada || !formData.data) return;
        setRegistrando(true);
        try {
            const result = await registrarExtratoDiario({
                conta_id: contaSelecionada,
                data_extrato: formData.data,
                depositos_confirmados: formData.depositos,
                pix_ted_recebidos: formData.pix,
                debitos_pagamentos: formData.debitos,
                tarifas_bancarias: formData.tarifas,
                saldo_extrato: formData.saldo || undefined,
            });
            const status = (result as any)?.status;
            toast({
                message: status === 'conciliado'
                    ? 'Extrato registrado — Tudo conciliado!'
                    : 'Extrato registrado — Verificar divergências.',
                type: status === 'conciliado' ? 'success' : 'warning',
            });
            setShowRegistrar(false);
            setFormData({ data: new Date().toISOString().split('T')[0], depositos: 0, pix: 0, debitos: 0, tarifas: 0, saldo: 0 });
            carregarExtratos();
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setRegistrando(false);
        }
    };

    const handleJustificar = async () => {
        if (!justificando || !justificativaText.trim()) return;
        try {
            await justificarDivergencia(justificando, justificativaText);
            toast({ message: 'Divergência justificada.', type: 'success' });
            setJustificando(null);
            setJustificativaText('');
            carregarExtratos();
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        }
    };

    const contaAtual = contas.find(c => c.id === contaSelecionada);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-muted" size={32} /></div>;
    }

    return (
        <div className="space-y-6 p-4 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-blue-light/10 flex items-center justify-center">
                        <Scale size={20} className="text-primary-blue-light" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black">Conciliação Bancária</h1>
                        <p className="text-xs text-muted">Compare sistema x extrato do banco</p>
                    </div>
                </div>
                <button onClick={() => setShowRegistrar(true)} className="btn btn-primary">
                    <Plus size={14} /> Registrar Extrato
                </button>
            </div>

            {/* Seletores */}
            <div className="flex gap-3 flex-wrap">
                <select value={contaSelecionada} onChange={e => setContaSelecionada(e.target.value)}
                    className="input flex-1 min-w-[200px]">
                    {contas.map(c => (
                        <option key={c.id} value={c.id}>{c.banco} — {c.nome}</option>
                    ))}
                </select>
                <input type="month" value={mesAno} onChange={e => setMesAno(e.target.value)}
                    className="input w-40" />
            </div>

            {/* Resumo do Período */}
            {resumo && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-center">
                        <p className="text-xl font-black text-success">{resumo.total_conciliados}</p>
                        <p className="text-[10px] text-muted font-bold">Conciliados</p>
                    </div>
                    <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-center">
                        <p className="text-xl font-black text-danger">{resumo.total_divergentes}</p>
                        <p className="text-[10px] text-muted font-bold">Divergentes</p>
                    </div>
                    <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-center">
                        <p className="text-xl font-black text-warning">{resumo.total_pendentes}</p>
                        <p className="text-[10px] text-muted font-bold">Pendentes</p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary-blue-light/10 border border-primary-blue-light/20 text-center">
                        <p className="text-xl font-black text-primary-blue-light">{resumo.percentual_conciliado}%</p>
                        <p className="text-[10px] text-muted font-bold">Conciliado</p>
                    </div>
                </div>
            )}

            {/* Abas */}
            <div className="flex gap-1 bg-surface-subtle rounded-xl p-1">
                {(['depositos', 'pix', 'pagamentos'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            tab === t ? 'bg-bg-card text-text-primary shadow' : 'text-muted'
                        }`}>
                        {t === 'depositos' && <><DollarSign size={12} /> Depósitos</>}
                        {t === 'pix' && <><Smartphone size={12} /> PIX/Digital</>}
                        {t === 'pagamentos' && <><ArrowDownCircle size={12} /> Pagamentos</>}
                    </button>
                ))}
            </div>

            {/* Lista de Extratos */}
            <div className="space-y-2">
                {extratos.length === 0 ? (
                    <div className="text-center py-12 text-muted text-sm">
                        Nenhum extrato registrado para este período.
                        <br />
                        <button onClick={() => setShowRegistrar(true)}
                            className="text-primary-blue-light font-bold mt-2 hover:underline">
                            Registrar primeiro extrato
                        </button>
                    </div>
                ) : (
                    extratos.map(e => {
                        const config = STATUS_LABELS[e.status] || STATUS_LABELS.pendente;
                        const Icon = config.icon;

                        // Dados específicos da aba
                        let extrato = 0, sistema = 0, diferenca = 0;
                        if (tab === 'depositos') {
                            extrato = e.depositos_confirmados;
                            sistema = e.depositos_sistema;
                            diferenca = e.diferenca_depositos;
                        } else if (tab === 'pix') {
                            extrato = e.pix_ted_recebidos;
                            sistema = e.pix_sistema;
                            diferenca = e.diferenca_pix;
                        } else {
                            extrato = e.debitos_pagamentos;
                            sistema = e.pagamentos_sistema;
                            diferenca = e.diferenca_pagamentos;
                        }

                        const temDivergencia = Math.abs(diferenca) >= 0.01;

                        return (
                            <div key={e.id} className={`p-4 rounded-xl border bg-bg-card ${
                                temDivergencia ? 'border-danger/30' : 'border-border'
                            }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Icon size={14} style={{ color: config.cor }} />
                                        <span className="text-sm font-black">
                                            {new Date(e.data_extrato + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: config.cor + '20', color: config.cor }}>
                                            {config.label}
                                        </span>
                                    </div>
                                    {e.tarifas_bancarias > 0 && (
                                        <span className="text-[10px] text-muted">
                                            Tarifa: R$ {e.tarifas_bancarias.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-[10px] text-muted font-bold uppercase">Extrato (banco)</p>
                                        <p className="text-sm font-black">R$ {extrato.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted font-bold uppercase">Sistema (MegaB)</p>
                                        <p className="text-sm font-black">R$ {sistema.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted font-bold uppercase">Diferença</p>
                                        <p className={`text-sm font-black ${
                                            temDivergencia ? 'text-danger' : 'text-success'
                                        }`}>
                                            {diferenca >= 0 ? '+' : ''}R$ {diferenca.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Justificativa existente */}
                                {e.justificativa && (
                                    <p className="text-[10px] text-muted mt-2 italic">
                                        Justificativa: {e.justificativa}
                                    </p>
                                )}

                                {/* Ação de justificar divergência */}
                                {e.status === 'divergente' && (
                                    <div className="mt-3 pt-3 border-t border-border">
                                        {justificando === e.id ? (
                                            <div className="space-y-2">
                                                <textarea className="input w-full text-xs" rows={2}
                                                    value={justificativaText}
                                                    onChange={ev => setJustificativaText(ev.target.value)}
                                                    placeholder="Justificativa da divergência..." />
                                                <div className="flex gap-2">
                                                    <button className="btn btn-ghost text-xs flex-1"
                                                        onClick={() => setJustificando(null)}>Cancelar</button>
                                                    <button className="btn btn-primary text-xs flex-1"
                                                        onClick={handleJustificar}
                                                        disabled={!justificativaText.trim()}>Justificar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button className="text-xs text-primary-blue-light font-bold hover:underline"
                                                onClick={() => { setJustificando(e.id); setJustificativaText(''); }}>
                                                Justificar divergência
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal Registrar Extrato */}
            {showRegistrar && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowRegistrar(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 p-6 space-y-4">
                        <h3 className="text-base font-black flex items-center gap-2">
                            <FileText size={16} className="text-primary-blue-light" />
                            Registrar Extrato do Dia
                        </h3>
                        <p className="text-xs text-muted">
                            Informe os totais do extrato bancário de {contaAtual?.banco} — {contaAtual?.nome}
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase">Data</label>
                                <input type="date" className="input w-full"
                                    value={formData.data}
                                    onChange={e => setFormData(p => ({ ...p, data: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase">Depósitos confirmados no extrato</label>
                                <MoneyInput value={formData.depositos}
                                    onValueChange={v => setFormData(p => ({ ...p, depositos: v }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase">PIX/TED recebidos</label>
                                <MoneyInput value={formData.pix}
                                    onValueChange={v => setFormData(p => ({ ...p, pix: v }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase">Débitos/Pagamentos</label>
                                <MoneyInput value={formData.debitos}
                                    onValueChange={v => setFormData(p => ({ ...p, debitos: v }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase">Tarifas bancárias</label>
                                <MoneyInput value={formData.tarifas}
                                    onValueChange={v => setFormData(p => ({ ...p, tarifas: v }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase">Saldo final no extrato (opcional)</label>
                                <MoneyInput value={formData.saldo}
                                    onValueChange={v => setFormData(p => ({ ...p, saldo: v }))} />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button className="btn btn-ghost flex-1" onClick={() => setShowRegistrar(false)} disabled={registrando}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary flex-1 font-black" onClick={handleRegistrar} disabled={registrando}>
                                {registrando ? <Loader2 className="animate-spin" size={14} /> : 'Registrar'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
