'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, X, Loader as Loader2, TrendingUp, TrendingDown, RefreshCw, ShieldCheck, Eye, ChevronRight, ChevronDown, Banknote, Receipt, Hash, Calendar, DollarSign, Trash2, Send } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useLoja } from '@/contexts/LojaContext';
import { useToast } from '@/contexts/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JogoTFL {
    descricao: string;
    numero_sorteio?: string | null;
    quantidade: number;
    valor: number;
}

interface ContaTFL {
    descricao: string;
    quantidade: number;
    valor: number;
}

interface PremioTFL {
    descricao: string;
    quantidade: number;
    valor: number;
}

interface PagamentoTFL {
    descricao: string;
    quantidade: number;
    valor: number;
}

interface ServicoContaTFL {
    descricao: string;
    quantidade: number;
    valor: number;
}

interface RelatorioTFL {
    data_referencia: string | null;
    terminal: string | null;
    total_creditos: number | null;
    total_debitos: number | null;
    saldo_final: number | null;
    lancamentos_manuais: boolean;
    recebimentos: {
        jogos: JogoTFL[];
        total_jogos_quantidade: number | null;
        total_jogos_valor: number | null;
        contas: ContaTFL[];
        total_contas_quantidade: number | null;
        total_contas_valor: number | null;
        total_recebimentos_quantidade: number | null;
        total_recebimentos_valor: number | null;
    };
    premios_pagos: {
        itens: PremioTFL[];
        total_quantidade: number | null;
        total_valor: number | null;
    };
    pagamentos: {
        itens: PagamentoTFL[];
        total_quantidade: number | null;
        total_valor: number | null;
    };
    servicos_conta: {
        itens: ServicoContaTFL[];
        total_quantidade: number | null;
        total_valor: number | null;
    };
    total_em_caixa: number | null;
    servicos_sem_movimentacao: boolean;
    invalidacoes: boolean;
    estornos: boolean;
    reimpressoes: boolean;
    totais_finais: {
        creditos_manuais: number | null;
        creditos_tfl: number | null;
        debitos_manuais: number | null;
        debitos_tfl: number | null;
        total_creditos: number | null;
        total_debitos: number | null;
        saldo_final: number | null;
    };
}

type StatusUpload = 'aguardando' | 'processando' | 'concluido' | 'erro' | 'enviado';

interface RegistroTFL {
    id: string;
    arquivo_nome: string;
    status: StatusUpload;
    resultado: RelatorioTFL | null;
    erro: string | null;
    dbId: string | null;
    expandido: boolean;
    status_auditoria?: string;
}

