'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Upload, X, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { TransacaoFinanceira } from '@/hooks/useFinanceiro';

interface ModalBaixaProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: TransacaoFinanceira | null;
    onConfirm: (data: { dataPagamento: string; metodo: string; arquivo: File | null }) => Promise<void>;
}

export function ModalBaixaFinanceira({ isOpen, onClose, transaction, onConfirm }: ModalBaixaProps) {
    const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
    const [metodo, setMetodo] = useState('pix');
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    if (!transaction) return null;

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm({ dataPagamento, metodo, arquivo });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-bg-card border border-border text-text-primary">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-wide">
                        <DollarSign size={24} className="text-emerald-500" />
                        Baixar Lançamento
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Resumo do Lançamento */}
                    <div className="bg-bg-dark p-5 rounded-xl border border-border">
                        <p className="text-[0.7rem] font-bold text-text-muted uppercase tracking-widest mb-1">Lançamento</p>
                        <p className="font-extrabold text-xl mb-3 text-white">{transaction.descricao}</p>
                        <div className="flex justify-between items-end border-t border-border pt-3">
                            <div className="flex flex-col">
                                <span className="text-[0.7rem] font-bold text-text-muted uppercase">Vencimento</span>
                                <span className="text-sm font-medium text-text-secondary">{new Date(transaction.data_vencimento).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <span className="text-2xl font-black text-emerald-400">
                                R$ {transaction.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <label className="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Data do Pagamento</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 h-4 w-4 text-text-muted/50" />
                                <input
                                    type="date"
                                    className="input pl-10 h-10 font-medium"
                                    value={dataPagamento}
                                    onChange={(e) => setDataPagamento(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Forma de Pagamento</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-3 h-4 w-4 text-text-muted/50" />
                                <select
                                    className="input pl-10 h-10 font-medium appearance-none cursor-pointer"
                                    value={metodo}
                                    onChange={(e) => setMetodo(e.target.value)}
                                >
                                    <option value="pix">PIX</option>
                                    <option value="dinheiro">Dinheiro</option>
                                    <option value="cartao">Cartão de Crédito/Débito</option>
                                    <option value="boleto">Boleto Bancário</option>
                                    <option value="transferencia">Transferência</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Comprovante (Opcional)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    id="upload-comprovante"
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                                />
                                <label
                                    htmlFor="upload-comprovante"
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-dark hover:bg-bg-card-hover border border-border border-dashed rounded-lg cursor-pointer transition-all duration-200 group"
                                >
                                    <Upload size={16} className="text-text-muted group-hover:text-emerald-400 transition-colors" />
                                    {arquivo ? (
                                        <span className="text-emerald-400 font-bold truncate text-xs">{arquivo.name}</span>
                                    ) : (
                                        <span className="text-text-muted group-hover:text-text-primary text-xs font-bold uppercase">Anexar Arquivo</span>
                                    )}
                                </label>
                                {arquivo && (
                                    <button
                                        onClick={() => setArquivo(null)}
                                        className="p-2.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-lg transition-colors"
                                        title="Remover arquivo"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 mt-2">
                    <button
                        onClick={onClose}
                        className="btn btn-ghost"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="btn btn-success w-full sm:w-auto"
                    >
                        {loading ? 'Processando...' : 'Confirmar Baixa'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
