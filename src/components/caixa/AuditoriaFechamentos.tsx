'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Shield, CheckCircle2, XCircle, AlertTriangle, Clock,
    ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle,
    DollarSign, Smartphone, Ticket, FileText, Building,
    ArrowRightLeft, Loader2, RotateCcw, Filter, Wallet
} from 'lucide-react';
import {
    getFechamentosAuditoria,
    aprovarFechamento,
    rejeitarFechamento,
    getMovimentacoesSessao,
    type FechamentoAuditoria
} from '@/actions/auditoria';
import { formatarStatusReconciliacao } from '@/lib/fechamento-utils';
import { useToast } from '@/hooks/useToast';

const STATUS_CONFIG: Record<string, { label: string; cor: string; icon: any }> = {
    pendente: { label: 'Pendente', cor: '#eab308', icon: Clock },
    aprovado: { label: 'Aprovado', cor: '#22c55e', icon: CheckCircle2 },
    rejeitado: { label: 'Rejeitado', cor: '#ef4444', icon: XCircle },
    correcao_solicitada: { label: 'Correção', cor: '#f97316', icon: RotateCcw },
};

export function AuditoriaFechamentos() {
    const { toast } = useToast();
    const [fechamentos, setFechamentos] = useState<FechamentoAuditoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<FechamentoAuditoria | null>(null);
    const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
    const [loadingMovs, setLoadingMovs] = useState(false);
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [processing, setProcessing] = useState(false);
    const [observacoesGerente, setObservacoesGerente] = useState('');
    const [showRejeitar, setShowRejeitar] = useState(false);

    const carregarFechamentos = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getFechamentosAuditoria({
                status: filtroStatus !== 'todos' ? filtroStatus : undefined,
            });
            setFechamentos(data);
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filtroStatus, toast]);

    useEffect(() => { carregarFechamentos(); }, [carregarFechamentos]);

    const selecionarFechamento = async (f: FechamentoAuditoria) => {
        setSelected(f);
        setShowRejeitar(false);
        setObservacoesGerente('');
        setLoadingMovs(true);
        try {
            const movs = await getMovimentacoesSessao(f.id);
            setMovimentacoes(movs);
        } catch { /* silenciar */ } finally {
            setLoadingMovs(false);
        }
    };

    const handleAprovar = async () => {
        if (!selected) return;
        setProcessing(true);
        try {
            await aprovarFechamento(selected.id, observacoesGerente || undefined);
            toast({ message: 'Fechamento aprovado! Entrada criada no cofre.', type: 'success' });
            setSelected(null);
            carregarFechamentos();
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleRejeitar = async (solicitarCorrecao: boolean) => {
        if (!selected || !observacoesGerente.trim()) {
            toast({ message: 'Observação obrigatória ao rejeitar.', type: 'warning' });
            return;
        }
        setProcessing(true);
        try {
            await rejeitarFechamento(selected.id, observacoesGerente, solicitarCorrecao);
            toast({
                message: solicitarCorrecao ? 'Correção solicitada ao operador.' : 'Fechamento rejeitado.',
                type: 'info'
            });
            setSelected(null);
            carregarFechamentos();
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const contadores = {
        pendentes: fechamentos.filter(f => f.auditoria_status === 'pendente').length,
        aprovados: fechamentos.filter(f => f.auditoria_status === 'aprovado').length,
        rejeitados: fechamentos.filter(f => f.auditoria_status === 'rejeitado').length,
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Lista */}
            <div className="flex-1 space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-3">
                    <KpiCard label="Pendentes" valor={contadores.pendentes} cor="#eab308" />
                    <KpiCard label="Aprovados" valor={contadores.aprovados} cor="#22c55e" />
                    <KpiCard label="Rejeitados" valor={contadores.rejeitados} cor="#ef4444" />
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-muted" />
                    {['todos', 'pendente', 'aprovado', 'rejeitado', 'correcao_solicitada'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFiltroStatus(s)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all ${
                                filtroStatus === s
                                    ? 'bg-primary-blue-light text-white'
                                    : 'bg-surface-subtle text-muted hover:bg-white/5'
                            }`}
                        >
                            {s === 'todos' ? 'Todos' : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                </div>

                {/* Lista de Fechamentos */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-muted" size={24} />
                    </div>
                ) : fechamentos.length === 0 ? (
                    <div className="text-center text-muted py-12 text-sm">
                        Nenhum fechamento encontrado.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {fechamentos.map(f => {
                            const config = STATUS_CONFIG[f.auditoria_status] || STATUS_CONFIG.pendente;
                            const Icon = config.icon;
                            const temDiferenca = Math.abs(f.diferenca_caixa || 0) >= 0.01;

                            return (
                                <button
                                    key={f.id}
                                    onClick={() => selecionarFechamento(f)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                                        selected?.id === f.id
                                            ? 'border-primary-blue-light bg-primary-blue-light/5'
                                            : 'border-border bg-bg-card hover:border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon size={14} style={{ color: config.cor }} />
                                            <span className="text-sm font-bold">{f.terminal_id}</span>
                                            <span className="text-xs text-muted">{f.operador_nome}</span>
                                        </div>
                                        <span className="text-[10px] font-bold" style={{ color: config.cor }}>
                                            {config.label.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px] text-muted">
                                            Turno {f.data_turno} • Fechado {f.data_fechamento ? new Date(f.data_fechamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                        {temDiferenca && (
                                            <span className={`text-[10px] font-black ${f.diferenca_caixa > 0 ? 'text-warning' : 'text-danger'}`}>
                                                {f.diferenca_caixa > 0 ? '+' : ''}R$ {f.diferenca_caixa.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Dossiê */}
            {selected && (
                <div className="lg:w-[480px] bg-bg-card border border-border rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <div className="p-4 border-b border-border bg-surface-subtle">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black">{selected.terminal_id}</h3>
                                <p className="text-[10px] text-muted">
                                    {selected.operador_nome} • Turno {selected.data_turno}
                                </p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-muted hover:text-text-primary">
                                <XCircle size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Body - scrollable */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                        {/* Entradas */}
                        <SectionCard title="ENTRADAS" icon={<ArrowUpCircle size={14} />} cor="success"
                            total={selected.resumo_total_entradas}>
                            <LinhaResumo icon={<Smartphone size={12} />} label="PIX" valor={selected.resumo_entradas_pix} />
                            <LinhaResumo icon={<DollarSign size={12} />} label="Dinheiro (jogos)" valor={selected.resumo_entradas_dinheiro} />
                            <LinhaResumo icon={<Ticket size={12} />} label="Bolões (din.)" valor={selected.resumo_entradas_bolao_dinheiro} />
                            {selected.resumo_entradas_bolao_pix > 0 && (
                                <LinhaResumo icon={<Ticket size={12} />} label="Bolões (PIX)" valor={selected.resumo_entradas_bolao_pix} />
                            )}
                        </SectionCard>

                        {/* Saídas */}
                        <SectionCard title="SAÍDAS" icon={<ArrowDownCircle size={14} />} cor="danger"
                            total={selected.resumo_total_saidas}>
                            <LinhaResumo icon={<Shield size={12} />} label="Sangrias" valor={selected.resumo_saidas_sangria} />
                            <LinhaResumo icon={<FileText size={12} />} label="Boletos" valor={selected.resumo_saidas_boleto} />
                            <LinhaResumo icon={<Building size={12} />} label="Depósitos" valor={selected.resumo_saidas_deposito} />
                            {selected.resumo_saidas_trocados > 0 && (
                                <LinhaResumo icon={<ArrowRightLeft size={12} />} label="Trocados" valor={selected.resumo_saidas_trocados} />
                            )}
                        </SectionCard>

                        {/* Conferência */}
                        {(() => {
                            const statusInfo = formatarStatusReconciliacao(
                                Math.abs(selected.diferenca_caixa) < 0.01 ? 'batido' :
                                    selected.diferenca_caixa > 0 ? 'sobra' : 'falta'
                            );
                            return (
                                <div className={`p-3 rounded-xl border-2 ${
                                    statusInfo.icone === 'check' ? 'bg-success/10 border-success/20' :
                                    statusInfo.icone === 'alert' ? 'bg-warning/10 border-warning/20' :
                                    'bg-danger/10 border-danger/20'
                                }`}>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                                        Conferência de Caixa
                                    </p>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted">Fundo Inicial</span>
                                            <span className="font-bold">R$ {selected.valor_inicial.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted">Esperado em Dinheiro</span>
                                            <span className="font-bold">R$ {selected.saldo_esperado_dinheiro.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted">Declarado pelo Operador</span>
                                            <span className="font-bold">R$ {selected.dinheiro_em_maos.toFixed(2)}</span>
                                        </div>
                                        <div className="border-t border-border/50 my-1" />
                                        <div className="flex justify-between items-center">
                                            <span className="font-black">DIFERENÇA</span>
                                            <span className="text-lg font-black" style={{ color: statusInfo.cor }}>
                                                {selected.diferenca_caixa >= 0 ? '+' : ''}R$ {selected.diferenca_caixa.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Destino do Dinheiro */}
                        <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                                Destino do Dinheiro
                            </p>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted">Enviado ao Cofre</span>
                                <span className="font-bold">R$ {selected.valor_enviado_cofre.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted">Fundo Devolvido</span>
                                <span className="font-bold">
                                    {selected.fundo_caixa_devolvido ? `R$ ${selected.valor_inicial.toFixed(2)}` : 'Não'}
                                </span>
                            </div>
                            {selected.pix_externo_informado > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted">PIX Externo</span>
                                    <span className="font-bold">R$ {selected.pix_externo_informado.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs mt-1">
                                <span className="text-muted">Status Cofre</span>
                                <span className={`font-bold ${selected.cofre_confirmado ? 'text-success' : 'text-warning'}`}>
                                    {selected.cofre_confirmado ? 'Confirmado' : 'Aguardando'}
                                </span>
                            </div>
                        </div>

                        {/* Observações do operador */}
                        {selected.observacoes_operador && (
                            <div className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                                <p className="text-[10px] font-black text-warning uppercase tracking-widest mb-1">
                                    Justificativa do Operador
                                </p>
                                <p className="text-xs text-text-secondary">{selected.observacoes_operador}</p>
                            </div>
                        )}

                        {/* Movimentações detalhadas (expansível) */}
                        <DetalhesMovimentacoes movimentacoes={movimentacoes} loading={loadingMovs} />
                    </div>

                    {/* Footer - Ações */}
                    {selected.auditoria_status === 'pendente' && (
                        <div className="p-4 border-t border-border bg-surface-subtle space-y-3">
                            {showRejeitar ? (
                                <>
                                    <textarea
                                        className="input w-full text-xs"
                                        rows={2}
                                        value={observacoesGerente}
                                        onChange={e => setObservacoesGerente(e.target.value)}
                                        placeholder="Motivo da rejeição (obrigatório)..."
                                    />
                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost flex-1 text-xs" onClick={() => setShowRejeitar(false)} disabled={processing}>
                                            Cancelar
                                        </button>
                                        <button
                                            className="btn flex-1 text-xs bg-danger/20 text-danger hover:bg-danger/30"
                                            onClick={() => handleRejeitar(false)}
                                            disabled={processing || !observacoesGerente.trim()}
                                        >
                                            {processing ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                                            Rejeitar
                                        </button>
                                        <button
                                            className="btn flex-1 text-xs bg-warning/20 text-warning hover:bg-warning/30"
                                            onClick={() => handleRejeitar(true)}
                                            disabled={processing || !observacoesGerente.trim()}
                                        >
                                            {processing ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                                            Corrigir
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        className="btn flex-1 bg-success/20 text-success hover:bg-success/30 font-black"
                                        onClick={handleAprovar}
                                        disabled={processing}
                                    >
                                        {processing ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                        APROVAR
                                    </button>
                                    <button
                                        className="btn flex-1 bg-danger/10 text-danger hover:bg-danger/20"
                                        onClick={() => setShowRejeitar(true)}
                                        disabled={processing}
                                    >
                                        <XCircle size={14} /> Rejeitar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info de auditoria passada */}
                    {selected.auditoria_status !== 'pendente' && selected.auditoria_observacoes && (
                        <div className="p-4 border-t border-border bg-surface-subtle">
                            <p className="text-[10px] text-muted font-bold">
                                {selected.auditoria_status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} em{' '}
                                {selected.auditoria_data ? new Date(selected.auditoria_data).toLocaleString('pt-BR') : ''}
                            </p>
                            <p className="text-xs text-text-secondary mt-1">{selected.auditoria_observacoes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Componentes auxiliares ───

function KpiCard({ label, valor, cor }: { label: string; valor: number; cor: string }) {
    return (
        <div className="p-3 rounded-xl bg-bg-card border border-border text-center">
            <p className="text-2xl font-black" style={{ color: cor }}>{valor}</p>
            <p className="text-[10px] text-muted font-bold uppercase">{label}</p>
        </div>
    );
}

function SectionCard({ title, icon, cor, total, children }: {
    title: string; icon: React.ReactNode; cor: string; total: number; children: React.ReactNode;
}) {
    return (
        <div className={`rounded-xl border border-${cor}/20 overflow-hidden`}>
            <div className={`px-3 py-2 bg-${cor}/10 flex justify-between items-center`}>
                <span className={`text-[10px] font-black text-${cor} flex items-center gap-1`}>
                    {icon} {title}
                </span>
                <span className={`text-xs font-black text-${cor}`}>
                    R$ {total.toFixed(2)}
                </span>
            </div>
            <div className="p-3 space-y-1">{children}</div>
        </div>
    );
}

function LinhaResumo({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: number }) {
    if (!valor || valor === 0) return null;
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">{icon} {label}</span>
            <span className="font-bold">R$ {valor.toFixed(2)}</span>
        </div>
    );
}

function DetalhesMovimentacoes({ movimentacoes, loading }: { movimentacoes: any[]; loading: boolean }) {
    const [expanded, setExpanded] = useState(false);

    if (loading) return <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-muted" size={16} /></div>;
    if (movimentacoes.length === 0) return null;

    const visibles = expanded ? movimentacoes : movimentacoes.slice(0, 5);

    return (
        <div className="rounded-xl border border-border overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-3 py-2 bg-surface-subtle flex justify-between items-center hover:bg-white/5"
            >
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                    Movimentações ({movimentacoes.length})
                </span>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <div className="p-2 space-y-1">
                {visibles.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between text-[11px] px-2 py-1 rounded hover:bg-white/3">
                        <div className="flex items-center gap-2">
                            <span className="text-muted w-10">
                                {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`font-medium ${m.valor > 0 ? 'text-success' : 'text-danger'}`}>
                                {m.tipo}
                            </span>
                        </div>
                        <span className={`font-bold ${m.valor > 0 ? 'text-success' : 'text-danger'}`}>
                            {m.valor > 0 ? '+' : ''}R$ {Math.abs(m.valor).toFixed(2)}
                        </span>
                    </div>
                ))}
                {!expanded && movimentacoes.length > 5 && (
                    <p className="text-center text-[10px] text-primary-blue-light font-bold py-1 cursor-pointer"
                        onClick={() => setExpanded(true)}>
                        Ver mais {movimentacoes.length - 5} movimentações
                    </p>
                )}
            </div>
        </div>
    );
}
