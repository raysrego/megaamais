'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X,
    Check,
    AlertTriangle,
    DollarSign,
    Smartphone,
    Building,
    ArrowRightLeft,
    Coins,
    CheckCircle2,
    Lock,
    Calculator,
    Loader2
} from 'lucide-react';
import { processarRelatorioTFL } from '@/actions/ocr';
import { CaixaSessao } from '@/hooks/useCaixa';
import { TransacaoFinanceira } from '@/hooks/useFinanceiro';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { MoneyInput } from '../ui/MoneyInput';

interface ModalFechamentoCaixaProps {
    sessao?: CaixaSessao;
    transacoes?: TransacaoFinanceira[];
    onClose: () => void;
    onFinish: (result: any) => void;
}

export function ModalFechamentoCaixa({ sessao, transacoes, onClose, onFinish }: ModalFechamentoCaixaProps) {
    const [step, setStep] = useState(0); // 0: Escolha, 1: Dados TFL, 2: Física, 3: Review
    const [metodoEntrada, setMetodoEntrada] = useState<'manual' | 'scan' | null>(null);
    const [tflVendas, setTflVendas] = useState<number>(0);
    const [tflPremios, setTflPremios] = useState<number>(0);
    const [tflContas, setTflContas] = useState<number>(0);
    const [tflSaldoProjetado, setTflSaldoProjetado] = useState<number>(0);
    const [tflPixTotal, setTflPixTotal] = useState<number>(0); // NOVO: PIX do TFL
    const [isScanning, setIsScanning] = useState(false);

    // NOVO: Estados para o fluxo refatorado
    const [valorSangrias, setValorSangrias] = useState<number>(0);
    const [valorDepositoFilial, setValorDepositoFilial] = useState<number>(0);
    const [justificativa, setJustificativa] = useState('');
    const [justificativaFundoAusente, setJustificativaFundoAusente] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const { toast } = useToast();
    const confirm = useConfirm();

    // Estado para PIX calculado
    const [totalPixCalculado, setTotalPixCalculado] = useState(0);

    // Calcular PIX total automaticamente ao carregar sessão
    useEffect(() => {
        if (!sessao) {
            setTotalPixCalculado(0);
            return;
        }

        const fetchTotalPix = async () => {
            try {
                const { getTotalPixManual } = await import('@/actions/caixa-calculos');
                const total = await getTotalPixManual(sessao.id);
                setTotalPixCalculado(total);
            } catch (error) {
                console.error('Erro ao calcular PIX manual:', error);
                setTotalPixCalculado(0);
            }
        };

        fetchTotalPix();
    }, [sessao]);

    // Verificar se fundo de caixa está presente
    const temFundoCaixa = sessao?.tem_fundo_caixa ?? true;
    const VALOR_FUNDO = 100; // R$100 fixo

    // Cálculos do Sistema REFATORADOS
    const calcEsperado = () => {
        if (tflSaldoProjetado) {
            // Saldo TFL já vem sem o fundo, não precisa descontar
            return {
                sangrias: 0, // Esperado é zero (será informado manualmente)
                pix: totalPixCalculado,
                depositoFilial: 0 // Esperado é zero (será informado manualmente)
            };
        }

        if (sessao) {
            // Saldo do sistema
            let saldoEsperado = sessao.valor_final_calculado;

            // Se tem fundo de caixa, descontar do esperado
            if (temFundoCaixa) {
                saldoEsperado -= VALOR_FUNDO;
            }

            return {
                sangrias: 0,
                pix: totalPixCalculado,
                depositoFilial: 0
            };
        }

        return { sangrias: 0, pix: 0, depositoFilial: 0 };
    };

    const esperado = calcEsperado();
    const informado = {
        sangrias: valorSangrias || 0,
        pix: totalPixCalculado, // Calculado automaticamente
        depositoFilial: valorDepositoFilial || 0
    };

    const diffs = {
        sangrias: informado.sangrias - esperado.sangrias,
        pix: informado.pix - esperado.pix,
        depositoFilial: informado.depositoFilial - esperado.depositoFilial
    };

    const temDiferencaCritica = () => {
        return Math.abs(diffs.sangrias) > 0.01 ||
            Math.abs(diffs.pix) > 0.01 ||
            Math.abs(diffs.depositoFilial) > 0.01;
    };

    const handleNext = () => {
        if (step === 0) {
            setStep(1);
        } else if (step === 1) {
            // Validar se campos TFL estão preenchidos se manual
            if (metodoEntrada === 'manual' && !tflSaldoProjetado) {
                toast({ message: 'Por favor, informe ao menos o Saldo Final Projetado do TFL.', type: 'warning' });
                return;
            }
            setStep(2);
        } else if (step === 2) {
            // Validar fundo de caixa ausente
            if (!temFundoCaixa && !justificativaFundoAusente.trim()) {
                toast({ message: 'Por favor, justifique a ausência do fundo de caixa.', type: 'warning' });
                return;
            }
            setStep(3);
        }
    };

    const handleConfirm = async () => {
        if (temDiferencaCritica() && !justificativa) {
            toast({ message: 'Por favor, informe uma justificativa para as divergências encontradas.', type: 'warning' });
            return;
        }

        setIsProcessing(true);
        try {
            // Total informado = total informado em sangrias + depósitos
            // (PIX é calculado automaticamente, não é "informado" manualmente)
            const totalInformado = valorSangrias + valorDepositoFilial;

            const tflData = {
                tfl_vendas: tflVendas,
                tfl_premios: tflPremios,
                tfl_contas: tflContas,
                tfl_saldo_projetado: tflSaldoProjetado
            };

            // Montar justificativa final
            let justificativaFinal = temDiferencaCritica() ? justificativa : 'Caixa fechado sem divergências.';

            // Adicionar justificativa de fundo ausente se aplicável
            if (!temFundoCaixa && justificativaFundoAusente.trim()) {
                justificativaFinal += `\n\n⚠️ FUNDO DE CAIXA AUSENTE: ${justificativaFundoAusente}`;
            }

            await onFinish({
                totalInformado,
                justificativa: justificativaFinal,
                ...tflData
            });
            setIsSuccess(true);
        } catch (error) {
            console.error('Erro ao processar fechamento:', error);
            toast({ message: 'Erro ao processar fechamento.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

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

                    // Validação de Data (Segurança Antifraude)
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

                    // Validação de Estornos (Alerta Operacional)
                    if (parseFloat(result.estornos) > 0) {
                        toast({ message: `Atenção: Identificamos R$ ${result.estornos} em ESTORNOS neste relatório. Verifique se o saldo final foi impactado.`, type: 'warning' });
                    }

                    setTflVendas(parseFloat(result.vendas));
                    setTflContas(parseFloat(result.contas));
                    setTflPremios(parseFloat(result.premios));
                    setTflSaldoProjetado(parseFloat(result.saldo));


                    setIsScanning(false);
                    setStep(1);
                } catch (err: any) {
                    console.error('Erro na extração OCR:', err);
                    toast({ message: `Não foi possível ler o relatório: ${err.message || 'Erro desconhecido'}`, type: 'error' });
                    setIsScanning(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Erro scan:', error);
            toast({ message: 'Não foi possível ler o relatório. Tente enviar uma foto mais nítida.', type: 'error' });
            setIsScanning(false);
        }
    };

    const triggerScan = () => {
        fileInputRef.current?.click();
    };

    const isDataFromScan = metodoEntrada === 'scan' && tflSaldoProjetado > 0;


    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-heavy)', zIndex: 9998 }} />
            <div
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '95%',
                    maxWidth: 480,
                    background: 'var(--bg-card)',
                    borderRadius: 24,
                    border: '1px solid var(--border)',
                    zIndex: 9999,
                    overflow: 'hidden'
                }}
            >
                {/* Cabeçalho */}
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        background: 'rgba(var(--primary-blue-light-rgb), 0.1)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem',
                        color: 'var(--primary-blue-light)'
                    }}>
                        <Lock size={20} />
                    </div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Fechamento de Jornada</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conferência de Lançamentos</p>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {isSuccess ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0' }} className="animate-in fade-in zoom-in duration-300">
                            <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>
                                <CheckCircle2 size={56} style={{ margin: '0 auto' }} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Caixa Encerrado</h3>
                            <p className="text-muted text-sm mt-2 px-6">Os dados foram enviados para o servidor e o terminal está liberado.</p>
                            <button className="btn btn-primary mt-8 w-full" onClick={onClose}>Concluir</button>
                        </div>
                    ) : (
                        <>
                            {step === 0 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="text-center mb-6">
                                        <p className="text-sm text-muted">Como deseja informar os dados do terminal (TFL)?</p>
                                    </div>
                                    <div className="grid gap-3">
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
                                            className="btn btn-ghost h-20 flex flex-col items-center justify-center gap-2 border-border bg-primary-blue/5 hover:bg-primary-blue/10 transition-all border-dashed"
                                        >
                                            <Smartphone size={24} className="text-primary-blue-light" />
                                            <span className="font-bold text-sm">Smart Scan (Foto do Relatório)</span>
                                        </button>
                                        <button
                                            onClick={() => { setMetodoEntrada('manual'); setStep(1); }}
                                            className="btn btn-ghost h-20 flex flex-col items-center justify-center gap-2 border-border bg-white/2"
                                        >
                                            <Calculator size={24} className="text-muted" />
                                            <span className="font-bold text-sm">Preenchimento Manual</span>
                                        </button>
                                    </div>
                                    {isScanning && (
                                        <div className="flex flex-col items-center justify-center py-4 text-primary-blue-light">
                                            <Loader2 size={32} className="animate-spin mb-2" />
                                            <span className="text-xs font-bold animate-pulse">Processando imagem...</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 1 && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-[10px] font-black uppercase text-muted tracking-widest">
                                            {metodoEntrada === 'scan' ? 'Dados Extraídos do Scan' : 'Informar Totais TFL'}
                                        </h4>
                                        {metodoEntrada === 'scan' && <span className="badge success text-[0.6rem]">SCAN OK</span>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="form-group">
                                            <label className="text-[10px] font-black uppercase text-muted mb-1 block">Vendas Totais</label>
                                            <MoneyInput
                                                className={`font-bold ${isDataFromScan ? 'bg-primary-blue/5 border-primary-blue/20' : ''}`}
                                                value={tflVendas}
                                                onValueChange={setTflVendas}
                                                placeholder="0,00"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="text-[10px] font-black uppercase text-muted mb-1 block">Prêmios Pagos</label>
                                            <MoneyInput
                                                className={`font-bold ${isDataFromScan ? 'bg-primary-blue/5 border-primary-blue/20' : ''}`}
                                                value={tflPremios}
                                                onValueChange={setTflPremios}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="text-[10px] font-black uppercase text-muted mb-1 block">Recebimento de Contas/Faturas</label>
                                        <MoneyInput
                                            className={`font-bold ${isDataFromScan ? 'bg-primary-blue/5 border-primary-blue/20' : ''}`}
                                            value={tflContas}
                                            onValueChange={setTflContas}
                                            placeholder="0,00"
                                        />
                                    </div>

                                    <div className="form-group pt-2 border-t border-border">
                                        <label className="text-[10px] font-black uppercase text-primary-blue-light mb-1 block">Saldo Final Projetado (TFL)</label>
                                        <MoneyInput
                                            className="border-primary-blue-light/30 focus:border-primary-blue-light text-primary-blue-light font-black text-lg"
                                            value={tflSaldoProjetado}
                                            onValueChange={setTflSaldoProjetado}
                                            placeholder="0,00"
                                        />
                                        <p className="text-[0.65rem] text-muted mt-1 italic">Este valor é usado para comparar com o dinheiro contado.</p>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        <button className="btn btn-ghost flex-1 h-[48px]" onClick={() => setStep(0)}>Voltar</button>
                                        <button className="btn btn-primary flex-2" onClick={handleNext}>Próximo Passo</button>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="card" style={{ background: 'rgba(34, 197, 94, 0.03)', padding: '1rem', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                                        <p className="text-[10px] uppercase font-black text-success tracking-widest mb-1">Passo 2: Lançamentos do Turno</p>
                                        <p className="text-xs text-muted leading-relaxed">Informe sangrias, confirme o PIX calculado e depósitos em outras filiais.</p>
                                    </div>

                                    <div className="space-y-3">
                                        {/* Campo 1: Sangrias */}
                                        <div className="form-group">
                                            <label className="text-[10px] font-black uppercase text-muted mb-1 block">Valor Total de Sangrias</label>
                                            <MoneyInput
                                                value={valorSangrias}
                                                onValueChange={setValorSangrias}
                                                className="font-extrabold"
                                                placeholder="0,00"
                                            />
                                            <p className="text-[0.65rem] text-muted mt-1 italic">Quanto foi retirado do caixa (sangrias para cofre)</p>
                                        </div>

                                        {/* Campo 2: PIX (read-only calculado) */}
                                        <div className="form-group">
                                            <label className="text-[10px] font-black uppercase text-success mb-1 block">Total PIX (Calculado Automaticamente)</label>
                                            <div className="input bg-success/5 border-success/20 font-black text-success text-xl pointer-events-none flex items-center justify-between">
                                                <span>R$ {totalPixCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                <CheckCircle2 size={20} className="text-success" />
                                            </div>
                                            <p className="text-[0.65rem] text-muted mt-1 italic">Soma automática de todas movimentações PIX do dia</p>
                                        </div>

                                        {/* Campo 3: Depósito Filial */}
                                        <div className="form-group">
                                            <label className="text-[10px] font-black uppercase text-muted mb-1 block">Depósito em Outra Filial</label>
                                            <MoneyInput
                                                value={valorDepositoFilial}
                                                onValueChange={setValorDepositoFilial}
                                                className="font-bold"
                                                placeholder="0,00"
                                            />
                                            <p className="text-[0.65rem] text-muted mt-1 italic">Valor depositado em outra unidade</p>
                                        </div>

                                        {/* Alerta de Fundo de Caixa Ausente */}
                                        {!temFundoCaixa && (
                                            <div className="card bg-warning/10 border-warning/30 p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertTriangle size={18} className="text-warning" />
                                                    <p className="text-sm font-bold text-warning">Fundo de Caixa Ausente</p>
                                                </div>
                                                <p className="text-xs text-muted mb-3">
                                                    Foi identificado na abertura que os R$100,00 do fundo de caixa não estavam presentes.
                                                    Por favor, justifique o motivo:
                                                </p>
                                                <textarea
                                                    className="input"
                                                    rows={2}
                                                    value={justificativaFundoAusente}
                                                    onChange={(e) => setJustificativaFundoAusente(e.target.value)}
                                                    placeholder="Ex: Fundo foi usado para troco emergencial, será reposto amanhã..."
                                                    style={{ resize: 'none', background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        <button className="btn btn-ghost flex-1 h-[48px]" onClick={() => setStep(1)}>Voltar</button>
                                        <button className="btn btn-primary flex-2" onClick={handleNext}>Conferir Tudo</button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div style={{ padding: '1rem', borderRadius: 16, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                                        <h4 className="text-[10px] font-black text-muted uppercase mb-3 text-center tracking-widest">Resultado do Balanço</h4>

                                        <div className="space-y-2">
                                            {[
                                                { label: 'Sangrias', val: informado.sangrias, esp: esperado.sangrias, diff: diffs.sangrias },
                                                { label: 'PIX (Calculado)', val: informado.pix, esp: esperado.pix, diff: diffs.pix },
                                                { label: 'Depósito Filial', val: informado.depositoFilial, esp: esperado.depositoFilial, diff: diffs.depositoFilial }
                                            ].map((item, i) => (
                                                <div key={i} className="flex flex-col p-3 rounded-xl bg-black/20 border border-white/5">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold">{item.label}</span>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${Math.abs(item.diff) < 0.01 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                                            {Math.abs(item.diff) < 0.01 ? 'CONFERIDO' : item.diff > 0 ? 'SOBRA' : 'FALTA'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div className="text-[9px] text-muted">
                                                            Informado: R$ {item.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /
                                                            Esperado: R$ {item.esp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </div>
                                                        <div className={`text-sm font-black ${item.diff < 0 ? 'text-danger' : item.diff > 0 ? 'text-accent' : 'text-success'}`}>
                                                            {Math.abs(item.diff) < 0.01 ? 'R$ 0,00' : `R$ ${item.diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className={`flex justify-between mt-4 p-4 rounded-2xl ${!temDiferencaCritica() ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'}`}>
                                            <span className="font-bold text-sm">Resultado Geral:</span>
                                            <span className="font-extrabold text-lg">
                                                {temDiferencaCritica() ? `R$ ${(diffs.sangrias + diffs.pix + diffs.depositoFilial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'SEM QUEBRAS'}
                                            </span>
                                        </div>
                                    </div>

                                    {temDiferencaCritica() && (
                                        <div className="card danger" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)' }}>
                                            <p className="text-[10px] font-black text-danger uppercase mb-2">Justificativa da Divergência</p>
                                            <textarea
                                                className="input"
                                                placeholder="Descreva o que aconteceu..."
                                                rows={2}
                                                value={justificativa}
                                                onChange={e => setJustificativa(e.target.value)}
                                                style={{ resize: 'none', background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost flex-1 h-[52px]" onClick={() => setStep(2)} disabled={isProcessing}>Voltar</button>
                                        <button
                                            className="btn btn-primary flex-2 h-[52px] font-black text-lg"
                                            onClick={handleConfirm}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin" /> : 'Finalizar Turno'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <style jsx global>{`
                    @keyframes fadeInScale {
                        from { opacity: 0; transform: scale(0.9); }
                        to { opacity: 1; transform: scale(1); }
                    }
                `}</style>
            </div>
        </>
    );
}
