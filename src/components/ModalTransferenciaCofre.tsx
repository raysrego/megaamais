'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, ArrowRight, Building2, Wallet, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { getContasBancarias, registrarDepositoCofre, getSaldoCofre } from '@/actions/financeiro';
import { useToast } from '@/contexts/ToastContext';
import { MoneyInput } from './ui/MoneyInput';

interface ModalTransferenciaCofreProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    sessaoId?: number; // Opcional: vincular a um fechamento específico
}

export function ModalTransferenciaCofre({ isOpen, onClose, onSuccess, sessaoId }: ModalTransferenciaCofreProps) {
    const [contas, setContas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [saldoAtual, setSaldoAtual] = useState(0);
    const [carregandoSaldo, setCarregandoSaldo] = useState(false);

    const { toast } = useToast();

    // Form fields
    const [valor, setValor] = useState<number>(0);
    const [contaId, setContaId] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [comprovante, setComprovante] = useState('');
    const [dataDeposito, setDataDeposito] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (isOpen) {
            loadContas();
            loadSaldoCofre();
        }
    }, [isOpen]);

    const loadContas = async () => {
        setLoading(true);
        try {
            const data = await getContasBancarias();
            setContas(data);
            if (data.length > 0) setContaId(data[0].id);
        } catch (err) {
            console.error('Erro ao carregar contas:', err);
            toast({ message: 'Erro ao carregar contas bancárias', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadSaldoCofre = async () => {
        setCarregandoSaldo(true);
        try {
            const saldo = await getSaldoCofre();
            setSaldoAtual(saldo);
        } catch (err) {
            console.error('Erro ao carregar saldo:', err);
        } finally {
            setCarregandoSaldo(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const numValor = Number(valor);
        
        if (isNaN(numValor) || numValor <= 0) {
            toast({ message: 'Informe um valor válido', type: 'warning' });
            return;
        }
        
        if (numValor > saldoAtual) {
            toast({ message: `Saldo insuficiente. Disponível: R$ ${saldoAtual.toFixed(2)}`, type: 'warning' });
            return;
        }
        
        if (!contaId) {
            toast({ message: 'Selecione uma conta de destino', type: 'warning' });
            return;
        }

        setSubmitting(true);
        try {
            // Combinar comprovante com observações
            const observacoesCompletas = `${observacoes}${comprovante ? ` - Comprovante: ${comprovante}` : ''}${sessaoId ? ` - Sessão origem: ${sessaoId}` : ''}`;
            
            const res = await registrarDepositoCofre(numValor, contaId, dataDeposito, observacoesCompletas);
            
            if (res.success) {
                toast({ message: 'Transferência realizada com sucesso!', type: 'success' });
                // Resetar formulário
                setValor(0);
                setObservacoes('');
                setComprovante('');
                // Recarregar saldo
                await loadSaldoCofre();
                onSuccess?.();
                onClose();
            } else {
                toast({ message: 'Erro: ' + (res.error || 'Falha ao realizar depósito'), type: 'error' });
            }
        } catch (err) {
            console.error('Erro no depósito:', err);
            toast({ message: 'Falha interna ao processar depósito', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-primary-blue-light" size={20} />
                        <h2 className="text-lg font-bold">Transferência do Cofre</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5">
                    {/* Origem e Destino */}
                    <div className="flex items-center justify-between mb-6 bg-primary-blue-light/5 p-4 rounded-xl border border-primary-blue-light/20">
                        <div className="text-center flex-1">
                            <Wallet className="mx-auto mb-1 text-muted" size={16} />
                            <div className="text-[0.6rem] uppercase tracking-wider font-bold">Origem</div>
                            <div className="font-black text-sm">COFRE</div>
                            {carregandoSaldo ? (
                                <Loader2 className="animate-spin mx-auto mt-1" size={12} />
                            ) : (
                                <div className="text-xs text-muted mt-1">
                                    Saldo: R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            )}
                        </div>
                        <ArrowRight className="text-primary-blue-light/40" size={24} />
                        <div className="text-center flex-1">
                            <Building2 className="mx-auto mb-1 text-muted" size={16} />
                            <div className="text-[0.6rem] uppercase tracking-wider font-bold">Destino</div>
                            <div className="font-black text-sm">CONTA BANCÁRIA</div>
                        </div>
                    </div>

                    {/* Alerta de saldo insuficiente */}
                    {valor > saldoAtual && saldoAtual > 0 && (
                        <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-danger" />
                            <span className="text-xs text-danger">
                                Saldo insuficiente. Disponível: R$ {saldoAtual.toFixed(2)}
                            </span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="form-group">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Valor da Transferência (R$)</label>
                            <MoneyInput
                                value={valor}
                                onValueChange={setValor}
                                className="text-xl font-black text-center"
                                placeholder="0,00"
                            />
                        </div>

                        <div className="form-group">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Conta Bancária de Destino</label>
                            {loading ? (
                                <div className="flex items-center justify-center py-2">
                                    <Loader2 className="animate-spin text-muted" size={20} />
                                </div>
                            ) : (
                                <select
                                    className="input w-full"
                                    value={contaId}
                                    onChange={e => setContaId(e.target.value)}
                                    required
                                >
                                    <option value="">Selecione uma conta...</option>
                                    {contas.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nome} - {c.banco || 'Banco'} ({c.agencia || '0000'} / {c.conta_numero || '00000-0'})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data da Transferência</label>
                            <input
                                type="date"
                                className="input w-full"
                                value={dataDeposito}
                                onChange={e => setDataDeposito(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>

                        <div className="form-group">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Nº Comprovante / Referência</label>
                            <input
                                type="text"
                                className="input w-full"
                                placeholder="Opcional"
                                value={comprovante}
                                onChange={e => setComprovante(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Observações</label>
                            <textarea
                                className="input w-full min-h-[80px]"
                                placeholder="Motivo ou detalhes adicionais..."
                                value={observacoes}
                                onChange={e => setObservacoes(e.target.value)}
                            />
                        </div>

                        {/* Preview do saldo após transferência */}
                        {valor > 0 && valor <= saldoAtual && (
                            <div className="bg-success/10 p-3 rounded-lg border border-success/20">
                                <p className="text-xs text-success font-bold flex items-center gap-2">
                                    <CheckCircle2 size={14} />
                                    Após transferência, saldo do cofre será:
                                </p>
                                <p className="text-lg font-bold text-success mt-1">
                                    R$ {(saldoAtual - valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex gap-3">
                        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary flex-1 gap-2" 
                            disabled={submitting || valor <= 0 || valor > saldoAtual || !contaId}
                        >
                            {submitting ? (
                                <><Loader2 className="animate-spin" size={16} /> Processando...</>
                            ) : (
                                <><CheckCircle2 size={16} /> Confirmar Transferência</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
