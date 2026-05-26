'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    ChevronRight, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle,
    RefreshCw, ShieldCheck, Loader as Loader2, X, TrendingUp, TrendingDown,
    ListFilter as Filter, Brain, CircleAlert as AlertCircle,
    CircleCheck as CheckCircle, TriangleAlert as AlertTriangleIcon,
    FileText, Banknote, Wallet, ArrowDownLeft, ArrowUpRight,
    Receipt, CreditCard, Landmark, Coins, Plus, Trash2, CalendarDays,
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import {
    getFechamentosAuditoria,
    aprovarFechamento,
    rejeitarFechamento,
} from '@/actions/auditoria';
import {
    adicionarPixExterno,
    removerPixExterno,
    getPixExternosPorSessao,
    type PixExterno,
} from '@/actions/extrato-conciliacao';

// ─── TFL types (espelho de FechamentoCaixaTFL) ─────────────────────────────────

interface JogoTFL { descricao: string; numero_sorteio?: string | null; quantidade: number; valor: number; }
interface ContaTFL { descricao: string; quantidade: number; valor: number; }
interface PremioTFL { descricao: string; quantidade: number; valor: number; }
interface PagamentoTFL { descricao: string; quantidade: number; valor: number; }
interface ServicoContaTFL { descricao: string; quantidade: number; valor: number; }

