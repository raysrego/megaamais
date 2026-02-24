'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, ArrowRight, Building2, Wallet, CheckCircle2 } from 'lucide-react';
import { getContasBancarias, realizarDeposito } from '@/actions/financeiro';
import { useToast } from '@/contexts/ToastContext';
import { MoneyInput } from './ui/MoneyInput';

interface ModalTransferenciaCofreProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ModalTransferenciaCofre({ isOpen, onClose, onSuccess }: ModalTransferenciaCofreProps) {
    const [contas, setContas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const { toast } = useToast();

    // Form fields
    const [valor, setValor] = useState<number>(0);
    const [contaId, setContaId] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [comprovante, setComprovante] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadContas();
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
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numValor = valor;

        if (isNaN(numValor) || numValor <= 0) {
            toast({ message: 'Informe um valor válido', type: 'warning' });
            return;
        }

        if (!contaId) {
            toast({ message: 'Selecione uma conta de destino', type: 'warning' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await realizarDeposito(numValor, contaId, comprovante, observacoes);
            if (res.success) {
                toast({ message: 'Transferência realizada com sucesso!', type: 'success' });
                onSuccess?.();
                onClose();
            } else {
                toast({ message: 'Erro: ' + res.error, type: 'error' });
            }
        } catch (err) {
            console.error(err);
            toast({ message: 'Falha interna ao processar depósito', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose} />
            <div className="modal-container p-0 overflow-hidden" style={{ maxWidth: 500 }}>
                <div className="modal-header border-b border-border p-4 bg-white/2 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-accent" size={20} />
                        <h2 className="text-lg font-bold">Depósito Bancário (Cofre)</h2>
                    </div>
                    <button onClick={onClose} className="btn-close"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex items-center justify-between mb-8 bg-accent/5 p-4 rounded-xl border border-accent/20">
                        <div className="text-center flex-1">
                            <Wallet className="mx-auto mb-1 text-muted" size={16} />
                            <div className="text-[0.6rem] uppercase tracking-wider font-bold">Origem</div>
                            <div className="font-black text-sm">COFRE CENTRAL</div>
                        </div>
                        <ArrowRight className="text-accent/40" size={24} />
                        <div className="text-center flex-1">
                            <Building2 className="mx-auto mb-1 text-muted" size={16} />
                            <div className="text-[0.6rem] uppercase tracking-wider font-bold">Destino</div>
                            <div className="font-black text-sm">BANCO / CONTA</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="form-group">
                            <label className="label">Valor do Depósito (R$)</label>
                            <MoneyInput
                                value={valor}
                                onValueChange={setValor}
                                className="text-xl font-black text-center"
                                placeholder="0,00"
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Conta Bancária de Destino</label>
                            <select
                                className="input"
                                value={contaId}
                                onChange={e => setContaId(e.target.value)}
                                required
                            >
                                <option value="">Selecione uma conta...</option>
                                {contas.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.nome} - {c.financeiro_bancos?.nome} ({c.agencia} / {c.conta_numero})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Nº Comprovante / Envelope</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Opcional"
                                value={comprovante}
                                onChange={e => setComprovante(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Observações</label>
                            <textarea
                                className="input min-h-[80px]"
                                placeholder="Motivo ou detalhes adicionais..."
                                value={observacoes}
                                onChange={e => setObservacoes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary flex-1 gap-2" disabled={submitting}>
                            <CheckCircle2 size={18} />
                            {submitting ? 'Processando...' : 'Confirmar Depósito'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
