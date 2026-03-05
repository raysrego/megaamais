'use client';

import { useState, useRef, useMemo } from 'react';
import {
    X,
    AlertTriangle,
    Smartphone,
    Calculator,
    Loader2,
    CheckCircle2,
    Lock,
    ArrowUpCircle,
    ArrowDownCircle
} from 'lucide-react';
import { processarRelatorioTFL } from '@/actions/ocr';
import { CaixaSessao } from '@/hooks/useCaixa';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { MoneyInput } from '../ui/MoneyInput';

// Interface mínima para transações – apenas o que o modal precisa
interface TransacaoBase {
    valor: number;
    metodo_pagamento: string;
}

interface ModalFechamentoCaixaProps {
    sessao: CaixaSessao;
    transacoes: TransacaoBase[]; // Agora aceita qualquer tipo com essas propriedades
    onClose: () => void;
    onFinish: (result: {
        observacoes?: string;
        tflData?: {
            tfl_vendas?: number;
            tfl_premios?: number;
            tfl_contas?: number;
            tfl_saldo_projetado?: number;
            tfl_comprovante_url?: string;
        };
    }) => void;
}

export function ModalFechamentoCaixa({ sessao, transacoes, onClose, onFinish }: ModalFechamentoCaixaProps) {
    const [step, setStep] = useState(0); // 0: Escolha TFL, 1: Dados TFL, 2: Revisão
    const [metodoEntrada, setMetodoEntrada] = useState<'manual' | 'scan' | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Dados TFL
    const [tflVendas, setTflVendas] = useState<number>(0);
    const [tflPremios, setTflPremios] = useState<number>(0);
    const [tflContas, setTflContas] = useState<number>(0);
    const [tflSaldoProjetado, setTflSaldoProjetado] = useState<number>(0);
    const [tflComprovanteUrl, setTflComprovanteUrl] = useState<string>('');

    // Observações do operador
    const [observacoes, setObservacoes] = useState('');
    const [justificativaFundoAusente, setJustificativaFundoAusente] = useState('');

    const { toast } = useToast();
    const confirm = useConfirm();

    const temFundoCaixa = sessao?.tem_fundo_caixa ?? true;

    // Cálculos dos totais do sistema
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

    const saldoEsperado = useMemo(() => {
        return (sessao?.valor_inicial || 0) + totalCreditos - totalDebitos;
    }, [sessao, totalCreditos, totalDebitos]);

    const totalPix = useMemo(() => {
        return transacoes
            .filter(mov => mov.metodo_pagamento === 'pix')
            .reduce((acc, mov) => acc + mov.valor, 0);
    }, [transacoes]);

    // Scan do TFL
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setMetodoEntrada('scan');

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const base64 = event.target?.result as string;
                    const result = await processarRelatorioTFL(base64);

                    const hoje = new Date().toLocaleDateString('pt-BR');
                    if (result.dataRelatorio && result.dataRelatorio !== hoje) {
                        const confirmarAntigo = await confirm({
                            title: 'Data Incorreta',
                            description: `ATENÇÃO: A data do relatório (${result.dataRelatorio}) não é de hoje (${hoje}). Deseja continuar mesmo assim?`,
                            variant: 'danger',
                            confirmLabel: 'Sim, continuar'
                        });

                        if (!confirmarAntigo) {
                            setIsScanning(false);
                            return;
                        }
                    }

                    if (parseFloat(result.estornos) > 0) {
                        toast({ message: `Atenção: Identificamos R$ ${result.estornos} em ESTORNOS neste relatório.`, type: 'warning' });
                    }

                    setTflVendas(parseFloat(result.vendas));
                    setTflContas(parseFloat(result.contas));
                    setTflPremios(parseFloat(result.premios));
                    setTflSaldoProjetado(parseFloat(result.saldo));

                    setIsScanning(false);
                    setStep(1);
                } catch (err: any) {
                    console.error('Erro na extração OCR:', err);
                    toast({ message: `Não foi possível ler o relatório: ${err.message}`, type: 'error' });
                    setIsScanning(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Erro scan:', error);
            toast({ message: 'Não foi possível ler o relatório.', type: 'error' });
            setIsScanning(false);
        }
    };

    const triggerScan = () => {
        fileInputRef.current?.click();
    };

    const handleNext = () => {
        if (step === 0 && !metodoEntrada) {
            toast({ message: 'Selecione um método de entrada para os dados do TFL.', type: 'warning' });
            return;
        }
        if (step === 1) {
            if (metodoEntrada === 'manual' && tflSaldoProjetado === 0) {
                toast({ message: 'Informe o saldo projetado do TFL para continuar.', type: 'warning' });
                return;
            }
            setStep(2);
        }
    };

    const handleConfirm = async () => {
        if (!temFundoCaixa && !justificativaFundoAusente.trim()) {
            toast({ message: 'Justifique a ausência do fundo de caixa.', type: 'warning' });
            return;
        }

        setIsProcessing(true);
        try {
            const tflData = {
                tfl_vendas: tflVendas,
                tfl_premios: tflPremios,
                tfl_contas: tflContas,
                tfl_saldo_projetado: tflSaldoProjetado,
                tfl_comprovante_url: tflComprovanteUrl || undefined
            };

            let observacoesFinais = observacoes;
            if (!temFundoCaixa && justificativaFundoAusente.trim()) {
                observacoesFinais = (observacoesFinais ? observacoesFinais + '\n\n' : '') +
                    `FUNDO DE CAIXA AUSENTE: ${justificativaFundoAusente}`;
            }

            await onFinish({
                observacoes: observacoesFinais || undefined,
                tflData
            });

            setIsSuccess(true);
        } catch (error) {
            console.error('Erro ao fechar caixa:', error);
            toast({ message: 'Erro ao processar fechamento.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const renderStep = () => {
        if (isSuccess) {
            return (
                <div className="text-center py-6 animate-in fade-in zoom-in">
                    <CheckCircle2 size={56} className="mx-auto text-success mb-4" />
                    <h3 className="text-xl font-black mb-2">Caixa Encerrado</h3>
                    <p className="text-sm text-muted mb-6">O turno foi finalizado com sucesso.</p>
                    <button className="btn btn-primary w-full" onClick={onClose}>Concluir</button>
                </div>
            );
        }

        switch (step) {
            case 0:
                return (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="text-center mb-4">
                            <p className="text-sm text-muted">Informe os dados do terminal TFL</p>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={triggerScan}
                            className="btn btn-ghost w-full h-20 flex items-center justify-center gap-3 border-border bg-primary-blue/5 hover:bg-primary-blue/10"
                            disabled={isScanning}
                        >
                            {isScanning ? (
                                <Loader2 size={24} className="animate-spin" />
                            ) : (
                                <Smartphone size={24} className="text-primary-blue-light" />
                            )}
                            <span className="font-bold">Smart Scan (foto do relatório)</span>
                        </button>
                        <button
                            onClick={() => { setMetodoEntrada('manual'); setStep(1); }}
                            className="btn btn-ghost w-full h-20 flex items-center justify-center gap-3 border-border"
                        >
                            <Calculator size={24} className="text-muted" />
                            <span className="font-bold">Preenchimento Manual</span>
                        </button>
                        {isScanning && (
                            <p className="text-xs text-center text-primary-blue-light animate-pulse">
                                Processando imagem...
                            </p>
                        )}
                    </div>
                );

            case 1:
                return (
                    <div className="space-y-4 animate-in fade-in">
                        <h4 className="text-xs font-black uppercase text-muted mb-2">
                            {metodoEntrada === 'scan' ? 'Dados extraídos do scan' : 'Informe os dados do TFL'}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-group">
                                <label className="text-[10px] font-black uppercase text-muted">Vendas Totais</label>
                                <MoneyInput value={tflVendas} onValueChange={setTflVendas} placeholder="0,00" />
                            </div>
                            <div className="form-group">
                                <label className="text-[10px] font-black uppercase text-muted">Prêmios Pagos</label>
                                <MoneyInput value={tflPremios} onValueChange={setTflPremios} placeholder="0,00" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="text-[10px] font-black uppercase text-muted">Recebimento de Contas</label>
                            <MoneyInput value={tflContas} onValueChange={setTflContas} placeholder="0,00" />
                        </div>
                        <div className="form-group pt-2 border-t border-border">
                            <label className="text-[10px] font-black uppercase text-primary-blue-light">Saldo Projetado (TFL)</label>
                            <MoneyInput
                                value={tflSaldoProjetado}
                                onValueChange={setTflSaldoProjetado}
                                className="border-primary-blue-light/30 font-black"
                                placeholder="0,00"
                            />
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button className="btn btn-ghost flex-1" onClick={() => setStep(0)}>Voltar</button>
                            <button className="btn btn-primary flex-2" onClick={handleNext}>Próximo</button>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="bg-surface-subtle p-4 rounded-xl border border-border">
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
                                <div className="flex justify-between pt-2 border-t border-border font-black">
                                    <span>Saldo Final:</span>
                                    <span className={saldoEsperado >= 0 ? 'text-success' : 'text-danger'}>
                                        R$ {saldoEsperado.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-muted">
                                    <span>Total PIX:</span>
                                    <span>R$ {totalPix.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {!temFundoCaixa && (
                            <div className="card bg-warning/10 border-warning/30 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={18} className="text-warning" />
                                    <p className="text-sm font-bold text-warning">Fundo de Caixa Ausente</p>
                                </div>
                                <p className="text-xs text-muted mb-2">
                                    Na abertura foi informado que os R$ 100,00 do fundo não estavam presentes.
                                </p>
                                <textarea
                                    className="input w-full"
                                    rows={2}
                                    value={justificativaFundoAusente}
                                    onChange={(e) => setJustificativaFundoAusente(e.target.value)}
                                    placeholder="Justifique o motivo..."
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="text-[10px] font-black uppercase text-muted">Observações (opcional)</label>
                            <textarea
                                className="input w-full"
                                rows={3}
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                placeholder="Alguma observação sobre o turno?"
                            />
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button className="btn btn-ghost flex-1" onClick={() => setStep(1)}>Voltar</button>
                            <button
                                className="btn btn-primary flex-2 font-black"
                                onClick={handleConfirm}
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                                {isProcessing ? 'Processando...' : 'Confirmar e Encerrar'}
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Lock size={18} className="text-primary-blue-light" />
                        <h2 className="text-lg font-black">Fechamento de Jornada</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {renderStep()}
                </div>
            </div>
        </>
    );
}