interface RegistroHistorico {
    id: string;
    data_referencia: string | null;
    terminal: string | null;
    total_creditos: number;
    total_debitos: number;
    saldo_final: number;
    arquivo_nome: string | null;
    status_auditoria: string;
    dados_extraidos: RelatorioTFL;
    created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getStatusBadge(status: string) {
    const configs: Record<string, { label: string; cls: string }> = {
        pendente: { label: 'PENDENTE', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
        aprovado: { label: 'APROVADO', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
        rejeitado: { label: 'REJEITADO', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const cfg = configs[status] ?? configs.pendente;
    return (
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">{titulo}</p>
            {children}
        </div>
    );
}

function KpiCard({ label, valor, icon, color }: { label: string; valor: string; icon: React.ReactNode; color: string }) {
    return (
        <div className="p-4 rounded-xl border border-border bg-surface-subtle">
            <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
                {icon}
                <span className="text-[10px] text-muted font-bold uppercase">{label}</span>
            </div>
            <p className="text-lg font-black tabular-nums" style={{ color }}>{valor}</p>
        </div>
    );
}

function DetalhesTFL({ dados }: { dados: RelatorioTFL }) {
    return (
        <div className="space-y-5 text-sm">
            {/* KPIs principais */}
            <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total Créditos" valor={fmt(dados.total_creditos)} icon={<TrendingUp size={14} />} color="var(--success)" />
                <KpiCard label="Total Débitos" valor={fmt(dados.total_debitos)} icon={<TrendingDown size={14} />} color="var(--danger)" />
                <KpiCard label="Saldo Final" valor={fmt(dados.saldo_final)} icon={<Banknote size={14} />} color="var(--primary-blue-light)" />
            </div>

            {/* Recebimentos — Jogos */}
            {dados.recebimentos.jogos.length > 0 && (
                <Section titulo="Recebimentos — Jogos">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-[10px] text-muted">
                                <th className="text-left pb-1 font-bold">Descrição</th>
                                <th className="text-right pb-1 font-bold">Qtde</th>
                                <th className="text-right pb-1 font-bold">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.recebimentos.jogos.map((j, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1">{j.descricao}{j.numero_sorteio ? ` #${j.numero_sorteio}` : ''}</td>
                                    <td className="py-1 text-right text-muted tabular-nums">{j.quantidade}</td>
                                    <td className="py-1 text-right font-semibold tabular-nums">{fmt(j.valor)}</td>
                                </tr>
                            ))}
                            <tr className="font-bold border-t border-border">
                                <td className="pt-2">TOTAL JOGOS</td>
                                <td className="pt-2 text-right tabular-nums">{dados.recebimentos.total_jogos_quantidade ?? '—'}</td>
                                <td className="pt-2 text-right tabular-nums text-success">{fmt(dados.recebimentos.total_jogos_valor)}</td>
                            </tr>
                        </tbody>
                    </table>
                </Section>
            )}

            {/* Recebimentos — Contas */}
            {dados.recebimentos.contas.length > 0 && (
                <Section titulo="Recebimentos — Contas">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-[10px] text-muted">
                                <th className="text-left pb-1 font-bold">Descrição</th>
                                <th className="text-right pb-1 font-bold">Qtde</th>
                                <th className="text-right pb-1 font-bold">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.recebimentos.contas.map((c, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1">{c.descricao}</td>
                                    <td className="py-1 text-right text-muted tabular-nums">{c.quantidade}</td>
                                    <td className="py-1 text-right font-semibold tabular-nums">{fmt(c.valor)}</td>
                                </tr>
                            ))}
                            <tr className="font-bold border-t border-border">
                                <td className="pt-2">TOTAL CONTAS</td>
                                <td className="pt-2 text-right tabular-nums">{dados.recebimentos.total_contas_quantidade ?? '—'}</td>
                                <td className="pt-2 text-right tabular-nums text-success">{fmt(dados.recebimentos.total_contas_valor)}</td>
                            </tr>
                            <tr className="font-black border-t-2 border-border">
                                <td className="pt-2 uppercase">Total Recebimentos</td>
                                <td className="pt-2 text-right tabular-nums">{dados.recebimentos.total_recebimentos_quantidade ?? '—'}</td>
                                <td className="pt-2 text-right tabular-nums text-success">{fmt(dados.recebimentos.total_recebimentos_valor)}</td>
                            </tr>
                        </tbody>
                    </table>
                </Section>
            )}

            {/* Prêmios Pagos */}
            {dados.premios_pagos.itens.length > 0 && (
                <Section titulo="Prêmios Pagos">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-[10px] text-muted">
                                <th className="text-left pb-1 font-bold">Descrição</th>
                                <th className="text-right pb-1 font-bold">Qtde</th>
                                <th className="text-right pb-1 font-bold">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.premios_pagos.itens.map((p, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1">{p.descricao}</td>
                                    <td className="py-1 text-right text-muted tabular-nums">{p.quantidade}</td>
                                    <td className="py-1 text-right font-semibold tabular-nums text-danger">{fmt(p.valor)}</td>
                                </tr>
                            ))}
                            <tr className="font-bold border-t border-border">
                                <td className="pt-2">TOTAL PRÊMIOS</td>
                                <td className="pt-2 text-right tabular-nums">{dados.premios_pagos.total_quantidade ?? '—'}</td>
                                <td className="pt-2 text-right tabular-nums text-danger">{fmt(dados.premios_pagos.total_valor)}</td>
                            </tr>
                        </tbody>
                    </table>
                </Section>
            )}

            {/* Pagamentos */}
            {dados.pagamentos.itens.length > 0 && (
                <Section titulo="Pagamentos">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-[10px] text-muted">
                                <th className="text-left pb-1 font-bold">Descrição</th>
                                <th className="text-right pb-1 font-bold">Qtde</th>
                                <th className="text-right pb-1 font-bold">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.pagamentos.itens.map((p, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1">{p.descricao}</td>
                                    <td className="py-1 text-right text-muted tabular-nums">{p.quantidade}</td>
                                    <td className="py-1 text-right font-semibold tabular-nums">{fmt(p.valor)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Section>
            )}

            {/* Serviços Conta Corrente */}
            {dados.servicos_conta.itens.length > 0 && (
                <Section titulo="Serviços Conta Corrente / Poupança">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-[10px] text-muted">
                                <th className="text-left pb-1 font-bold">Descrição</th>
                                <th className="text-right pb-1 font-bold">Qtde</th>
                                <th className="text-right pb-1 font-bold">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.servicos_conta.itens.map((s, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1">{s.descricao}</td>
                                    <td className="py-1 text-right text-muted tabular-nums">{s.quantidade}</td>
                                    <td className="py-1 text-right font-semibold tabular-nums">{fmt(s.valor)}</td>
                                </tr>
                            ))}
                            <tr className="font-bold border-t border-border">
                                <td className="pt-2">TOTAL CONTA</td>
                                <td className="pt-2 text-right tabular-nums">{dados.servicos_conta.total_quantidade ?? '—'}</td>
                                <td className="pt-2 text-right tabular-nums">{fmt(dados.servicos_conta.total_valor)}</td>
                            </tr>
                        </tbody>
                    </table>
                </Section>
            )}

            {/* Total em Caixa */}
            {dados.total_em_caixa != null && (
                <div className="p-4 rounded-xl bg-primary-blue-light/10 border border-primary-blue-light/20 text-center">
                    <p className="text-[10px] font-bold text-primary-blue-light uppercase mb-1">Total em Caixa</p>
                    <p className="text-2xl font-black text-primary-blue-light">{fmt(dados.total_em_caixa)}</p>
                </div>
            )}

            {/* Totais Finais */}
            <Section titulo="Totais Finais">
                <div className="space-y-1 rounded-xl border border-border p-3 bg-surface-subtle">
                    {[
                        { label: 'Créditos Manuais', valor: dados.totais_finais.creditos_manuais },
                        { label: 'Créditos TFL', valor: dados.totais_finais.creditos_tfl },
                        { label: 'Débitos Manuais', valor: dados.totais_finais.debitos_manuais },
                        { label: 'Débitos TFL', valor: dados.totais_finais.debitos_tfl },
                    ].map((r, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5">
                            <span className="text-muted">{r.label}</span>
                            <span className="font-semibold tabular-nums">{fmt(r.valor)}</span>
                        </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 space-y-1">
                        <div className="flex justify-between text-sm font-bold">
                            <span>Total Créditos</span>
                            <span className="text-success tabular-nums">{fmt(dados.totais_finais.total_creditos)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                            <span>Total Débitos</span>
                            <span className="text-danger tabular-nums">{fmt(dados.totais_finais.total_debitos)}</span>
                        </div>
                        <div className="flex justify-between text-base font-black border-t border-border pt-2">
                            <span>Saldo Final</span>
                            <span className="text-primary-blue-light tabular-nums">{fmt(dados.totais_finais.saldo_final)}</span>
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
}

// ─── Modal Auditoria TFL ──────────────────────────────────────────────────────

function ModalAuditoriaTFL({
    registro,
    onClose,
    onAprovar,
    onRejeitar,
}: {
    registro: RegistroHistorico;
    onClose: () => void;
    onAprovar: (obs: string) => void;
    onRejeitar: (justificativa: string) => void;
}) {
    const [modo, setModo] = useState<'ver' | 'rejeitar'>('ver');
    const [observacoes, setObservacoes] = useState('');
    const [justificativa, setJustificativa] = useState('');

    return (
        <>
            <div className="fixed inset-0 bg-black/80 z-[9998]" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto bg-bg-card border border-border rounded-2xl z-[9999] p-6">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h2 className="text-xl font-bold">Auditoria — Fechamento TFL</h2>
                        <p className="text-xs text-muted mt-0.5">
                            Terminal {registro.terminal ?? '—'} •{' '}
                            {registro.data_referencia
                                ? new Date(registro.data_referencia).toLocaleDateString('pt-BR')
                                : '—'}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={18} /></button>
                </div>

                {/* KPIs topo */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-center">
                        <p className="text-[9px] font-bold text-success uppercase mb-1">Créditos</p>
                        <p className="text-xl font-black text-success">{fmt(registro.total_creditos)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-center">
                        <p className="text-[9px] font-bold text-danger uppercase mb-1">Débitos</p>
                        <p className="text-xl font-black text-danger">{fmt(registro.total_debitos)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-primary-blue-light/10 border border-primary-blue-light/20 text-center">
                        <p className="text-[9px] font-bold text-primary-blue-light uppercase mb-1">Saldo Final</p>
                        <p className="text-xl font-black text-primary-blue-light">{fmt(registro.saldo_final)}</p>
                    </div>
                </div>

                {/* Detalhes completos */}
                <div className="mb-6">
                    <DetalhesTFL dados={registro.dados_extraidos} />
                </div>

                {/* Ações */}
                {registro.status_auditoria === 'pendente' && (
                    modo === 'ver' ? (
                        <div className="flex gap-3 justify-end border-t border-border pt-4">
                            <button className="btn btn-ghost text-sm" onClick={onClose}>Cancelar</button>
                            <button
                                className="btn bg-danger/10 text-danger hover:bg-danger/20 text-sm"
                                onClick={() => setModo('rejeitar')}
                            >
                                Rejeitar
                            </button>
                            <button
                                className="btn btn-success text-sm"
                                onClick={() => onAprovar(observacoes)}
                            >
                                <ShieldCheck size={14} /> Aprovar Fechamento
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 border-t border-border pt-4">
                            <div className="form-group">
                                <label className="text-xs font-bold">Justificativa da rejeição</label>
                                <textarea
                                    className="input w-full text-sm"
                                    rows={3}
                                    value={justificativa}
                                    onChange={(e) => setJustificativa(e.target.value)}
                                    placeholder="Descreva o motivo da rejeição..."
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button className="btn btn-ghost text-sm" onClick={() => setModo('ver')}>Voltar</button>
                                <button
                                    className="btn btn-danger text-sm"
                                    disabled={!justificativa.trim()}
                                    onClick={() => onRejeitar(justificativa)}
                                >
                                    Confirmar Rejeição
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </>
    );
}

// ─── Histórico ────────────────────────────────────────────────────────────────

function HistoricoTFL({
    registros,
    loading,
    onRefresh,
    onAuditar,
}: {
    registros: RegistroHistorico[];
    loading: boolean;
    onRefresh: () => void;
    onAuditar: (r: RegistroHistorico) => void;
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-primary" size={28} />
            </div>
        );
    }

    if (registros.length === 0) {
        return (
            <div className="text-center py-12 text-muted">
                <Eye size={36} strokeWidth={1.2} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">Nenhum fechamento TFL importado ainda.</p>
                <p className="text-xs mt-1">Faça upload de um relatório para começar.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {registros.map(r => (
                <div
                    key={r.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-subtle hover:bg-bg-card-hover transition-colors cursor-pointer"
                    onClick={() => onAuditar(r)}
                >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-sm">Terminal {r.terminal ?? '—'}</span>
                            {getStatusBadge(r.status_auditoria)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                            <span className="flex items-center gap-0.5">
                                <Calendar size={10} />
                                {r.data_referencia
                                    ? new Date(r.data_referencia + 'T12:00:00').toLocaleDateString('pt-BR')
                                    : '—'}
                            </span>
                            <span className="flex items-center gap-0.5">
                                <Receipt size={10} /> {r.arquivo_nome ?? '—'}
                            </span>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted">Saldo Final</p>
                        <p className="font-black text-primary-blue-light tabular-nums">{fmt(r.saldo_final)}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted flex-shrink-0" />
                </div>
            ))}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FechamentoCaixaTFL() {
    const supabase = createBrowserSupabaseClient();
    const { lojaAtual } = useLoja();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [aba, setAba] = useState<'upload' | 'historico'>('upload');
    const [dragging, setDragging] = useState(false);
    const [registros, setRegistros] = useState<RegistroTFL[]>([]);
    const [historico, setHistorico] = useState<RegistroHistorico[]>([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [registroAuditar, setRegistroAuditar] = useState<RegistroHistorico | null>(null);

    const carregarHistorico = useCallback(async () => {
        setLoadingHistorico(true);
        try {
            const { data, error } = await supabase
                .from('fechamento_tfl')
                .select('id, data_referencia, terminal, total_creditos, total_debitos, saldo_final, arquivo_nome, status_auditoria, dados_extraidos, created_at')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setHistorico((data ?? []) as RegistroHistorico[]);
        } catch (err: any) {
            toast({ message: 'Erro ao carregar histórico: ' + err.message, type: 'error' });
        } finally {
            setLoadingHistorico(false);
        }
    }, [supabase, toast]);

    useEffect(() => {
        if (aba === 'historico') carregarHistorico();
    }, [aba, carregarHistorico]);

    const addFile = useCallback((file: File) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
            toast({ message: 'Formato não suportado. Use PDF ou imagem.', type: 'error' });
            return;
        }
        const novo: RegistroTFL = {
            id: crypto.randomUUID(),
            arquivo_nome: file.name,
            status: 'aguardando',
            resultado: null,
            erro: null,
            dbId: null,
            expandido: false,
        };
        setRegistros(prev => [novo, ...prev]);

        processarArquivo(novo.id, file);
    }, []);

    const processarArquivo = useCallback(async (id: string, file: File) => {
        setRegistros(prev => prev.map(r => r.id === id ? { ...r, status: 'processando' } : r));
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/caixa/parse-tfl', { method: 'POST', body: formData });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? 'Erro na API');
            }
            const resultado: RelatorioTFL = await res.json();
            setRegistros(prev => prev.map(r =>
                r.id === id ? { ...r, status: 'concluido', resultado, expandido: true } : r
            ));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            setRegistros(prev => prev.map(r =>
                r.id === id ? { ...r, status: 'erro', erro: msg } : r
            ));
        }
    }, []);

    const enviarParaAuditoria = useCallback(async (id: string) => {
        const item = registros.find(r => r.id === id);
        if (!item?.resultado) return;

        const { data: userData } = await supabase.auth.getUser();
        const d = item.resultado;

        let dataRef: string | null = null;
        if (d.data_referencia) {
            const parts = d.data_referencia.split('/');
            if (parts.length === 3) dataRef = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        const { data, error } = await supabase
            .from('fechamento_tfl')
            .insert({
                loja_id: lojaAtual?.id ?? null,
                user_id: userData?.user?.id ?? null,
                data_referencia: dataRef,
                terminal: d.terminal,
                total_creditos: d.total_creditos ?? 0,
                total_debitos: d.total_debitos ?? 0,
                saldo_final: d.saldo_final ?? 0,
                dados_extraidos: d,
                arquivo_nome: item.arquivo_nome,
                status_auditoria: 'pendente',
            })
            .select('id')
            .maybeSingle();

        if (error) {
            toast({ message: 'Erro ao enviar: ' + error.message, type: 'error' });
            return;
        }

        setRegistros(prev => prev.map(r =>
            r.id === id ? { ...r, status: 'enviado', dbId: data?.id ?? null } : r
        ));
        toast({ message: 'Fechamento enviado para auditoria!', type: 'success' });
    }, [registros, supabase, lojaAtual, toast]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        Array.from(e.dataTransfer.files).forEach(addFile);
    }, [addFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(e.target.files ?? []).forEach(addFile);
        e.target.value = '';
    }, [addFile]);

    const handleAprovar = async (obs: string) => {
        if (!registroAuditar) return;
        const { error } = await supabase
            .from('fechamento_tfl')
            .update({ status_auditoria: 'aprovado', observacoes_auditoria: obs, auditado_em: new Date().toISOString() })
            .eq('id', registroAuditar.id);

        if (error) {
            toast({ message: 'Erro ao aprovar: ' + error.message, type: 'error' });
            return;
        }
        toast({ message: 'Fechamento aprovado!', type: 'success' });
        setRegistroAuditar(null);
        carregarHistorico();
    };

    const handleRejeitar = async (justificativa: string) => {
        if (!registroAuditar) return;
        const { error } = await supabase
            .from('fechamento_tfl')
            .update({ status_auditoria: 'rejeitado', observacoes_auditoria: justificativa, auditado_em: new Date().toISOString() })
            .eq('id', registroAuditar.id);

        if (error) {
            toast({ message: 'Erro ao rejeitar: ' + error.message, type: 'error' });
            return;
        }
        toast({ message: 'Fechamento rejeitado.', type: 'warning' });
        setRegistroAuditar(null);
        carregarHistorico();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="text-primary" size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold">Fechamento de Caixa TFL</h3>
                    <p className="text-xs text-muted">Importe o relatório Conexão Parceiros para análise e auditoria automática</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {[
                    { id: 'upload' as const, label: 'Importar Relatório' },
                    { id: 'historico' as const, label: 'Histórico & Auditoria' },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setAba(t.id)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            aba === t.id
                                ? 'border-primary-blue-light text-primary-blue-light'
                                : 'border-transparent text-muted hover:text-primary'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Upload Tab ── */}
            {aba === 'upload' && (
                <div className="space-y-4">
                    {/* Drop zone */}
                    <div
                        className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
                            dragging
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50 hover:bg-surface-subtle'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileInput}
                        />
                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted select-none">
                            <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center">
                                <Upload size={24} strokeWidth={1.5} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold">Arraste o relatório aqui</p>
                                <p className="text-xs mt-0.5">PDF ou imagem (JPG, PNG) do relatório Conexão Parceiros</p>
                            </div>
                        </div>
                    </div>

                    {/* Lista de arquivos */}
                    {registros.length > 0 && (
                        <div className="space-y-3">
                            {registros.map(item => (
                                <div key={item.id} className="rounded-xl border border-border bg-bg-card overflow-hidden">
                                    {/* Row */}
                                    <div className="flex items-center gap-3 p-4">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            item.status === 'concluido' || item.status === 'enviado'
                                                ? 'bg-success/10 text-success'
                                                : item.status === 'erro'
                                                ? 'bg-danger/10 text-danger'
                                                : 'bg-primary/10 text-primary'
                                        }`}>
                                            {item.status === 'processando'
                                                ? <Loader2 size={16} className="animate-spin" />
                                                : item.status === 'concluido' || item.status === 'enviado'
                                                ? <CheckCircle2 size={16} />
                                                : item.status === 'erro'
                                                ? <AlertCircle size={16} />
                                                : <FileText size={16} />
                                            }
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{item.arquivo_nome}</p>
                                            <p className="text-xs text-muted mt-0.5">
                                                {item.status === 'aguardando' && 'Aguardando processamento...'}
                                                {item.status === 'processando' && 'Extraindo dados com IA...'}
                                                {item.status === 'concluido' && item.resultado && (
                                                    <>
                                                        Terminal {item.resultado.terminal ?? '—'} •{' '}
                                                        {item.resultado.data_referencia ?? '—'} •{' '}
                                                        Saldo: {fmt(item.resultado.saldo_final)}
                                                    </>
                                                )}
                                                {item.status === 'enviado' && 'Enviado para auditoria'}
                                                {item.status === 'erro' && (
                                                    <span className="text-danger">{item.erro}</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {item.status === 'concluido' && (
                                                <>
                                                    <button
                                                        onClick={() => setRegistros(prev => prev.map(r => r.id === item.id ? { ...r, expandido: !r.expandido } : r))}
                                                        className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                                        title="Ver detalhes"
                                                    >
                                                        {item.expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={() => enviarParaAuditoria(item.id)}
                                                        className="btn btn-primary btn-sm text-xs flex items-center gap-1"
                                                        title="Enviar para auditoria"
                                                    >
                                                        <Send size={12} /> Enviar para Auditoria
                                                    </button>
                                                </>
                                            )}
                                            {item.status === 'enviado' && (
                                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-success/10 text-success border border-success/20">
                                                    ENVIADO
                                                </span>
                                            )}
                                            <button
                                                onClick={() => setRegistros(prev => prev.filter(r => r.id !== item.id))}
                                                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {item.expandido && item.resultado && (
                                        <div className="border-t border-border p-4">
                                            <DetalhesTFL dados={item.resultado} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {registros.length === 0 && (
                        <div className="text-center py-8 text-muted">
                            <FileText size={36} strokeWidth={1.2} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Importe o relatório de fechamento do Conexão Parceiros para começar.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Histórico Tab ── */}
            {aba === 'historico' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={carregarHistorico}
                            className="btn btn-ghost btn-sm text-xs flex items-center gap-1.5"
                        >
                            <RefreshCw size={13} className={loadingHistorico ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                    </div>
                    <HistoricoTFL
                        registros={historico}
                        loading={loadingHistorico}
                        onRefresh={carregarHistorico}
                        onAuditar={setRegistroAuditar}
                    />
                </div>
            )}

            {/* Modal Auditoria */}
            {registroAuditar && (
                <ModalAuditoriaTFL
                    registro={registroAuditar}
                    onClose={() => setRegistroAuditar(null)}
                    onAprovar={handleAprovar}
                    onRejeitar={handleRejeitar}
                />
            )}
        </div>
    );
}
