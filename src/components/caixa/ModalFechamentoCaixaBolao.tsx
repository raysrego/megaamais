'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Check,
    AlertTriangle,
    DollarSign,
    TrendingUp,
    Users,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { useCaixaBolao, CaixaBolaoSessao, VendaBolao } from '@/hooks/useCaixaBolao';
import { useToast } from '@/contexts/ToastContext';
import { MoneyInput } from '../ui/MoneyInput';

interface Props {
    sessao: CaixaBolaoSessao;
    onClose: () => void;
    onSuccess: () => void;
}

export function ModalFechamentoCaixaBolao({ sessao, onClose, onSuccess }: Props) {
    const { buscarVendasSessao, calcularTotaisSessao, fecharCaixaBolao } = useCaixaBolao();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [vendas, setVendas] = useState<VendaBolao[]>([]);
    const [totais, setTotais] = useState({ total_vendido: 0, total_dinheiro: 0, total_pix: 0 });
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Valores informados
    const [dinheiroInformado, setDinheiroInformado] = useState<number>(0);
    const [pixInformado, setPixInformado] = useState<number>(0);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        carregarDados();
    }, [sessao.id]);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [listaVendas, resumototais] = await Promise.all([
                buscarVendasSessao(sessao.id),
                calcularTotaisSessao(sessao.id)
            ]);
            setVendas(listaVendas);
            setTotais(resumototais);

            // Inicializar informados com os calculados para facilitar
            setDinheiroInformado(resumototais.total_dinheiro);
            setPixInformado(resumototais.total_pix);
        } catch (error) {
            console.error('Erro ao carregar dados de fechamento:', error);
            toast({ message: 'Erro ao carregar dados de fechamento', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmar = async () => {
        setIsProcessing(true);
        try {
            await fecharCaixaBolao({
                sessaoId: sessao.id,
                dinheiroInformado,
                pixInformado,
                observacoes
            });
            toast({ message: 'Caixa Bolão encerrado com sucesso!', type: 'success' });
            onSuccess();
        } catch (error: any) {
            console.error('Erro ao encerrar Caixa Bolão:', error);
            toast({ message: `Erro ao encerrar: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Agrupar vendas por operador
    const vendasPorOperador = vendas.reduce((acc: any, venda) => {
        if (!acc[venda.vendedor_nome]) {
            acc[venda.vendedor_nome] = { qtd: 0, total: 0 };
        }
        acc[venda.vendedor_nome].qtd += 1;
        acc[venda.vendedor_nome].total += venda.valor_total;
        return acc;
    }, {});

    const diffDinheiro = dinheiroInformado - totais.total_dinheiro;
    const diffPix = pixInformado - totais.total_pix;
    const temDiferença = Math.abs(diffDinheiro) > 0.01 || Math.abs(diffPix) > 0.01;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
                    <div>
                        <h2 className="text-xl font-black">Encerrar Caixa Bolão</h2>
                        <p className="text-xs text-muted">Sessão #{sessao.id.toString().padStart(4, '0')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={48} className="animate-spin text-primary mb-4" />
                            <p className="text-muted">Consolidando vendas...</p>
                        </div>
                    ) : (
                        <>
                            {step === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4">
                                            Vendas por Operador
                                        </h3>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {Object.entries(vendasPorOperador).map(([nome, data]: [string, any]) => (
                                                <div key={nome} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div>
                                                        <p className="font-bold text-sm">{nome}</p>
                                                        <p className="text-[10px] text-muted">{data.qtd} vendas realizadas</p>
                                                    </div>
                                                    <p className="font-black">R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            ))}
                                            {Object.keys(vendasPorOperador).length === 0 && (
                                                <p className="text-center py-8 text-muted text-sm italic">Nenhuma venda realizada nesta sessão.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold">Total Consolidado:</span>
                                            <span className="text-2xl font-black text-primary">
                                                R$ {totais.total_vendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-primary w-full h-14 font-black"
                                        onClick={() => setStep(2)}
                                    >
                                        Prosseguir para Conferência
                                    </button>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="space-y-4">
                                        {/* Conferência Dinheiro */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">
                                                💵 Dinheiro em Espécie
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 opacity-70">
                                                    <p className="text-[9px] text-muted mb-1 uppercase font-bold">Calculado</p>
                                                    <p className="font-black">R$ {totais.total_dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                                <MoneyInput
                                                    value={dinheiroInformado}
                                                    onValueChange={setDinheiroInformado}
                                                    className="font-black text-lg h-full"
                                                />
                                            </div>
                                        </div>

                                        {/* Conferência PIX */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">
                                                💳 PIX Recebido
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 opacity-70">
                                                    <p className="text-[9px] text-muted mb-1 uppercase font-bold">Calculado</p>
                                                    <p className="font-black">R$ {totais.total_pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                                <MoneyInput
                                                    value={pixInformado}
                                                    onValueChange={setPixInformado}
                                                    className="font-black text-lg h-full"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {temDiferença && (
                                        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex gap-3 animate-in shake duration-500">
                                            <AlertTriangle className="text-danger shrink-0" size={20} />
                                            <div>
                                                <p className="text-xs font-bold text-danger">Divergência detectada!</p>
                                                <p className="text-[10px] text-danger/80">
                                                    {diffDinheiro !== 0 && `Dinheiro: ${diffDinheiro > 0 ? 'Sobra' : 'Falta'} de R$ ${Math.abs(diffDinheiro).toFixed(2)}. `}
                                                    {diffPix !== 0 && `PIX: ${diffPix > 0 ? 'Sobra' : 'Falta'} de R$ ${Math.abs(diffPix).toFixed(2)}.`}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">
                                            Observações / Justificativa
                                        </label>
                                        <textarea
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none transition-colors"
                                            rows={3}
                                            placeholder="Alguma observação sobre o fechamento?"
                                            value={observacoes}
                                            onChange={(e) => setObservacoes(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            className="btn btn-ghost flex-1 h-14"
                                            onClick={() => setStep(1)}
                                            disabled={isProcessing}
                                        >
                                            Voltar
                                        </button>
                                        <button
                                            className="btn btn-danger flex-2 h-14 font-black"
                                            onClick={handleConfirmar}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin" /> : 'Finalizar e Encerrar'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
