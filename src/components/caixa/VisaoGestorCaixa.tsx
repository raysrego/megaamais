'use client';

import { useState } from 'react';
import { Wallet, CircleArrowUp as ArrowUpCircle, Zap, TrendingUp, TriangleAlert as AlertTriangle, LayoutDashboard, FileText } from 'lucide-react';
import { LoadingState } from '../ui/LoadingState';
import { useGestorCaixa } from '@/hooks/useGestorCaixa';
import { AuditoriaFechamentos } from './AuditoriaFechamentos';
import { FechamentoCaixaTFL } from './FechamentoCaixaTFL';

type AbaGestor = 'monitoramento' | 'fechamento_tfl';

export function VisaoGestorCaixa() {
    const { stats, loading } = useGestorCaixa();
    const [abaAtiva, setAbaAtiva] = useState<AbaGestor>('monitoramento');

    if (loading) {
        return <LoadingState type="caixa" />;
    }

    return (
        <div className="visao-gestor-caixa">
            {/* Seletor de abas internas */}
            <div className="flex gap-2 mb-8 border-b border-white/5 pb-5">
                <button
                    onClick={() => setAbaAtiva('monitoramento')}
                    className={`btn ${abaAtiva === 'monitoramento' ? 'btn-primary' : 'btn-ghost'} h-[38px] px-5 text-xs font-bold`}
                    style={{ borderRadius: '10px' }}
                >
                    <LayoutDashboard size={14} /> Monitoramento
                </button>
                <button
                    onClick={() => setAbaAtiva('fechamento_tfl')}
                    className={`btn ${abaAtiva === 'fechamento_tfl' ? 'btn-primary' : 'btn-ghost'} h-[38px] px-5 text-xs font-bold`}
                    style={{ borderRadius: '10px' }}
                >
                    <FileText size={14} /> Fechamento de Caixa
                </button>
            </div>

            {abaAtiva === 'monitoramento' && (
                <div className="animate-in fade-in slide-in-from-left-4">
                    {/* Auditoria de Fechamentos Integrada */}
                    <div className="mb-10">
                        <AuditoriaFechamentos />
                    </div>

                    {/* KPIs Estratégicos */}
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
                </div>
            )}

            {abaAtiva === 'fechamento_tfl' && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <FechamentoCaixaTFL />
                </div>
            )}
        </div>
    );
}
