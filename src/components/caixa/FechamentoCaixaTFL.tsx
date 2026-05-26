'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, X, Loader as Loader2, TrendingUp, TrendingDown, ChevronRight, ChevronDown, Banknote, Send, Store } from 'lucide-react';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function FechamentoCaixaTFL() {
    const supabase = createBrowserSupabaseClient();
    const { lojaAtual, lojasDisponiveis } = useLoja();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [lojaSelecionada, setLojaSelecionada] = useState<string>('');
    const [dragging, setDragging] = useState(false);
    const [registros, setRegistros] = useState<RegistroTFL[]>([]);

    const lojaIdEfetiva = lojaSelecionada || lojaAtual?.id || '';

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

        if (!lojaIdEfetiva) {
            toast({ message: 'Selecione uma loja antes de enviar.', type: 'error' });
            return;
        }

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
                loja_id: lojaIdEfetiva,
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
    }, [registros, supabase, lojaIdEfetiva, toast]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        Array.from(e.dataTransfer.files).forEach(addFile);
    }, [addFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(e.target.files ?? []).forEach(addFile);
        e.target.value = '';
    }, [addFile]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="text-primary" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Importar Relatório TFL</h3>
                        <p className="text-xs text-muted">Importe o relatório Conexão Parceiros — o histórico e auditoria ficam na aba Auditoria</p>
                    </div>
                </div>

                {/* Seletor de Loja */}
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-subtle px-3 py-2 min-w-[220px]">
                    <Store size={14} className="text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Loja do fechamento</p>
                        {lojasDisponiveis.length > 1 ? (
                            <select
                                className="w-full bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
                                value={lojaSelecionada || lojaAtual?.id || ''}
                                onChange={e => setLojaSelecionada(e.target.value)}
                            >
                                {lojasDisponiveis.map(l => (
                                    <option key={l.id} value={l.id}>{l.nome_fantasia}</option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-xs font-semibold truncate">
                                {lojaAtual?.nome_fantasia ?? 'Nenhuma loja selecionada'}
                            </p>
                        )}
                    </div>
                </div>
            </div>

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
    );
}
