'use client';

import { useState, useMemo } from 'react';
import {
    X,
    AlertTriangle,
    Loader2,
    CheckCircle2,
    ArrowUpCircle,
    ArrowDownCircle,
    DollarSign
} from 'lucide-react';
import { CaixaSessao } from '@/hooks/useCaixa';

interface TransacaoBase {
    valor: number;
    tipo?: string; // usado para identificar sangria
}

interface ModalFechamentoCaixaProps {
    sessao: CaixaSessao;
    transacoes: TransacaoBase[];
    onClose: () => void;
    onFinish: (result: {
        observacoes?: string;
        tflData?: any; // mantido para compatibilidade
    }) => void;
}

export function ModalFechamentoCaixa({ sessao, transacoes, onClose, onFinish }: ModalFechamentoCaixaProps) {
    const [confirmado, setConfirmado] = useState<boolean | null>(null);
    const [justificativa, setJustificativa] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const totalCreditos = useMemo(() => {
        return transacoes
            .filter(mov => mov.valor > 0)
            .reduce((acc, mov) => acc + mov.valor, 0);
    }, [transacoes]);

    const totalDebitos = useMemo(() => {
        return transacoes
            .filter(mov => mov.valor < 0)
            .reduce((acc, mov) => acc + Math.abs(mov.valor), 0);
    }, [transacoes]);

    const totalSangria = useMemo(() => {
        return transacoes
            .filter(mov => mov.tipo === 'sangria')
            .reduce((acc, mov) => acc + Math.abs(mov.valor), 0);
    }, [transacoes]);

    const saldoEsperado = useMemo(() => {
        return (sessao?.valor_inicial || 0) + totalCreditos - totalDebitos;
    }, [sessao, totalCreditos, totalDebitos]);

    const temFundoCaixa = sessao?.tem_fundo_caixa ?? true;

    const handleConfirm = async () => {
        if (confirmado === null) return;

        if (!confirmado && !justificativa.trim()) {
            alert('Por favor, informe a justificativa para a divergência.');
            return;
        }

        setIsProcessing(true);

        const observacoes = !confirmado
            ? `Divergência informada: ${justificativa}`
            : '';

        try {
            await onFinish({
                observacoes: observacoes || undefined,
                tflData: {} // compatibilidade
            });
            setIsSuccess(true);
        } catch (error) {
            console.error('Erro ao fechar caixa:', error);
            alert('Erro ao fechar caixa. Tente novamente.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isSuccess) {
        return (
            <>
                <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 shadow-2xl overflow-hidden p-6 text-center">
                    <CheckCircle2 size={56} className="mx-auto text-success mb-4" />
                    <h3 className="text-xl font-black mb-2">Caixa Encerrado</h3>
                    <p className="text-sm text-muted mb-6">O turno foi finalizado com sucesso.</p>
                    <button className="btn btn-primary w-full" onClick={onClose}>Concluir</button>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign size={18} className="text-primary-blue-light" />
                        <h2 className="text-lg font-black">Fechamento de Caixa</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Resumo */}
                    <div className="bg-surface-subtle p-4 rounded-xl border border-border mb-6">
                        <p className="text-xs font-bold mb-3">Resumo do Turno</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">Valor Inicial:</span>
                                <span className="font-bold">R$ {sessao.valor_inicial.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-success">
                                <span className="flex items-center gap-1"><ArrowUpCircle size={14} /> Entradas:</span>
                                <span className="font-bold">R$ {totalCreditos.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-danger">
                                <span className="flex items-center gap-1"><ArrowDownCircle size={14} /> Saídas:</span>
                                <span className="font-bold">R$ {totalDebitos.toFixed(2)}</span>
                            </div>
                            {totalSangria > 0 && (
                                <div className="flex justify-between text-warning">
                                    <span className="flex items-center gap-1"><AlertTriangle size={14} /> Sangria/Cofre:</span>
                                    <span className="font-bold">R$ {totalSangria.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-border font-black">
                                <span>Saldo Final:</span>
                                <span className={saldoEsperado >= 0 ? 'text-success' : 'text-danger'}>
                                    R$ {saldoEsperado.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Pergunta de confirmação */}
                    <div className="space-y-4">
                        <p className="text-sm font-bold text-center">O saldo final está correto?</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmado(true)}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                                    confirmado === true
                                        ? 'border-success bg-success/10 text-success'
                                        : 'border-border bg-surface-subtle text-muted hover:border-success/50'
                                }`}
                            >
                                <CheckCircle2 size={20} className="inline mr-2" />
                                Sim
                            </button>
                            <button
                                onClick={() => setConfirmado(false)}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                                    confirmado === false
                                        ? 'border-danger bg-danger/10 text-danger'
                                        : 'border-border bg-surface-subtle text-muted hover:border-danger/50'
                                }`}
                            >
                                <AlertTriangle size={20} className="inline mr-2" />
                                Não
                            </button>
                        </div>

                        {confirmado === false && (
                            <div className="animate-in slide-in-from-top-2 fade-in">
                                <label className="text-sm font-bold text-muted block mb-2">
                                    Justificativa <span className="text-danger">*</span>
                                </label>
                                <textarea
                                    className="input w-full"
                                    rows={3}
                                    value={justificativa}
                                    onChange={(e) => setJustificativa(e.target.value)}
                                    placeholder="Explique o motivo da divergência..."
                                    disabled={isProcessing}
                                />
                            </div>
                        )}

                        {!temFundoCaixa && (
                            <div className="bg-warning/10 border border-warning/30 p-3 rounded-lg">
                                <p className="text-xs text-warning font-bold flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    Fundo de caixa ausente na abertura.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-border p-5 flex justify-end gap-3">
                    <button className="btn btn-ghost" onClick={onClose} disabled={isProcessing}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={confirmado === null || isProcessing || (confirmado === false && !justificativa.trim())}
                    >
                        {isProcessing ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                        {isProcessing ? 'Processando...' : 'Confirmar e Encerrar'}
                    </button>
                </div>
            </div>
        </>
    );
}
