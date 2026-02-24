'use client';

import { useState } from 'react';
import { useValidacaoGerencial, FechamentoPendente } from '@/hooks/useValidacaoGerencial';
import { usePerfil } from '@/hooks/usePerfil';
import { useToast } from '@/contexts/ToastContext';
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Wallet,
    Ticket,
    TrendingUp,
    DollarSign,
    Calendar,
    User,
    MessageSquare,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ModalValidacaoProps {
    fechamento: FechamentoPendente;
    onClose: () => void;
    onSuccess: () => void;
}

function ModalValidacao({ fechamento, onClose, onSuccess }: ModalValidacaoProps) {
    const { validarFechamento } = useValidacaoGerencial();
    const { toast } = useToast();
    const [acao, setAcao] = useState<'aprovar' | 'rejeitar' | null>(null);
    const [observacoes, setObservacoes] = useState('');
    const [processando, setProcessando] = useState(false);

    const handleValidar = async () => {
        if (!acao) return;

        setProcessando(true);
        try {
            await validarFechamento({
                fechamentoId: fechamento.id,
                tipo: fechamento.tipo,
                acao,
                observacoes
            });

            toast({
                message: `Fechamento ${acao === 'aprovar' ? 'aprovado' : 'rejeitado'} com sucesso!`,
                type: 'success'
            });
            onSuccess();
            onClose();
        } catch (error: any) {
            toast({
                message: error.message || 'Erro ao validar fechamento',
                type: 'error'
            });
        } finally {
            setProcessando(false);
        }
    };

    const divergenciasDinheiro = fechamento.tipo === 'bolao' && fechamento.dinheiro_informado !== fechamento.total_dinheiro;
    const divergenciasPix = fechamento.tipo === 'bolao' && fechamento.pix_informado !== fechamento.total_pix;
    const temDivergencias = divergenciasDinheiro || divergenciasPix;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-2xl rounded-3xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-white/2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black">Validação de Fechamento</h2>
                            <p className="text-xs text-muted mt-1">
                                {fechamento.tipo === 'tfl' ? '💼 Caixa TFL' : '🎲 Caixa Bolão'} - #{fechamento.id.toString().padStart(4, '0')}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <XCircle size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">

                    {/* Info Básica */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-xs text-muted mb-2">
                                <User size={14} /> Operador
                            </div>
                            <p className="font-bold">{fechamento.operador_nome}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-xs text-muted mb-2">
                                <Calendar size={14} /> Data Fechamento
                            </div>
                            <p className="font-bold">
                                {format(new Date(fechamento.data_fechamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                        </div>
                    </div>

                    {/* Valores do Caixa TFL */}
                    {fechamento.tipo === 'tfl' && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">
                                Resumo Financeiro TFL
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                                    <p className="text-[9px] text-muted mb-1 uppercase font-bold">Saldo Líquido</p>
                                    <p className="text-lg font-black text-primary">
                                        R$ {fechamento.saldo_liquido_final?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-danger/10 border border-danger/20">
                                    <p className="text-[9px] text-muted mb-1 uppercase font-bold">Sangrias</p>
                                    <p className="text-lg font-black text-danger">
                                        R$ {fechamento.total_sangrias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                                    <p className="text-[9px] text-muted mb-1 uppercase font-bold">Depósitos</p>
                                    <p className="text-lg font-black text-success">
                                        R$ {fechamento.total_depositos_filial?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Valores do Caixa Bolão */}
                    {fechamento.tipo === 'bolao' && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">
                                Resumo Financeiro Bolão
                            </h3>
                            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 mb-3">
                                <p className="text-[9px] text-muted mb-1 uppercase font-bold">Total Vendido</p>
                                <p className="text-2xl font-black text-primary">
                                    R$ {fechamento.total_vendido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                </p>
                            </div>

                            {/* Comparação Dinheiro */}
                            <div className={`p-4 rounded-xl border ${divergenciasDinheiro ? 'bg-warning/10 border-warning/20' : 'bg-white/5 border-white/10'}`}>
                                <p className="text-[9px] text-muted mb-2 uppercase font-bold">💵 Dinheiro</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[8px] text-muted opacity-70">Calculado</p>
                                        <p className="font-bold">R$ {fechamento.total_dinheiro?.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] text-muted opacity-70">Informado</p>
                                        <p className="font-bold">R$ {fechamento.dinheiro_informado?.toFixed(2)}</p>
                                    </div>
                                </div>
                                {divergenciasDinheiro && (
                                    <p className="text-xs text-warning mt-2 font-semibold">
                                        ⚠️ Diferença: R$ {Math.abs((fechamento.dinheiro_informado || 0) - (fechamento.total_dinheiro || 0)).toFixed(2)}
                                    </p>
                                )}
                            </div>

                            {/* Comparação PIX */}
                            <div className={`p-4 rounded-xl border ${divergenciasPix ? 'bg-warning/10 border-warning/20' : 'bg-white/5 border-white/10'}`}>
                                <p className="text-[9px] text-muted mb-2 uppercase font-bold">💳 PIX</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[8px] text-muted opacity-70">Calculado</p>
                                        <p className="font-bold">R$ {fechamento.total_pix?.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] text-muted opacity-70">Informado</p>
                                        <p className="font-bold">R$ {fechamento.pix_informado?.toFixed(2)}</p>
                                    </div>
                                </div>
                                {divergenciasPix && (
                                    <p className="text-xs text-warning mt-2 font-semibold">
                                        ⚠️ Diferença: R$ {Math.abs((fechamento.pix_informado || 0) - (fechamento.total_pix || 0)).toFixed(2)}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Observações do Operador */}
                    {fechamento.observacoes && (
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-xs text-muted mb-2">
                                <MessageSquare size={14} /> Observações do Operador
                            </div>
                            <p className="text-sm italic">{fechamento.observacoes}</p>
                        </div>
                    )}

                    {/* Alerta de Divergências */}
                    {temDivergencias && (
                        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex gap-3 animate-in shake duration-500">
                            <AlertTriangle className="text-danger shrink-0" size={20} />
                            <div>
                                <p className="text-xs font-bold text-danger">Divergências Detectadas!</p>
                                <p className="text-[10px] text-danger/80 mt-1">
                                    Os valores informados pelo operador não batem com os calculados pelo sistema. Verifique antes de aprovar.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Seleção de Ação */}
                    {!acao && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">
                                Decisão de Validação
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    className="kpi-card p-6 text-center cursor-pointer hover:border-success transition-all group"
                                    onClick={() => setAcao('aprovar')}
                                >
                                    <CheckCircle2 className="mx-auto mb-3 text-success" size={32} />
                                    <p className="font-bold text-success">Aprovar</p>
                                    <p className="text-[10px] text-muted mt-1">Validar o fechamento</p>
                                </button>
                                <button
                                    className="kpi-card p-6 text-center cursor-pointer hover:border-danger transition-all group"
                                    onClick={() => setAcao('rejeitar')}
                                >
                                    <XCircle className="mx-auto mb-3 text-danger" size={32} />
                                    <p className="font-bold text-danger">Rejeitar</p>
                                    <p className="text-[10px] text-muted mt-1">Solicitar correção</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Campo de Observações Gerenciais */}
                    {acao && (
                        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-300">
                            <div className={`p-4 rounded-xl border ${acao === 'aprovar' ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                                <p className="font-bold mb-2">
                                    {acao === 'aprovar' ? '✅ Aprovando Fechamento' : '❌ Rejeitando Fechamento'}
                                </p>
                                <p className="text-xs text-muted">
                                    {acao === 'aprovar'
                                        ? 'Este fechamento será marcado como aprovado.'
                                        : 'Este fechamento será devolvido ao operador para correção.'}
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1 mb-2 block">
                                    Observações Gerenciais {acao === 'rejeitar' && '(Obrigatório)'}
                                </label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none transition-colors"
                                    rows={4}
                                    placeholder={acao === 'aprovar' ? 'Observações opcionais...' : 'Explique o motivo da rejeição...'}
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    className="btn btn-ghost flex-1 h-12"
                                    onClick={() => { setAcao(null); setObservacoes(''); }}
                                    disabled={processando}
                                >
                                    Voltar
                                </button>
                                <button
                                    className={`btn flex-2 h-12 font-black ${acao === 'aprovar' ? 'btn-success' : 'btn-danger'}`}
                                    onClick={handleValidar}
                                    disabled={processando || (acao === 'rejeitar' && !observacoes.trim())}
                                >
                                    {processando ? <Loader2 className="animate-spin" /> : `Confirmar ${acao === 'aprovar' ? 'Aprovação' : 'Rejeição'}`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function PainelValidacaoGerencial() {
    const { podeValidarFechamentos } = usePerfil();
    const { fechamentosPendentes, loading, refresh } = useValidacaoGerencial();
    const [fechamentoSelecionado, setFechamentoSelecionado] = useState<FechamentoPendente | null>(null);

    if (!podeValidarFechamentos) {
        return (
            <div className="dashboard-content">
                <div className="flex flex-col items-center justify-center py-24">
                    <AlertTriangle size={64} className="text-danger mb-6" />
                    <h2 className="text-2xl font-black mb-2">Acesso Restrito</h2>
                    <p className="text-muted">Apenas Gerentes podem acessar o Painel de Validação.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dashboard-content">
                <div className="flex flex-col items-center justify-center py-24">
                    <Loader2 size={64} className="animate-spin text-primary mb-6" />
                    <p className="text-muted">Carregando fechamentos pendentes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-content pb-16">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-black mb-2">Validação Gerencial</h1>
                <p className="text-muted">Aprove ou rejeite fechamentos de caixa realizados pela equipe.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="kpi-card p-6 border-warning/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted mb-1 uppercase font-bold">Pendentes</p>
                            <p className="text-3xl font-black text-warning">{fechamentosPendentes.length}</p>
                        </div>
                        <Clock className="text-warning" size={32} />
                    </div>
                </div>
                <div className="kpi-card p-6 border-primary/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted mb-1 uppercase font-bold">Caixa TFL</p>
                            <p className="text-3xl font-black text-primary">
                                {fechamentosPendentes.filter(f => f.tipo === 'tfl').length}
                            </p>
                        </div>
                        <Wallet className="text-primary" size={32} />
                    </div>
                </div>
                <div className="kpi-card p-6 border-chart-2/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted mb-1 uppercase font-bold">Caixa Bolão</p>
                            <p className="text-3xl font-black text-chart-2">
                                {fechamentosPendentes.filter(f => f.tipo === 'bolao').length}
                            </p>
                        </div>
                        <Ticket className="text-chart-2" size={32} />
                    </div>
                </div>
            </div>

            {/* Lista de Fechamentos */}
            {fechamentosPendentes.length === 0 ? (
                <div className="kpi-card p-12 text-center">
                    <CheckCircle2 size={64} className="mx-auto mb-4 text-success" />
                    <h3 className="text-xl font-bold mb-2">Tudo em Dia!</h3>
                    <p className="text-muted">Não há fechamentos pendentes de validação no momento.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-muted uppercase tracking-wide">Aguardando sua validação</h2>
                    {fechamentosPendentes.map(fechamento => (
                        <div
                            key={`${fechamento.tipo}-${fechamento.id}`}
                            className="kpi-card p-6 cursor-pointer hover:border-primary transition-all group"
                            onClick={() => setFechamentoSelecionado(fechamento)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${fechamento.tipo === 'tfl' ? 'bg-primary/20 text-primary' : 'bg-chart-2/20 text-chart-2'}`}>
                                        {fechamento.tipo === 'tfl' ? <Wallet size={24} /> : <Ticket size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold">
                                                {fechamento.tipo === 'tfl' ? 'Caixa TFL' : 'Caixa Bolão'} #{fechamento.id.toString().padStart(4, '0')}
                                            </h3>
                                            <span className="badge warning px-2 py-1 text-[10px]">Pendente</span>
                                        </div>
                                        <p className="text-xs text-muted mt-1">
                                            Por {fechamento.operador_nome} • {format(new Date(fechamento.data_fechamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {fechamento.tipo === 'tfl' && (
                                        <p className="font-black text-lg">
                                            R$ {fechamento.saldo_liquido_final?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    )}
                                    {fechamento.tipo === 'bolao' && (
                                        <p className="font-black text-lg">
                                            R$ {fechamento.total_vendido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted">Saldo/Total</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Validação */}
            {fechamentoSelecionado && (
                <ModalValidacao
                    fechamento={fechamentoSelecionado}
                    onClose={() => setFechamentoSelecionado(null)}
                    onSuccess={refresh}
                />
            )}
        </div>
    );
}
