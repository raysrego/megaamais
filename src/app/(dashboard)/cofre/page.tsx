'use client';

import { useState } from 'react';
import {
    ShieldCheck,
    ArrowUpFromLine,
    History,
    CheckCircle2,
    Clock,
    Building2,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { useCofre } from '@/hooks/useCofre';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';

export default function GestaoCofrePage() {
    const { saldo, pendencias, movimentacoes, loading, confirmarSangria, registrarDeposito } = useCofre();
    const [showDepositoModal, setShowDepositoModal] = useState(false);
    const { toast } = useToast();
    const confirm = useConfirm();

    // Estados locais para formulários
    const [depositoValor, setDepositoValor] = useState('');
    const [depositoBanco, setDepositoBanco] = useState('Caixa Econômica (001)');
    const [processing, setProcessing] = useState(false);

    // Cálculos derivados
    const totalPendente = pendencias.reduce((acc, s) => acc + s.valor, 0);
    const ultimoDeposito = movimentacoes.find(m => m.tipo === 'saida_deposito');

    const handleConferir = async (sangriaId: number) => {
        try {
            const confirmed = await confirm({
                title: 'Conferir Sangria',
                description: 'Confirmar recebimento do envelope no valor informado?',
                variant: 'neutral',
                confirmLabel: 'Confirmar Recebimento'
            });
            if (!confirmed) return;

            setProcessing(true);
            await confirmarSangria(sangriaId);
            toast({ message: 'Conferência realizada com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: 'Erro: ' + (error.message || 'Falha ao confirmar'), type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleSalvarDeposito = async () => {
        try {
            const valor = parseFloat(depositoValor);
            if (isNaN(valor) || valor <= 0) {
                toast({ message: 'Digite um valor válido', type: 'warning' });
                return;
            }
            if (valor > saldo) {
                toast({ message: 'Saldo insuficiente no cofre!', type: 'error' });
                return;
            }

            setProcessing(true);
            await registrarDeposito(valor, depositoBanco);
            setShowDepositoModal(false);
            setDepositoValor('');
            toast({ message: 'Depósito registrado com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: 'Erro: ' + (error.message || 'Falha ao registrar depósito'), type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return <LoadingState type="dashboard" />;
    }

    return (
        <div className="dashboard-content">
            <PageHeader
                title="Gestão de Cofre & Depósitos"
            />

            <div className="flex justify-end mb-6">
                <button
                    className="btn btn-primary"
                    onClick={() => setShowDepositoModal(true)}
                    disabled={saldo <= 0}
                >
                    <ArrowUpFromLine size={16} /> Registrar Depósito
                </button>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card success">
                    <div className="kpi-header">
                        <span className="kpi-label">Saldo em Espécie (Cofre)</span>
                        <div className="kpi-icon"><ShieldCheck size={20} /></div>
                    </div>
                    <div className="kpi-value">R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="kpi-trend positive">Disponível para depósito</div>
                </div>

                <div className="kpi-card accent">
                    <div className="kpi-header">
                        <span className="kpi-label">Sangrias Pendentes</span>
                        <div className="kpi-icon"><Clock size={20} /></div>
                    </div>
                    <div className="kpi-value">R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="kpi-trend" style={{ color: '#f59e0b' }}>
                        <AlertCircle size={14} /> {pendencias.length} envelopes a conferir
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Último Depósito</span>
                        <div className="kpi-icon"><Building2 size={20} /></div>
                    </div>
                    <div className="kpi-value">R$ {ultimoDeposito ? ultimoDeposito.valor.toLocaleString('pt-BR') : '0,00'}</div>
                    <div className="kpi-trend text-muted">
                        {ultimoDeposito ? new Date(ultimoDeposito.data_movimentacao).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                {/* Coluna 1: Sangrias Pendentes */}
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="chart-title mb-0">Sangrias para Conferência</h3>
                        {processing && <Loader2 size={16} className="animate-spin text-muted" />}
                    </div>

                    {pendencias.length === 0 ? (
                        <div className="text-center py-8 text-muted text-sm">
                            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
                            Nenhuma sangria pendente de conferência.
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Origem</th>
                                        <th>Horário</th>
                                        <th>Valor</th>
                                        <th style={{ textAlign: 'right' }}>Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendencias.map(s => (
                                        <tr key={s.sangria_id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{s.terminal_id || 'TFL ???'}</div>
                                                <div className="text-xs text-muted truncate max-w-[150px]">{s.observacao_caixa}</div>
                                            </td>
                                            <td className="text-muted">
                                                {new Date(s.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ fontWeight: 700 }}>R$ {s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-ghost"
                                                    style={{ fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}
                                                    onClick={() => handleConferir(s.sangria_id)}
                                                    disabled={processing}
                                                >
                                                    {processing ? '...' : 'Receber Envelope'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Coluna 2: Histórico */}
                <div className="card">
                    <h3 className="chart-title"><History size={18} /> Histórico do Cofre</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                        {movimentacoes.length === 0 && (
                            <div className="text-center text-muted text-xs py-4">Sem movimentações recentes.</div>
                        )}
                        {movimentacoes.map(m => (
                            <div key={m.id} className="card" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                    <div style={{ fontWeight: 700, color: m.tipo.includes('entrada') ? '#22c55e' : '#ef4444' }}>
                                        {m.tipo.includes('entrada') ? '+' : '-'} R$ {m.valor.toLocaleString('pt-BR')}
                                    </div>
                                    <span className="badge" style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                        {m.tipo.replace('_', ' ').toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-xs text-muted flex justify-between mt-1">
                                    <span>{m.observacoes || (m.tipo.includes('sangria') ? 'Conferência de Sangria' : 'Movimentação')}</span>
                                    <span>{new Date(m.data_movimentacao).toLocaleDateString('pt-BR')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {
                showDepositoModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Registrar Depósito</h2>
                            <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 12, marginBottom: '1.5rem' }}>
                                <div className="text-xs text-muted">Saldo Disponível no Cofre</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#22c55e' }}>R$ {saldo.toLocaleString('pt-BR')}</div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="form-group">
                                    <label className="text-xs text-muted uppercase font-bold">Conta de Destino</label>
                                    <select
                                        className="input"
                                        value={depositoBanco}
                                        onChange={e => setDepositoBanco(e.target.value)}
                                    >
                                        <option>Caixa Econômica (001)</option>
                                        <option>Banco do Brasil (002)</option>
                                        <option>Cofre Inteligente Natureza</option>
                                        <option>Transportadora de Valores</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="text-xs text-muted uppercase font-bold">Valor do Depósito</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="0.00"
                                        value={depositoValor}
                                        onChange={e => setDepositoValor(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end mt-8">
                                <button className="btn btn-ghost" onClick={() => setShowDepositoModal(false)} disabled={processing}>Cancelar</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSalvarDeposito}
                                    disabled={processing}
                                >
                                    {processing ? <Loader2 className="animate-spin" size={16} /> : 'Confirmar Saída'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
