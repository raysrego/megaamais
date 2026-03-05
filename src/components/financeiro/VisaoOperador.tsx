'use client';

import { useState, useEffect } from 'react';
import {
    Calculator,
    Smartphone,
    ArrowRightLeft,
    Wallet,
    Building,
    FileText,
    History,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Clock,
    CheckCircle2
} from 'lucide-react';
import { ModalLancamentoRapido, type TipoLancamento } from './ModalLancamentoRapido';
import { ModalFechamentoCaixa } from './ModalFechamentoCaixa';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil';
import { useToast } from '@/contexts/ToastContext';

export function VisaoOperador() {
    const { transacoes, fetchTransacoes, salvarTransacao } = useFinanceiro();
    const { lojaAtual } = useLoja();
    const { perfil } = usePerfil();
    const { toast } = useToast();

    const [tipoSelecionado, setTipoSelecionado] = useState<TipoLancamento | null>(null);
    const [showFechamento, setShowFechamento] = useState(false);

    // Carregar movimentações de hoje do operador
    useEffect(() => {
        const hoje = new Date();
        fetchTransacoes(hoje.getFullYear(), hoje.getMonth() + 1, lojaAtual?.id || null);
    }, [lojaAtual?.id, fetchTransacoes]);

    const handleSaveEntry = async (data: { tipo: TipoLancamento, valor: number, observacao?: string, metodo?: string }) => {
        try {
            await salvarTransacao({
                tipo: data.tipo === 'pix' ? 'receita' : 'despesa', // Simplificação para o financeiro
                descricao: `${data.tipo.toUpperCase()}: ${data.observacao || 'S/ Obs'}`,
                valor: data.valor,
                item: data.tipo === 'pix' ? 'Vendas' : data.tipo === 'sangria' ? 'Sangria' : 'Outros',
                data_vencimento: new Date().toISOString().split('T')[0],
                metodo_pagamento: (data.metodo || (data.tipo === 'pix' ? 'pix' : 'dinheiro')) as any,
                loja_id: lojaAtual?.id || null,
                recorrente: false,
                frequencia: null
            });
            toast({ message: 'Lançamento registrado com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: 'Erro ao salvar: ' + error.message, type: 'error' });
        }
        setTipoSelecionado(null);
    };

    // Filtrar apenas transações de hoje (simplificado)
    const hojeStr = new Date().toISOString().split('T')[0];
    const movimentacoes = transacoes.filter(t => t.data_vencimento === hojeStr);

    const getIcon = (tipo: TipoLancamento) => {
        switch (tipo) {
            case 'pix': return <Smartphone size={16} className="text-success" />;
            case 'sangria': return <Building size={16} className="text-danger" />;
            case 'trocados': return <ArrowRightLeft size={16} className="text-blue-500" />;
            case 'deposito': return <Building size={16} className="text-muted" />;
            case 'boleto': return <FileText size={16} className="text-orange-500" />;
            default: return <DollarSign size={16} />;
        }
    };

    const getLabel = (tipo: TipoLancamento) => {
        switch (tipo) {
            case 'pix': return 'Pix';
            case 'sangria': return 'Sangria';
            case 'trocados': return 'Trocados';
            case 'deposito': return 'Depósito';
            case 'boleto': return 'Boleto';
            default: return 'Lançamento';
        }
    };

    const handleFinishCaixa = async (result: { observacoes?: string; tflData?: any }) => {
        setShowFechamento(false);
        toast({ message: 'Turno finalizado com sucesso!', type: 'success' });
    };

    return (
        <div className="visao-operador-container" style={{ marginTop: '1rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title text-xl">Painel do Operador</h1>
                    <p className="page-subtitle">Registro de movimentações diárias e fechamento de caixa</p>
                </div>
                <div className="flex gap-2">
                    <div className="badge accent" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign size={14} />
                        <span>Fundo de Troco: <strong>R$ 100,00</strong></span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div className="calculadora-area">
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Calculator size={20} className="text-primary" />
                            Calculadora de Lançamentos
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                            <button
                                onClick={() => setTipoSelecionado('pix')}
                                className="btn btn-ghost" style={{ height: '110px', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)', background: 'rgba(34, 197, 94, 0.05)' }}
                            >
                                <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                                    <Smartphone className="text-success" />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pix (Entrada)</span>
                            </button>
                            <button
                                onClick={() => setTipoSelecionado('sangria')}
                                className="btn btn-ghost" style={{ height: '110px', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)', background: 'rgba(239, 68, 68, 0.05)' }}
                            >
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                                    <Building className="text-danger" />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sangria / Cofre</span>
                            </button>
                            <button
                                onClick={() => setTipoSelecionado('trocados')}
                                className="btn btn-ghost" style={{ height: '110px', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)' }}
                            >
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                                    <ArrowRightLeft className="text-blue-500" />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Trocados</span>
                            </button>
                            <button
                                onClick={() => setTipoSelecionado('deposito')}
                                className="btn btn-ghost" style={{ height: '110px', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)' }}
                            >
                                <div style={{ background: 'rgba(148, 163, 184, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                                    <Building className="text-muted" />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Depósito Filial</span>
                            </button>
                            <button
                                onClick={() => setTipoSelecionado('boleto')}
                                className="btn btn-ghost" style={{ height: '110px', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)' }}
                            >
                                <div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                                    <FileText className="text-orange-500" />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Boleto Lotérico</span>
                            </button>
                        </div>

                        <div style={{ marginTop: '2.5rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center' }}>
                            <div style={{ opacity: 0.5, marginBottom: '1rem' }}>
                                <Calculator size={40} style={{ margin: '0 auto' }} />
                            </div>
                            <h4 className="font-bold">Pronto para lançar?</h4>
                            <p className="text-muted text-sm max-w-xs mx-auto mt-2">Selecione o tipo de movimentação acima para registrar no caixa.</p>
                        </div>
                    </div>
                </div>

                <div className="sidebar-area">
                    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <History size={16} className="text-muted" />
                                Fluxo de Hoje
                            </h3>
                            <span className="badge" style={{ fontSize: '0.65rem' }}>{new Date().toLocaleDateString('pt-BR')}</span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {movimentacoes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                    <Clock size={32} className="text-muted" style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                                    <p className="text-xs text-muted">Nenhum lançamento realizado hoje.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {movimentacoes.map((t, idx) => (
                                        <div key={idx} className="card" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {t.metodo_pagamento === 'pix' ? <Smartphone size={16} className="text-success" /> : <Wallet size={16} />}
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.metodo_pagamento?.toUpperCase() || 'ESPECIE'}</span>
                                                </div>
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    color: t.tipo === 'despesa' ? 'var(--danger)' : 'var(--success)'
                                                }}>
                                                    {t.tipo === 'despesa' ? '-' : '+'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            {t.descricao && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                                                    {t.descricao}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs text-muted">Saldo em Caixa (Decl.)</span>
                                <span className="font-bold text-lg">
                                    R$ {movimentacoes.reduce((acc, curr) => acc + (curr.tipo === 'despesa' ? -curr.valor : curr.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <button
                                className="btn btn-primary w-full"
                                style={{ padding: '1rem', height: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                                onClick={() => setShowFechamento(true)}
                            >
                                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Finalizar e Bater Caixa</span>
                                <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Concluir turno e validar valores</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Lançamento */}
            {tipoSelecionado && (
                <ModalLancamentoRapido
                    tipo={tipoSelecionado}
                    onClose={() => setTipoSelecionado(null)}
                    onSave={handleSaveEntry}
                />
            )}
            {/* Modal de Fechamento */}
            {showFechamento && (
                <ModalFechamentoCaixa
                    transacoes={movimentacoes}
                    onClose={() => setShowFechamento(false)}
                    onFinish={handleFinishCaixa}
                />
            )}
        </div>
    );
}
