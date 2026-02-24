'use client';

import { useState } from 'react';
import {
    Wallet,
    ArrowUpCircle,
    Zap,
    TrendingUp,
    AlertTriangle,
    Smartphone,
    Building,
    FileText,
    DollarSign,
    Clock,
    User,
    Monitor,
    BarChart3,
    ShieldCheck,
    Loader2
} from 'lucide-react';
import { LoadingState } from '../ui/LoadingState';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import {
    mockPeakHours,
} from '@/data/mockData';
import { useGestorCaixa } from '@/hooks/useGestorCaixa';
import Link from 'next/link';

import { AuditoriaFechamentos } from './AuditoriaFechamentos';

export function VisaoGestorCaixa() {
    const { sessoesAtivas, movimentacoesRecentas, stats, loading } = useGestorCaixa();

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'pix': return <Smartphone size={14} className="text-success" />;
            case 'sangria': return <Building size={14} className="text-danger" />;
            case 'venda': return <DollarSign size={14} className="text-primary" />;
            case 'pagamento': return <FileText size={14} className="text-orange-500" />;
            case 'boleto': return <FileText size={14} className="text-orange-500" />;
            case 'deposito': return <Building size={14} className="text-muted" />;
            case 'trocados': return <Zap size={14} className="text-blue-500" />;
            default: return <Zap size={14} className="text-muted" />;
        }
    };

    if (loading) {
        return <LoadingState type="caixa" />;
    }

    return (
        <div className="visao-gestor-caixa">
            <div className="animate-in fade-in slide-in-from-left-4">
                {/* NOVA: Auditoria de Fechamentos Integrada */}
                <div className="mb-10">
                    <AuditoriaFechamentos />
                </div>

                {/* KPIs Estratégicos Reais */}
                <div className="kpi-grid mt-6">
                    <div className="kpi-card" style={{ borderTop: '4px solid var(--primary-blue-light)' }}>
                        <div className="kpi-header">
                            <span className="kpi-label uppercase text-[10px] tracking-wider font-bold text-muted">Saldo Consolidado</span>
                            <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-blue-light)' }}><Wallet size={20} /></div>
                        </div>
                        <div className="kpi-value text-2xl">R$ {stats.saldoConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="flex gap-3 text-[10px] font-bold mt-1 mb-2">
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                FÍSICO: R$ {stats.saldoFisico.toLocaleString('pt-BR')}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                DIGITAL: R$ {stats.saldoDigital.toLocaleString('pt-BR')}
                            </span>
                        </div>
                        <div className="kpi-trend positive font-bold">{stats.terminaisAtivos} Terminais Ativos</div>
                    </div>
                    <div className="kpi-card danger" style={{ borderTop: '4px solid var(--danger)' }}>
                        <div className="kpi-header">
                            <span className="kpi-label uppercase text-[10px] tracking-wider font-bold text-muted">Sangrias (Hoje)</span>
                            <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}><ArrowUpCircle size={20} /></div>
                        </div>
                        <div className="kpi-value text-2xl">R$ {stats.totalSangriasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="kpi-trend negative font-bold text-danger text-xs flex items-center gap-1">
                            <AlertTriangle size={12} /> Requer Auditoria
                        </div>
                    </div>
                    <div className="kpi-card success" style={{ borderTop: '4px solid var(--success)' }}>
                        <div className="kpi-header">
                            <span className="kpi-label uppercase text-[10px] tracking-wider font-bold text-muted">Volume de Entradas</span>
                            <div className="kpi-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' }}><Zap size={20} /></div>
                        </div>
                        <div className="kpi-value text-2xl">R$ {stats.volumeEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="kpi-trend positive font-bold text-success text-xs flex items-center gap-1">
                            <TrendingUp size={12} /> Tempo Real
                        </div>
                    </div>
                </div>

                {/* Seção Central: Picos e Feed em Grid 50/50 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                    {/* Dashboard de Picos (Ainda Mock pois depende de histórico longo) */}
                    <div className="card flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <BarChart3 size={20} className="text-primary" />
                                Picos de Movimentação
                            </h3>
                            <span className="text-xs text-muted">Média do Terminal</span>
                        </div>
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={mockPeakHours}>
                                    <defs>
                                        <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--primary-blue-light)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--primary-blue-light)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="hora" stroke="#64748b" fontSize={10} />
                                    <YAxis stroke="#64748b" fontSize={10} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }} />
                                    <Area type="monotone" dataKey="clientes" stroke="var(--primary-blue-light)" fillOpacity={1} fill="url(#colorClients)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Feed de Transações em Tempo Real (Real) */}
                    <div className="card flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Zap size={20} className="text-accent" />
                                Feed ao Vivo
                            </h3>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-success/5 rounded-full border border-success/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                <span className="text-[8px] uppercase font-bold text-success tracking-widest">Supabase Realtime</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {movimentacoesRecentas.length === 0 ? (
                                <div className="text-center p-12 opacity-30">
                                    <Clock size={48} className="mx-auto mb-4" />
                                    <p className="text-sm">Nenhuma movimentação hoje...</p>
                                </div>
                            ) : (
                                movimentacoesRecentas.map((mov, idx) => (
                                    <div key={mov.id || idx} className="p-3 rounded-xl border border-border bg-surface-subtle/50 hover:bg-bg-card-hover transition-colors flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-bg-card shrink-0">
                                            {getIcon(mov.tipo)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-xs font-bold text-text-primary truncate">{mov.descricao || 'Lançamento sem descrição'}</div>
                                                <div className={`text-xs font-black ${['sangria', 'pagamento', 'deposito', 'boleto', 'estorno'].includes(mov.tipo) ? 'text-danger' : 'text-success'}`}>
                                                    R$ {mov.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="text-[9px] text-muted font-bold opacity-70 uppercase tracking-tighter">
                                                    {mov.caixa_sessoes?.terminal_id} • Operador
                                                </div>
                                                <div className="text-[9px] text-muted opacity-60">
                                                    {new Date(mov.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Status dos Terminais (Horizontal e Simplificado) */}
                <div className="mt-6">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <ShieldCheck size={18} className="text-muted" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted">Terminais Conectados no Supabase</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                        {sessoesAtivas.length === 0 ? (
                            <div className="col-span-4 p-8 card border-dashed text-center opacity-30">
                                Nenhum terminal operando agora.
                            </div>
                        ) : (
                            sessoesAtivas.map((t) => (
                                <div key={t.id} style={{
                                    padding: '0.75rem 1rem',
                                    borderTop: `4px solid #22c55e`,
                                    background: 'var(--bg-card)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    minHeight: '85px',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-primary)', opacity: 0.9 }}>{t.terminal_id}</span>
                                        <div style={{
                                            background: '#22c55e'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>R$ {t.valor_final_calculado.toLocaleString('pt-BR')}</div>
                                        <div style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            color: '#22c55e'
                                        }}>
                                            ONLINE
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex justify-center mt-6">
                        <Link href="/cofre" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-primary transition-colors flex items-center gap-2">
                            Gerenciamento Avançado de Cofre e Terminais <Zap size={10} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
