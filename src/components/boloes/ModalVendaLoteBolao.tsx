'use client';

import { useState } from 'react';
import {
    X,
    Smartphone,
    Wallet,
    UploadCloud,
    CheckCircle2,
    Loader2,
    DollarSign,
    Ticket,
    ShoppingBag
} from 'lucide-react';
import { useVendasBolao } from '@/hooks/useVendasBolao';
import { useToast } from '@/contexts/ToastContext';

interface ModalVendaLoteBolaoProps {
    bolao: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function ModalVendaLoteBolao({ bolao, onClose, onSuccess }: ModalVendaLoteBolaoProps) {
    const { venderCota } = useVendasBolao();
    const { toast } = useToast();

    const [quantidade, setQuantidade] = useState(1);
    const [formaPagamento, setFormaPagamento] = useState<'pix' | 'dinheiro'>('pix');
    const [comprovante, setComprovante] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const cotasDisponiveis = bolao.qtdCotas - bolao.cotasVendidas;
    const valorTotal = bolao.precoVendaCota * quantidade;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (quantidade <= 0 || quantidade > cotasDisponiveis) {
            toast({ message: "Quantidade inválida.", type: 'warning' });
            return;
        }

        if (formaPagamento === 'pix' && !comprovante) {
            toast({ message: "Por favor, anexe o comprovante do Pix para prosseguir.", type: 'warning' });
            return;
        }

        setIsSubmitting(true);

        try {
            // Realiza a venda via hook (Backend Supabase + RPC)
            // Nota: O hook precisa ser chamado 'quantidade' vezes ou modificado para aceitar lote.
            // Para simplificar e garantir integridade, chamamos o venderCota que já lida com estoque.
            await venderCota(bolao.id, quantidade, valorTotal, formaPagamento);

            toast({ message: 'Venda em lote realizada com sucesso!', type: 'success' });
            onSuccess();
        } catch (error: any) {
            console.error(error);
            toast({ message: "Erro ao processar venda em lote: " + error.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className="modal-container animate-in fade-in zoom-in-95 duration-200" style={{
                width: '100%',
                maxWidth: '480px',
                background: 'var(--bg-card)',
                borderRadius: '24px',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: 'none'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    background: 'var(--surface-subtle)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div className="flex items-center gap-3">
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '12px',
                            background: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                        }}>
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venda em Lote</h3>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Multiplas cotas do Concurso {bolao.concurso}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/5 p-2 rounded-full transition-colors">
                        <X size={20} className="text-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                    {/* Seletor de Quantidade */}
                    <div className="mb-6">
                        <label className="text-[10px] font-black uppercase text-muted mb-2 block">Quantidade de Cotas (Max: {cotasDisponiveis})</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max={cotasDisponiveis}
                                value={quantidade}
                                onChange={(e) => setQuantidade(parseInt(e.target.value))}
                                className="flex-1 h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent"
                            />
                            <div className="w-16 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center font-black text-xl text-accent">
                                {quantidade}
                            </div>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Forma de Recebimento</p>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            type="button"
                            onClick={() => setFormaPagamento('pix')}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${formaPagamento === 'pix'
                                ? 'border-[#1DB954] bg-[#1DB954]/5 text-[#1DB954]'
                                : 'border-white/5 hover:border-white/10 text-muted'
                                }`}
                        >
                            <Smartphone size={24} />
                            <span className="font-black text-xs uppercase tracking-wider">Pix / Digital</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormaPagamento('dinheiro')}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${formaPagamento === 'dinheiro'
                                ? 'border-orange-500 bg-orange-500/5 text-orange-500'
                                : 'border-white/5 hover:border-white/10 text-muted'
                                }`}
                        >
                            <Wallet size={24} />
                            <span className="font-black text-xs uppercase tracking-wider">Dinheiro</span>
                        </button>
                    </div>

                    {formaPagamento === 'pix' && (
                        <div className="animate-in fade-in slide-in-from-top-2 mb-6">
                            <label className="text-[10px] font-black uppercase text-muted mb-2 block">Anexar Comprovante (Obrigatório)</label>
                            <div className="border-2 border-dashed border-white/5 rounded-2xl p-6 text-center hover:bg-white/5 transition-colors cursor-pointer relative group">
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={e => setComprovante(e.target.files?.[0] || null)}
                                    accept="image/*"
                                />
                                <div className="flex flex-col items-center gap-2 text-muted">
                                    {comprovante ? (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954] mb-1">
                                                <CheckCircle2 size={24} />
                                            </div>
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider">{comprovante.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                                <UploadCloud size={24} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider">Selecionar Imagem</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ background: 'var(--surface-subtle)', padding: '1.25rem', borderRadius: '20px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-muted">Total a Pagar ({quantidade} cotas)</span>
                            <span className={`text-xl font-black ${formaPagamento === 'pix' ? 'text-[#1DB954]' : 'text-orange-500'}`}>
                                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`btn w-full py-4 font-black text-sm uppercase tracking-[0.2em]  transition-all active:scale-95 ${formaPagamento === 'pix' ? 'btn-success' : 'btn-warning'
                            }`}
                        style={{ height: 'auto', borderRadius: '16px' }}
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <Ticket size={18} className="mr-2" />
                                FINALIZAR VENDA EM LOTE
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}