interface RelatorioTFL {
    data_referencia: string | null;
    terminal: string | null;
    total_creditos: number | null;
    total_debitos: number | null;
    saldo_final: number | null;
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
    premios_pagos: { itens: PremioTFL[]; total_quantidade: number | null; total_valor: number | null; };
    pagamentos: { itens: PagamentoTFL[]; total_quantidade: number | null; total_valor: number | null; };
    servicos_conta: { itens: ServicoContaTFL[]; total_quantidade: number | null; total_valor: number | null; };
    total_em_caixa: number | null;
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

// ─── Main types ────────────────────────────────────────────────────────────────

type FonteRegistro = 'caixa_sessoes' | 'fechamento_tfl';

interface Fechamento {
    id: string;
    fonte: FonteRegistro;
    data_turno: string;
    data_fechamento: string;
    terminal_id: string;
    operador_id: string;
    operador_nome?: string;
    valor_inicial: number;
    total_lancamentos: number;
    saldo_no_caixa: number;
    divergencia: number;
    valor_na_conta: number;
    total_pix: number;
    total_dinheiro: number;
    total_sangrias: number;
    total_depositos: number;
    total_boletos: number;
    total_trocados: number;
    status_validacao: string;
    justificativa?: string;
    valor_cofre?: number;
    valor_pix_externo?: number;
    fundo_caixa_devolvido?: boolean;
    saldo_esperado?: number;
    loja_id?: string;
    // TFL-specific
    total_creditos?: number;
    total_debitos?: number;
    saldo_final?: number;
    arquivo_nome?: string;
    dados_extraidos?: RelatorioTFL;
}

interface AnaliseIA {
    id: string;
    recomendacao: 'APROVAR' | 'REJEITAR' | 'REVISAR';
    risco: 'BAIXO' | 'MEDIO' | 'ALTO';
    parecer: string;
    alertas: string[];
}

interface ResultadoAnalise {
    analises: AnaliseIA[];
    resumo: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const formatarDataLocal = (dataStr: string) => {
    if (!dataStr) return '-';
    if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    if (dataStr.includes('T')) {
        const [data] = dataStr.split('T');
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    return dataStr;
};

const formatarDataHoraLocal = (dataStr: string | null) => {
    if (!dataStr) return '-';
    if (dataStr.includes('T')) {
        const [data, hora] = dataStr.split('T');
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano} ${hora.substring(0, 5)}`;
    }
    return formatarDataLocal(dataStr);
};

// ─── Detalhamento TFL ─────────────────────────────────────────────────────────

function SecaoTFL({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">{titulo}</p>
            {children}
        </div>
    );
}

function TabelaTFL({ rows, totalLabel, totalQtd, totalValor, corTotal }: {
    rows: { desc: string; qtd: number; valor: number }[];
    totalLabel?: string;
    totalQtd?: number | null;
    totalValor?: number | null;
    corTotal?: string;
}) {
    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                    <th className="text-left pb-1 font-bold">Descrição</th>
                    <th className="text-right pb-1 font-bold">Qtde</th>
                    <th className="text-right pb-1 font-bold">Valor</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                        <td className="py-1">{r.desc}</td>
                        <td className="py-1 text-right text-muted tabular-nums">{r.qtd}</td>
                        <td className="py-1 text-right font-semibold tabular-nums">{fmt(r.valor)}</td>
                    </tr>
                ))}
                {totalLabel && (
                    <tr className={`font-bold border-t border-border ${corTotal ?? ''}`}>
                        <td className="pt-2 uppercase">{totalLabel}</td>
                        <td className="pt-2 text-right tabular-nums">{totalQtd ?? '—'}</td>
                        <td className={`pt-2 text-right tabular-nums ${corTotal ?? ''}`}>{fmt(totalValor)}</td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function DetalhesTFL({ dados }: { dados: RelatorioTFL }) {
    return (
        <div className="space-y-5 text-sm">
            <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl border border-border bg-surface-subtle">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Créditos</p>
                    <p className="text-base font-black text-success tabular-nums">{fmt(dados.total_creditos)}</p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-surface-subtle">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Débitos</p>
                    <p className="text-base font-black text-danger tabular-nums">{fmt(dados.total_debitos)}</p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-surface-subtle">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Saldo Final</p>
                    <p className="text-base font-black text-primary-blue-light tabular-nums">{fmt(dados.saldo_final)}</p>
                </div>
            </div>

            {dados.recebimentos?.jogos?.length > 0 && (
                <SecaoTFL titulo="Recebimentos — Jogos">
                    <TabelaTFL
                        rows={dados.recebimentos.jogos.map(j => ({
                            desc: j.descricao + (j.numero_sorteio ? ` #${j.numero_sorteio}` : ''),
                            qtd: j.quantidade,
                            valor: j.valor,
                        }))}
                        totalLabel="Total Jogos"
                        totalQtd={dados.recebimentos.total_jogos_quantidade}
                        totalValor={dados.recebimentos.total_jogos_valor}
                        corTotal="text-success"
                    />
                </SecaoTFL>
            )}

            {dados.recebimentos?.contas?.length > 0 && (
                <SecaoTFL titulo="Recebimentos — Contas">
                    <TabelaTFL
                        rows={dados.recebimentos.contas.map(c => ({ desc: c.descricao, qtd: c.quantidade, valor: c.valor }))}
                        totalLabel="Total Contas"
                        totalQtd={dados.recebimentos.total_contas_quantidade}
                        totalValor={dados.recebimentos.total_contas_valor}
                        corTotal="text-success"
                    />
                    <div className="flex justify-between text-sm font-black border-t-2 border-border pt-2 mt-1">
                        <span className="uppercase">Total Recebimentos</span>
                        <span className="text-success tabular-nums">{fmt(dados.recebimentos.total_recebimentos_valor)}</span>
                    </div>
                </SecaoTFL>
            )}

            {dados.premios_pagos?.itens?.length > 0 && (
                <SecaoTFL titulo="Prêmios Pagos">
                    <TabelaTFL
                        rows={dados.premios_pagos.itens.map(p => ({ desc: p.descricao, qtd: p.quantidade, valor: p.valor }))}
                        totalLabel="Total Prêmios"
                        totalQtd={dados.premios_pagos.total_quantidade}
                        totalValor={dados.premios_pagos.total_valor}
                        corTotal="text-danger"
                    />
                </SecaoTFL>
            )}

            {dados.pagamentos?.itens?.length > 0 && (
                <SecaoTFL titulo="Pagamentos">
                    <TabelaTFL
                        rows={dados.pagamentos.itens.map(p => ({ desc: p.descricao, qtd: p.quantidade, valor: p.valor }))}
                    />
                </SecaoTFL>
            )}

            {dados.servicos_conta?.itens?.length > 0 && (
                <SecaoTFL titulo="Serviços Conta Corrente / Poupança">
                    <TabelaTFL
                        rows={dados.servicos_conta.itens.map(s => ({ desc: s.descricao, qtd: s.quantidade, valor: s.valor }))}
                        totalLabel="Total Conta"
                        totalQtd={dados.servicos_conta.total_quantidade}
                        totalValor={dados.servicos_conta.total_valor}
                    />
                </SecaoTFL>
            )}

            {dados.total_em_caixa != null && (
                <div className="p-3 rounded-xl bg-primary-blue-light/10 border border-primary-blue-light/20 text-center">
                    <p className="text-[10px] font-bold text-primary-blue-light uppercase mb-1">Total em Caixa</p>
                    <p className="text-xl font-black text-primary-blue-light">{fmt(dados.total_em_caixa)}</p>
                </div>
            )}

            <SecaoTFL titulo="Totais Finais">
                <div className="rounded-xl border border-border p-3 bg-surface-subtle space-y-1">
                    {[
                        { label: 'Créditos Manuais', valor: dados.totais_finais?.creditos_manuais },
                        { label: 'Créditos TFL',     valor: dados.totais_finais?.creditos_tfl },
                        { label: 'Débitos Manuais',  valor: dados.totais_finais?.debitos_manuais },
                        { label: 'Débitos TFL',      valor: dados.totais_finais?.debitos_tfl },
                    ].map((r, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5">
                            <span className="text-muted">{r.label}</span>
                            <span className="font-semibold tabular-nums">{fmt(r.valor)}</span>
                        </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 space-y-1">
                        <div className="flex justify-between text-sm font-bold">
                            <span>Total Créditos</span>
                            <span className="text-success tabular-nums">{fmt(dados.totais_finais?.total_creditos)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                            <span>Total Débitos</span>
                            <span className="text-danger tabular-nums">{fmt(dados.totais_finais?.total_debitos)}</span>
                        </div>
                        <div className="flex justify-between text-base font-black border-t border-border pt-2">
                            <span>Saldo Final</span>
                            <span className="text-primary-blue-light tabular-nums">{fmt(dados.totais_finais?.saldo_final)}</span>
                        </div>
                    </div>
                </div>
            </SecaoTFL>
        </div>
    );
}

// ─── Detalhamento Operador ────────────────────────────────────────────────────

function DetalhesOperador({ f }: { f: Fechamento }) {
    const totalEntradas = (f.total_pix || 0) + (f.total_dinheiro || 0);
    const totalSaidas = (f.total_sangrias || 0) + (f.total_depositos || 0) + (f.total_boletos || 0) + (f.total_trocados || 0);

    return (
        <div className="space-y-4 text-sm">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl border border-border bg-surface-subtle">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Entradas</p>
                    <p className="text-base font-black text-success tabular-nums">{fmt(totalEntradas)}</p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-surface-subtle">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Saídas</p>
                    <p className="text-base font-black text-danger tabular-nums">{fmt(totalSaidas)}</p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-surface-subtle">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Valor na Conta</p>
                    <p className="text-base font-black text-primary-blue-light tabular-nums">{fmt(f.valor_na_conta)}</p>
                </div>
            </div>

            {/* Entradas */}
            <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Detalhamento de Entradas</p>
                <div className="rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-surface-subtle/50">
                        <div className="flex items-center gap-2 text-success">
                            <Wallet size={13} />
                            <span className="text-xs font-semibold">PIX</span>
                        </div>
                        <span className="text-sm font-bold text-success tabular-nums">{fmt(f.total_pix)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-subtle/20">
                        <div className="flex items-center gap-2 text-success">
                            <Banknote size={13} />
                            <span className="text-xs font-semibold">Dinheiro</span>
                        </div>
                        <span className="text-sm font-bold text-success tabular-nums">{fmt(f.total_dinheiro)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-success/5">
                        <span className="text-xs font-black uppercase text-success">Total Entradas</span>
                        <span className="text-sm font-black text-success tabular-nums">{fmt(totalEntradas)}</span>
                    </div>
                </div>
            </div>

            {/* Saídas */}
            <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Detalhamento de Saídas</p>
                <div className="rounded-xl border border-border overflow-hidden">
                    {[
                        { icon: <ArrowUpRight size={13} />, label: 'Sangrias',  valor: f.total_sangrias  || 0 },
                        { icon: <Landmark     size={13} />, label: 'Depósitos', valor: f.total_depositos || 0 },
                        { icon: <Receipt      size={13} />, label: 'Boletos',   valor: f.total_boletos   || 0 },
                        { icon: <Coins        size={13} />, label: 'Trocados',  valor: f.total_trocados  || 0 },
                    ].map((row, i, arr) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 ${i < arr.length - 1 ? 'border-b border-border/60' : ''} bg-surface-subtle/20`}>
                            <div className="flex items-center gap-2 text-danger">
                                {row.icon}
                                <span className="text-xs font-semibold">{row.label}</span>
                            </div>
                            <span className="text-sm font-bold text-danger tabular-nums">{fmt(row.valor)}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-danger/5">
                        <span className="text-xs font-black uppercase text-danger">Total Saídas</span>
                        <span className="text-sm font-black text-danger tabular-nums">{fmt(totalSaidas)}</span>
                    </div>
                </div>
            </div>

            {/* Complementares */}
            {((f.valor_pix_externo || 0) > 0 || (f.valor_cofre || 0) > 0 || f.valor_inicial > 0) && (
                <div>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Valores Complementares</p>
                    <div className="rounded-xl border border-border overflow-hidden">
                        {f.valor_inicial > 0 && (
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-surface-subtle/20">
                                <div className="flex items-center gap-2 text-muted">
                                    <CreditCard size={13} />
                                    <span className="text-xs font-semibold">Fundo de Caixa Inicial</span>
                                </div>
                                <span className="text-sm font-bold tabular-nums">{fmt(f.valor_inicial)}</span>
                            </div>
                        )}
                        {(f.valor_pix_externo || 0) > 0 && (
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-surface-subtle/20">
                                <div className="flex items-center gap-2 text-muted">
                                    <ArrowDownLeft size={13} />
                                    <span className="text-xs font-semibold">PIX Externo Informado</span>
                                </div>
                                <span className="text-sm font-bold tabular-nums">{fmt(f.valor_pix_externo)}</span>
                            </div>
                        )}
                        {(f.valor_cofre || 0) > 0 && (
                            <div className="flex items-center justify-between px-3 py-2 bg-surface-subtle/20">
                                <div className="flex items-center gap-2 text-muted">
                                    <ShieldCheck size={13} />
                                    <span className="text-xs font-semibold">Enviado ao Cofre</span>
                                </div>
                                <span className="text-sm font-bold tabular-nums">{fmt(f.valor_cofre)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Resumo final */}
            <div className="rounded-xl border border-border p-3 bg-surface-subtle space-y-1">
                <div className="flex justify-between text-xs py-0.5">
                    <span className="text-muted">Saldo Esperado</span>
                    <span className="font-semibold tabular-nums">{fmt(f.saldo_esperado)}</span>
                </div>
                <div className="flex justify-between text-xs py-0.5">
                    <span className="text-muted">Valor Declarado no Caixa</span>
                    <span className="font-semibold tabular-nums">{fmt(f.saldo_no_caixa)}</span>
                </div>
                <div className={`flex justify-between text-sm font-bold border-t border-border pt-2 mt-1 ${Math.abs(f.divergencia) > 5 ? 'text-danger' : 'text-success'}`}>
                    <span>Divergência</span>
                    <span className="tabular-nums">{fmt(f.divergencia)}</span>
                </div>
                <div className="flex justify-between text-base font-black border-t border-border pt-2 mt-1">
                    <span>Valor na Conta</span>
                    <span className="text-primary-blue-light tabular-nums">{fmt(f.valor_na_conta)}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Formulário de PIX Externos Unitários ────────────────────────────────────

function PixExternosForm({
    sessaoId,
    lojaId,
    dataTurno,
}: {
    sessaoId: number;
    lojaId: string;
    dataTurno: string;
}) {
    const { toast } = useToast();
    const [lista, setLista] = useState<PixExterno[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [novoValor, setNovoValor] = useState('');
    const [novaData, setNovaData] = useState(dataTurno);
    const [novaDescricao, setNovaDescricao] = useState('');

    useEffect(() => {
        getPixExternosPorSessao(sessaoId)
            .then(setLista)
            .catch(() => toast({ type: 'error', message: 'Erro ao carregar PIX externos.' }))
            .finally(() => setCarregando(false));
    }, [sessaoId, toast]);

    async function adicionar() {
        const valor = parseFloat(novoValor.replace(',', '.'));
        if (!valor || valor <= 0) {
            toast({ type: 'warning', message: 'Informe um valor válido.' });
            return;
        }
        if (!novaData) {
            toast({ type: 'warning', message: 'Informe a data do PIX.' });
            return;
        }
        setSalvando(true);
        try {
            const pix = await adicionarPixExterno({
                sessao_id: sessaoId,
                loja_id: lojaId,
                valor,
                data_pix: novaData,
                descricao: novaDescricao,
            });
            setLista(prev => [...prev, pix]);
            setNovoValor('');
            setNovaDescricao('');
            toast({ type: 'success', message: 'PIX externo adicionado.' });
        } catch (e: unknown) {
            toast({ type: 'error', message: 'Erro ao adicionar PIX externo.' });
            console.error(e);
        } finally {
            setSalvando(false);
        }
    }

    async function remover(id: number) {
        try {
            await removerPixExterno(id);
            setLista(prev => prev.filter(p => p.id !== id));
            toast({ type: 'success', message: 'PIX externo removido.' });
        } catch (e: unknown) {
            toast({ type: 'error', message: 'Erro ao remover PIX externo.' });
            console.error(e);
        }
    }

    const totalPix = lista.reduce((a, p) => a + p.valor, 0);

    return (
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CreditCard size={13} className="text-blue-400" />
                    <span className="text-xs font-bold text-blue-300">PIX Externos Unitários</span>
                </div>
                {lista.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-400">
                        Total: {totalPix.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                )}
            </div>

            {/* Lista existente */}
            {carregando ? (
                <div className="flex items-center gap-2 text-xs text-muted py-1">
                    <Loader2 size={11} className="animate-spin" /> Carregando...
                </div>
            ) : lista.length > 0 ? (
                <div className="space-y-1.5">
                    {lista.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-white/3 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-muted flex items-center gap-1">
                                    <CalendarDays size={10} />
                                    {p.data_pix.split('T')[0].split('-').reverse().join('/')}
                                </span>
                                <span className="text-xs font-semibold text-blue-300">
                                    {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                                {p.descricao && <span className="text-[10px] text-muted">{p.descricao}</span>}
                                {p.conciliado && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/10 text-success">Conciliado</span>
                                )}
                            </div>
                            <button
                                onClick={() => remover(p.id)}
                                className="p-1 hover:text-error transition-colors text-muted"
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-[10px] text-muted">Nenhum PIX externo registrado.</p>
            )}

            {/* Formulário para adicionar */}
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-[10px] text-muted mb-1">Valor (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        className="input w-full text-xs h-8"
                        value={novoValor}
                        onChange={e => setNovoValor(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-muted mb-1">Data</label>
                    <input
                        type="date"
                        className="input w-full text-xs h-8"
                        value={novaData}
                        onChange={e => setNovaData(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-muted mb-1">Descrição</label>
                    <input
                        type="text"
                        placeholder="Opcional"
                        className="input w-full text-xs h-8"
                        value={novaDescricao}
                        onChange={e => setNovaDescricao(e.target.value)}
                    />
                </div>
            </div>
            <button
                className="btn btn-ghost text-xs h-8 border border-blue-500/20 text-blue-300 hover:bg-blue-500/10 w-full"
                onClick={adicionar}
                disabled={salvando}
            >
                {salvando ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Adicionar PIX Externo
            </button>
        </div>
    );
}

// ─── Formulário de Depósito no Cofre ─────────────────────────────────────────

function DepositoCofreForm({
    sessaoId,
    lojaId,
    valorAtual,
}: {
    sessaoId: number;
    lojaId: string;
    valorAtual: number;
}) {
    const { toast } = useToast();
    const supabase = createBrowserSupabaseClient();
    const [valor, setValor] = useState(valorAtual > 0 ? String(valorAtual) : '');
    const [salvando, setSalvando] = useState(false);
    const [salvo, setSalvo] = useState(valorAtual > 0);

    async function salvar() {
        const v = parseFloat(valor.replace(',', '.'));
        if (!v || v <= 0) {
            toast({ type: 'warning', message: 'Informe um valor válido para o depósito.' });
            return;
        }
        setSalvando(true);
        try {
            const { error } = await supabase
                .from('caixa_sessoes')
                .update({ valor_enviado_cofre: v })
                .eq('id', sessaoId);
            if (error) throw error;
            setSalvo(true);
            toast({ type: 'success', message: 'Depósito no cofre registrado.' });
        } catch (e: unknown) {
            toast({ type: 'error', message: 'Erro ao salvar depósito no cofre.' });
            console.error(e);
        } finally {
            setSalvando(false);
        }
    }

    return (
        <div className="rounded-xl border border-warning/15 bg-warning/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Landmark size={13} className="text-warning" />
                <span className="text-xs font-bold text-yellow-300">Depósito no Cofre</span>
                {salvo && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/10 text-success">
                        Registrado
                    </span>
                )}
            </div>
            <p className="text-[10px] text-muted">
                Valor físico depositado no cofre ao final do turno. Aparecerá na conciliação bancária.
            </p>
            <div className="flex gap-2">
                <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="input flex-1 text-xs h-8"
                    value={valor}
                    onChange={e => { setValor(e.target.value); setSalvo(false); }}
                />
                <button
                    className="btn btn-ghost text-xs h-8 border border-warning/20 text-yellow-300 hover:bg-warning/10 px-4"
                    onClick={salvar}
                    disabled={salvando}
                >
                    {salvando ? <Loader2 size={11} className="animate-spin" /> : 'Salvar'}
                </button>
            </div>
        </div>
    );
}

// ─── Modal de auditoria ────────────────────────────────────────────────────────

interface ModalAuditoriaProps {
    fechamento: Fechamento;
    onClose: () => void;
    onAprovar: (observacoes: string) => void;
    onRejeitar: (dados: { justificativa: string }) => void;
}

function ModalAuditoria({ fechamento, onClose, onAprovar, onRejeitar }: ModalAuditoriaProps) {
    const [modoRejeitar, setModoRejeitar] = useState(false);
    const [justificativa, setJustificativa] = useState('');
    const [observacoes, setObservacoes] = useState('');

    const isTFL = fechamento.fonte === 'fechamento_tfl';

    return (
        <>
            <div className="fixed inset-0 bg-black/80 z-[9998]" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto bg-bg-card border border-border rounded-2xl z-[9999] p-6">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h2 className="text-xl font-bold">Auditoria de Fechamento</h2>
                        <div className="flex items-center gap-2 mt-1">
                            {isTFL
                                ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5"><FileText size={10} /> RELATÓRIO TFL</span>
                                : <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5">OPERADOR</span>
                            }
                            <span className="text-xs text-muted">
                                Terminal {fechamento.terminal_id} • {formatarDataLocal(fechamento.data_turno)}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={18} /></button>
                </div>

                {/* Detalhamento completo */}
                <div className="mb-6">
                    {isTFL && fechamento.dados_extraidos
                        ? <DetalhesTFL dados={fechamento.dados_extraidos} />
                        : <DetalhesOperador f={fechamento} />
                    }
                </div>

                {/* Justificativa do operador */}
                {fechamento.justificativa && (
                    <div className="mb-5 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-[9px] text-yellow-500 font-bold uppercase">
                            {isTFL ? 'Observações' : 'Justificativa do Operador'}
                        </span>
                        <p className="text-xs text-yellow-600 dark:text-yellow-200 mt-1 italic">"{fechamento.justificativa}"</p>
                    </div>
                )}

                {/* Ações */}
                {!modoRejeitar ? (
                    <div className="flex gap-3 justify-end border-t border-border pt-4">
                        <button className="btn btn-ghost text-sm" onClick={onClose}>Cancelar</button>
                        <button className="btn bg-danger/10 text-danger hover:bg-danger/20 text-sm" onClick={() => setModoRejeitar(true)}>
                            Rejeitar
                        </button>
                        <button className="btn btn-success text-sm" onClick={() => onAprovar(observacoes)}>
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
                                placeholder="Descreva o motivo da rejeição"
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button className="btn btn-ghost text-sm" onClick={() => setModoRejeitar(false)}>Voltar</button>
                            <button
                                className="btn btn-danger text-sm"
                                disabled={!justificativa.trim()}
                                onClick={() => onRejeitar({ justificativa })}
                            >
                                Confirmar Rejeição
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function AuditoriaFechamentos() {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
    const [selectedFechamento, setSelectedFechamento] = useState<Fechamento | null>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [showAdicionaisModal, setShowAdicionaisModal] = useState(false);
    const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado'>('todos');
    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');

    const [analisandoIA, setAnalisandoIA] = useState(false);
    const [resultadoIA, setResultadoIA] = useState<ResultadoAnalise | null>(null);

    const fetchHistorico = useCallback(async () => {
        setLoading(true);
        try {
            // ── caixa_sessoes ────────────────────────────────────────────────
            const sessoesBruto = await getFechamentosAuditoria({
                status: filtroStatus !== 'todos' ? filtroStatus : undefined,
                dataInicio: filtroDataInicio || undefined,
                dataFim: filtroDataFim || undefined,
            });

            const deSessoes: Fechamento[] = sessoesBruto.map((f: any) => {
                const totalPix = (f.resumo_entradas_pix || 0) + (f.resumo_entradas_bolao_pix || 0);
                const totalDinheiro = (f.resumo_entradas_dinheiro || 0) + (f.resumo_entradas_bolao_dinheiro || 0);
                const totalEntradas = totalPix + totalDinheiro;
                const totalSaidas =
                    (f.resumo_saidas_sangria || 0) +
                    (f.resumo_saidas_deposito || 0) +
                    (f.resumo_saidas_boleto || 0) +
                    (f.resumo_saidas_trocados || 0);
                const totalLancamentos = totalEntradas - totalSaidas;
                const valorNaConta = (f.pix_externo_informado || 0) + totalLancamentos;

                return {
                    id: String(f.id),
                    fonte: 'caixa_sessoes' as FonteRegistro,
                    data_turno: f.data_turno || '',
                    data_fechamento: f.data_fechamento,
                    terminal_id: f.terminal_id || 'TFL-WEB',
                    operador_id: f.operador_id || 'Sistema',
                    operador_nome: f.operador_nome || 'Sistema',
                    valor_inicial: f.valor_inicial || 0,
                    total_lancamentos: totalLancamentos,
                    saldo_no_caixa: f.valor_final_declarado || 0,
                    divergencia: f.diferenca_caixa || 0,
                    valor_na_conta: valorNaConta,
                    total_pix: totalPix,
                    total_dinheiro: totalDinheiro,
                    total_sangrias: f.resumo_saidas_sangria || 0,
                    total_depositos: f.resumo_saidas_deposito || 0,
                    total_boletos: f.resumo_saidas_boleto || 0,
                    total_trocados: f.resumo_saidas_trocados || 0,
                    status_validacao: f.auditoria_status || f.status,
                    justificativa: f.observacoes_operador,
                    valor_cofre: f.valor_enviado_cofre || 0,
                    valor_pix_externo: f.pix_externo_informado || 0,
                    fundo_caixa_devolvido: f.fundo_caixa_devolvido,
                    saldo_esperado: (f.valor_inicial || 0) + totalLancamentos,
                    loja_id: f.loja_id,
                };
            });

            // ── fechamento_tfl (inclui dados_extraidos) ──────────────────────
            let tflQuery = supabase
                .from('fechamento_tfl')
                .select('id, data_referencia, terminal, total_creditos, total_debitos, saldo_final, arquivo_nome, status_auditoria, observacoes_auditoria, dados_extraidos, created_at')
                .order('created_at', { ascending: false })
                .limit(100);

            if (filtroStatus !== 'todos') tflQuery = tflQuery.eq('status_auditoria', filtroStatus);
            if (filtroDataInicio) tflQuery = tflQuery.gte('data_referencia', filtroDataInicio);
            if (filtroDataFim) tflQuery = tflQuery.lte('data_referencia', filtroDataFim);

            const { data: tflBruto, error: tflError } = await tflQuery;
            if (tflError) throw tflError;

            const deTFL: Fechamento[] = (tflBruto ?? []).map((r: any) => ({
                id: String(r.id),
                fonte: 'fechamento_tfl' as FonteRegistro,
                data_turno: r.data_referencia || '',
                data_fechamento: r.created_at,
                terminal_id: r.terminal || '—',
                operador_id: '',
                operador_nome: r.arquivo_nome || '—',
                valor_inicial: 0,
                total_lancamentos: (r.total_creditos || 0) - (r.total_debitos || 0),
                saldo_no_caixa: r.saldo_final || 0,
                divergencia: 0,
                valor_na_conta: r.saldo_final || 0,
                total_pix: 0,
                total_dinheiro: 0,
                total_sangrias: 0,
                total_depositos: 0,
                total_boletos: 0,
                total_trocados: 0,
                status_validacao: r.status_auditoria || 'pendente',
                justificativa: r.observacoes_auditoria,
                valor_cofre: 0,
                valor_pix_externo: 0,
                total_creditos: r.total_creditos || 0,
                total_debitos: r.total_debitos || 0,
                saldo_final: r.saldo_final || 0,
                arquivo_nome: r.arquivo_nome,
                dados_extraidos: r.dados_extraidos ?? undefined,
            }));

            const todos = [...deSessoes, ...deTFL].sort((a, b) => {
                const da = a.data_fechamento || a.data_turno;
                const db = b.data_fechamento || b.data_turno;
                return db.localeCompare(da);
            });

            setFechamentos(todos);
        } catch (err: any) {
            toast({ message: 'Erro ao carregar fechamentos: ' + (err.message || 'Erro desconhecido'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filtroStatus, filtroDataInicio, filtroDataFim, toast, supabase]);

    useEffect(() => { fetchHistorico(); }, [fetchHistorico]);

    const handleAprovar = async (fechamento: Fechamento, observacoes: string) => {
        try {
            if (fechamento.fonte === 'caixa_sessoes') {
                await aprovarFechamento(parseInt(fechamento.id), observacoes);
            } else {
                const { error } = await supabase.from('fechamento_tfl').update({
                    status_auditoria: 'aprovado',
                    observacoes_auditoria: observacoes,
                    auditado_em: new Date().toISOString(),
                }).eq('id', fechamento.id);
                if (error) throw error;
            }
            toast({ message: 'Fechamento aprovado com sucesso!', type: 'success' });
            await fetchHistorico();
            setSelectedFechamento(null);
        } catch (error: any) {
            toast({ message: error.message || 'Erro ao aprovar', type: 'error' });
        }
        setShowValidationModal(false);
    };

    const handleRejeitar = async (fechamento: Fechamento, justificativa: string) => {
        try {
            if (fechamento.fonte === 'caixa_sessoes') {
                await rejeitarFechamento(parseInt(fechamento.id), justificativa, false);
            } else {
                const { error } = await supabase.from('fechamento_tfl').update({
                    status_auditoria: 'rejeitado',
                    observacoes_auditoria: justificativa,
                    auditado_em: new Date().toISOString(),
                }).eq('id', fechamento.id);
                if (error) throw error;
            }
            toast({ message: 'Fechamento rejeitado!', type: 'warning' });
            await fetchHistorico();
            setSelectedFechamento(null);
        } catch (error: any) {
            toast({ message: error.message || 'Erro ao rejeitar', type: 'error' });
        }
        setShowValidationModal(false);
    };

    const fazerAnaliseIA = useCallback(async () => {
        const pendentes = fechamentos.filter(f => f.status_validacao === 'pendente');
        if (pendentes.length === 0) {
            toast({ message: 'Nenhum fechamento pendente para analisar.', type: 'warning' });
            return;
        }
        setAnalisandoIA(true);
        setResultadoIA(null);
        try {
            const payload = pendentes.map(f => {
                const isTFL = f.fonte === 'fechamento_tfl';
                if (isTFL) {
                    return {
                        id: f.id,
                        tipo: 'tfl' as const,
                        data_turno: f.data_turno,
                        terminal_id: f.terminal_id,
                        operador_nome: f.arquivo_nome ?? '—',
                        justificativa: f.justificativa,
                        dados_tfl: f.dados_extraidos ? {
                            total_creditos: f.dados_extraidos.total_creditos,
                            total_debitos: f.dados_extraidos.total_debitos,
                            saldo_final: f.dados_extraidos.saldo_final,
                            recebimentos: {
                                jogos: f.dados_extraidos.recebimentos?.jogos ?? [],
                                total_jogos_valor: f.dados_extraidos.recebimentos?.total_jogos_valor,
                                contas: f.dados_extraidos.recebimentos?.contas ?? [],
                                total_contas_valor: f.dados_extraidos.recebimentos?.total_contas_valor,
                                total_recebimentos_valor: f.dados_extraidos.recebimentos?.total_recebimentos_valor,
                            },
                            premios_pagos: {
                                itens: f.dados_extraidos.premios_pagos?.itens ?? [],
                                total_valor: f.dados_extraidos.premios_pagos?.total_valor,
                            },
                            pagamentos: {
                                itens: f.dados_extraidos.pagamentos?.itens ?? [],
                                total_valor: f.dados_extraidos.pagamentos?.total_valor,
                            },
                            servicos_conta: {
                                itens: f.dados_extraidos.servicos_conta?.itens ?? [],
                                total_valor: f.dados_extraidos.servicos_conta?.total_valor,
                            },
                            totais_finais: f.dados_extraidos.totais_finais,
                        } : {
                            total_creditos: f.total_creditos ?? 0,
                            total_debitos: f.total_debitos ?? 0,
                            saldo_final: f.saldo_final ?? 0,
                        },
                    };
                }
                return {
                    id: f.id,
                    tipo: 'operador' as const,
                    data_turno: f.data_turno,
                    terminal_id: f.terminal_id,
                    operador_nome: f.operador_nome ?? 'Sistema',
                    justificativa: f.justificativa,
                    valor_inicial: f.valor_inicial || 0,
                    saldo_esperado: f.saldo_esperado ?? 0,
                    saldo_declarado: f.saldo_no_caixa || 0,
                    divergencia: f.divergencia || 0,
                    total_pix: f.total_pix || 0,
                    total_dinheiro: f.total_dinheiro || 0,
                    total_sangrias: f.total_sangrias || 0,
                    total_depositos: f.total_depositos || 0,
                    total_boletos: f.total_boletos || 0,
                    total_trocados: f.total_trocados || 0,
                    valor_cofre: f.valor_cofre || 0,
                    valor_pix_externo: f.valor_pix_externo || 0,
                    valor_na_conta: f.valor_na_conta || 0,
                };
            });
            const res = await fetch('/api/caixa/analise-auditoria', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechamentos: payload }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Erro na API');
            const resultado: ResultadoAnalise = await res.json();
            setResultadoIA(resultado);
            toast({ message: `Análise concluída para ${pendentes.length} fechamento(s)!`, type: 'success' });
        } catch (err: unknown) {
            toast({ message: 'Erro na análise IA: ' + (err instanceof Error ? err.message : 'Erro desconhecido'), type: 'error' });
        } finally {
            setAnalisandoIA(false);
        }
    }, [fechamentos, toast]);

    const getStatusBadge = (status: string) => {
        const labels: Record<string, string> = { pendente: 'PENDENTE', aprovado: 'APROVADO', rejeitado: 'REJEITADO', correcao_solicitada: 'CORREÇÃO' };
        const colors: Record<string, string> = {
            pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            aprovado: 'bg-green-500/10 text-green-400 border-green-500/20',
            rejeitado: 'bg-red-500/10 text-red-400 border-red-500/20',
            correcao_solicitada: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        };
        return (
            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${colors[status] ?? colors.pendente}`}>
                {labels[status] ?? status}
            </span>
        );
    };

    const getFonteBadge = (fonte: FonteRegistro) =>
        fonte === 'fechamento_tfl' ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-primary/10 text-primary border border-primary/20 flex items-center gap-0.5">
                <FileText size={9} /> TFL
            </span>
        ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                OP
            </span>
        );

    const valorPrincipal = (f: Fechamento) =>
        f.fonte === 'fechamento_tfl' ? (f.saldo_final ?? 0) : (f.valor_na_conta || 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="auditoria-fechamentos">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="text-primary" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Auditoria de Fechamentos</h3>
                        <p className="text-xs text-muted">Operadores (OP) e Relatórios TFL unificados</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                    <select
                        className="input text-xs"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value as any)}
                    >
                        <option value="todos">Todos</option>
                        <option value="pendente">Pendentes</option>
                        <option value="aprovado">Aprovados</option>
                        <option value="rejeitado">Rejeitados</option>
                    </select>
                    <button onClick={fetchHistorico} className="btn btn-ghost btn-sm">
                        <RefreshCw size={14} /> Atualizar
                    </button>
                    <button
                        onClick={fazerAnaliseIA}
                        disabled={analisandoIA || fechamentos.filter(f => f.status_validacao === 'pendente').length === 0}
                        className="btn btn-primary btn-sm disabled:opacity-50"
                    >
                        {analisandoIA
                            ? <><Loader2 size={14} className="animate-spin" /> Analisando...</>
                            : <><Brain size={14} /> Fazer análise</>
                        }
                    </button>
                </div>
            </div>

            {/* Filtros por data */}
            <div className="mb-6 p-4 rounded-xl bg-surface-subtle border border-border">
                <div className="flex items-center gap-2 mb-3">
                    <Filter size={16} className="text-primary-blue-light" />
                    <h4 className="text-sm font-bold">Filtrar por Período</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Início</label>
                        <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="input w-full text-sm" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Fim</label>
                        <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="input w-full text-sm" />
                    </div>
                </div>
                <div className="flex justify-end mt-3">
                    <button onClick={() => { setFiltroDataInicio(''); setFiltroDataFim(''); setFiltroStatus('todos'); }} className="btn btn-ghost btn-sm text-xs">
                        <X size={12} /> Limpar Filtros
                    </button>
                </div>
            </div>

            {/* Resultado da Análise IA */}
            {resultadoIA && (
                <div className="mb-6 rounded-xl border border-border bg-bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle">
                        <div className="flex items-center gap-2">
                            <Brain size={16} className="text-primary" />
                            <span className="text-sm font-bold">Resultado da Análise IA</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                                {resultadoIA.analises.length} fechamento(s)
                            </span>
                        </div>
                        <button onClick={() => setResultadoIA(null)} className="btn btn-ghost btn-sm px-2"><X size={14} /></button>
                    </div>
                    {resultadoIA.resumo && (
                        <div className="px-4 py-3 border-b border-border text-sm text-muted bg-surface-subtle/50">{resultadoIA.resumo}</div>
                    )}
                    <div className="divide-y divide-border">
                        {resultadoIA.analises.map((analise) => {
                            const fech = fechamentos.find(f => f.id === analise.id);
                            const corReco = analise.recomendacao === 'APROVAR' ? 'text-success' : analise.recomendacao === 'REJEITAR' ? 'text-danger' : 'text-warning';
                            const bgReco = analise.recomendacao === 'APROVAR' ? 'bg-success/10 border-success/20' : analise.recomendacao === 'REJEITAR' ? 'bg-danger/10 border-danger/20' : 'bg-warning/10 border-warning/20';
                            const IconReco = analise.recomendacao === 'APROVAR' ? CheckCircle : analise.recomendacao === 'REJEITAR' ? AlertCircle : AlertTriangleIcon;
                            return (
                                <div key={analise.id} className="px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg border ${bgReco}`}>
                                            <IconReco size={14} className={corReco} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-xs font-bold">
                                                    {fech ? `${fech.terminal_id} — ${formatarDataLocal(fech.data_turno)}` : `ID: ${analise.id}`}
                                                </span>
                                                {fech && getFonteBadge(fech.fonte)}
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${bgReco} ${corReco}`}>{analise.recomendacao}</span>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${analise.risco === 'ALTO' ? 'bg-danger/10 text-danger' : analise.risco === 'MEDIO' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                                                    Risco {analise.risco}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted">{analise.parecer}</p>
                                            {analise.alertas?.length > 0 && (
                                                <ul className="mt-1.5 space-y-0.5">
                                                    {analise.alertas.map((a, i) => (
                                                        <li key={i} className="text-[11px] text-warning flex items-center gap-1">
                                                            <AlertTriangle size={10} /> {a}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tabela + painel de detalhes */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedFechamento ? '1fr 520px' : '1fr', gap: '1.5rem' }}>
                <div className="card p-0 overflow-hidden">
                    {fechamentos.length === 0 ? (
                        <div className="p-12 text-center border-dashed">
                            <CheckCircle2 className="mx-auto mb-4 text-success opacity-20" size={48} />
                            <p className="font-bold text-muted">Nenhum encerramento encontrado</p>
                        </div>
                    ) : (
                        <div className="table-container pt-0">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Tipo</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Data</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Terminal</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Operador / Arquivo</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Status</th>
                                        <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">Valor</th>
                                        <th style={{ width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fechamentos.map((f) => (
                                        <tr
                                            key={`${f.fonte}-${f.id}`}
                                            onClick={() => setSelectedFechamento(f)}
                                            className={`cursor-pointer hover:bg-bg-card-hover transition-colors ${
                                                selectedFechamento?.id === f.id && selectedFechamento?.fonte === f.fonte
                                                    ? 'bg-primary/5 border-l-4 border-primary'
                                                    : ''
                                            }`}
                                        >
                                            <td className="py-2 px-2">{getFonteBadge(f.fonte)}</td>
                                            <td className="text-xs py-2 px-2">{formatarDataLocal(f.data_turno)}</td>
                                            <td className="py-2 px-2">
                                                <span className="px-2 py-1 rounded-lg text-xs font-black bg-blue-500/10 text-blue-400">{f.terminal_id}</span>
                                            </td>
                                            <td className="text-xs py-2 px-2 opacity-60 max-w-[140px] truncate">
                                                {f.fonte === 'fechamento_tfl' ? (f.arquivo_nome ?? '—') : f.operador_nome}
                                            </td>
                                            <td className="py-2 px-2">{getStatusBadge(f.status_validacao)}</td>
                                            <td className={`font-bold text-right py-2 px-2 tabular-nums ${valorPrincipal(f) >= 0 ? 'text-success' : 'text-danger'}`}>
                                                {fmt(valorPrincipal(f))}
                                            </td>
                                            <td className="text-right py-2 px-2">
                                                <ChevronRight size={16} className="text-muted" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Painel de Detalhes */}
                {selectedFechamento && (
                    <div className="card flex flex-col overflow-y-auto max-h-[85vh]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Detalhes</h3>
                                {getFonteBadge(selectedFechamento.fonte)}
                            </div>
                            <button onClick={() => setSelectedFechamento(null)} className="btn btn-ghost btn-sm px-2">fechar</button>
                        </div>

                        {/* Identificação */}
                        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-surface-subtle border border-border">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-warning/10 text-warning flex-shrink-0">
                                <ShieldCheck size={20} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-bold">{selectedFechamento.terminal_id}</span>
                                    {getStatusBadge(selectedFechamento.status_validacao)}
                                </div>
                                <div className="text-xs text-muted truncate">
                                    {selectedFechamento.fonte === 'fechamento_tfl'
                                        ? selectedFechamento.arquivo_nome
                                        : selectedFechamento.operador_nome}
                                    {' • '}{formatarDataLocal(selectedFechamento.data_turno)}
                                    {selectedFechamento.data_fechamento && ` • ${formatarDataHoraLocal(selectedFechamento.data_fechamento)}`}
                                </div>
                            </div>
                        </div>

                        {/* Detalhamento completo */}
                        {selectedFechamento.fonte === 'fechamento_tfl' && selectedFechamento.dados_extraidos
                            ? <DetalhesTFL dados={selectedFechamento.dados_extraidos} />
                            : <DetalhesOperador f={selectedFechamento} />
                        }

                        {/* Justificativa */}
                        {selectedFechamento.justificativa && (
                            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <span className="text-[9px] text-yellow-500 font-bold uppercase">
                                    {selectedFechamento.fonte === 'fechamento_tfl' ? 'Observações' : 'Justificativa do Operador'}
                                </span>
                                <p className="text-xs text-yellow-600 dark:text-yellow-200 mt-1 italic">
                                    "{selectedFechamento.justificativa}"
                                </p>
                            </div>
                        )}

                        {selectedFechamento.status_validacao === 'pendente' && (
                            <div className="mt-5 flex gap-2">
                                {selectedFechamento.fonte === 'caixa_sessoes' && (
                                    <button
                                        className="btn btn-ghost flex-1 py-2.5 text-sm font-semibold border border-blue-500/20 text-blue-300 hover:bg-blue-500/10"
                                        onClick={() => setShowAdicionaisModal(true)}
                                    >
                                        <Plus size={14} />
                                        Adicionais
                                    </button>
                                )}
                                <button
                                    className={`btn btn-primary py-2.5 text-sm font-bold ${selectedFechamento.fonte === 'caixa_sessoes' ? 'flex-1' : 'w-full'}`}
                                    onClick={() => setShowValidationModal(true)}
                                >
                                    <ShieldCheck size={14} />
                                    Auditar Agora
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Auditoria */}
            {showValidationModal && selectedFechamento && (
                <ModalAuditoria
                    fechamento={selectedFechamento}
                    onClose={() => setShowValidationModal(false)}
                    onAprovar={(obs) => handleAprovar(selectedFechamento, obs)}
                    onRejeitar={({ justificativa }) => handleRejeitar(selectedFechamento, justificativa)}
                />
            )}

            {/* Modal Adicionais */}
            {showAdicionaisModal && selectedFechamento && selectedFechamento.fonte === 'caixa_sessoes' && (
                <>
                    <div className="fixed inset-0 bg-black/80 z-[9998]" onClick={async () => { setShowAdicionaisModal(false); await fetchHistorico(); }} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-xl max-h-[90vh] overflow-y-auto bg-bg-card border border-border rounded-2xl z-[9999] p-6">
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h2 className="text-lg font-bold">Adicionais do Fechamento</h2>
                                <p className="text-xs text-muted mt-0.5">
                                    Terminal {selectedFechamento.terminal_id} &bull; {formatarDataLocal(selectedFechamento.data_turno)}
                                </p>
                            </div>
                            <button onClick={() => setShowAdicionaisModal(false)} className="btn btn-ghost btn-sm">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Dados para Conciliação Bancária</p>
                            <PixExternosForm
                                sessaoId={parseInt(selectedFechamento.id)}
                                lojaId={selectedFechamento.loja_id ?? ''}
                                dataTurno={selectedFechamento.data_turno}
                            />
                            <DepositoCofreForm
                                sessaoId={parseInt(selectedFechamento.id)}
                                lojaId={selectedFechamento.loja_id ?? ''}
                                valorAtual={selectedFechamento.valor_cofre ?? 0}
                            />
                        </div>

                        <div className="flex justify-end mt-5 pt-4 border-t border-border">
                            <button className="btn btn-primary text-sm" onClick={async () => { setShowAdicionaisModal(false); await fetchHistorico(); }}>
                                Concluir
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
