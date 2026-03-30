'use client';

import { useState, useMemo } from 'react';
import {
    X,
    AlertTriangle,
    Loader2,
    CheckCircle2,
    ArrowUpCircle,
    ArrowDownCircle,
    DollarSign,
    Wallet,
    Smartphone,
    Ticket,
    FileText,
    Building,
    ArrowRightLeft,
    Calculator,
    ChevronRight,
    ChevronLeft,
    Shield
} from 'lucide-react';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { CalculadoraNumerario } from '@/components/financeiro/CalculadoraNumerario';
import { CaixaSessao, CaixaMovimentacao } from '@/hooks/useCaixa';
import {
    calcularResumo,
    calcularReconciliacao,
    validarFechamento,
    formatarStatusReconciliacao,
    ResumoFechamento,
    ReconciliacaoCaixa
} from '@/lib/fechamento-utils';

interface ModalFechamentoCaixaProps {
    sessao?: CaixaSessao;
    transacoes: CaixaMovimentacao[];
    onClose: () => void;
    onFinish: (result: {
        observacoes?: string;
        resumo: ResumoFechamento;
        reconciliacao: ReconciliacaoCaixa;
        dinheiroEmMaos: number;
        valorEnviadoCofre: number;
        pixExternoInformado: number;
        fundoCaixaDevolvido: boolean;
    }) => Promise<void>;
}

type Step = 'resumo' | 'declaracao' | 'conferencia';

export function ModalFechamentoCaixa({ sessao, transacoes, onClose, onFinish }: ModalFechamentoCaixaProps) {
    const [step, setStep] = useState<Step>('resumo');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showCalculadora, setShowCalculadora] = useState(false);

    // Valores declarados pelo operador
    const [dinheiroEmMaos, setDinheiroEmMaos] = useState(0);
    const [valorEnviadoCofre, setValorEnviadoCofre] = useState(0);
    const [pixExternoInformado, setPixExternoInformado] = useState(0);
    const [fundoCaixaDevolvido, setFundoCaixaDevolvido] = useState(true);
    const [justificativa, setJustificativa] = useState('');

    const valorInicial = sessao?.valor_inicial ?? 0;

    // Calcular resumo a partir das movimentações
    const resumo = useMemo(() => {
        return calcularResumo(transacoes.map(t => ({ tipo: t.tipo, valor: t.valor })));
    }, [transacoes]);

    // Calcular reconciliação
    const reconciliacao = useMemo(() => {
        return calcularReconciliacao(valorInicial, resumo, dinheiroEmMaos);
    }, [valorInicial, resumo, dinheiroEmMaos]);

    const statusInfo = formatarStatusReconciliacao(reconciliacao.status);

    // Validação
    const erroValidacao = validarFechamento({
        dinheiroEmMaos,
        valorEnviadoCofre,
        diferenca: reconciliacao.diferenca,
        justificativa,
        fundoDevolvido: fundoCaixaDevolvido,
        valorInicial,
    });

    const handleConfirm = async () => {
        if (erroValidacao) return;

        setIsProcessing(true);
        try {
            await onFinish({
                observacoes: justificativa || undefined,
                resumo,
                reconciliacao,
                dinheiroEmMaos,
                valorEnviadoCofre,
                pixExternoInformado,
                fundoCaixaDevolvido,
            });
            setIsSuccess(true);
        } catch (error) {
            console.error('[Fechamento] Erro:', error);
            alert('Erro ao fechar caixa. Tente novamente.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Sucesso
    if (isSuccess) {
        return (
            <Overlay onClose={onClose}>
                <div className="p-8 text-center">
                    <CheckCircle2 size={56} className="mx-auto text-success mb-4" />
                    <h3 className="text-xl font-black mb-2">Turno Encerrado</h3>
                    <p className="text-sm text-muted mb-2">O fechamento foi enviado para auditoria do gerente.</p>
                    {reconciliacao.status === 'batido' && (
                        <p className="text-xs text-success font-bold">✅ Caixa bateu perfeitamente</p>
                    )}
                    <button className="btn btn-primary w-full mt-6" onClick={onClose}>Concluir</button>
                </div>
            </Overlay>
        );
    }

    return (
        <Overlay onClose={onClose}>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-subtle">
                <div className="flex items-center gap-2">
                    <DollarSign size={18} className="text-primary-blue-light" />
                    <div>
                        <h2 className="text-base font-black">Encerramento de Turno</h2>
                        <p className="text-[10px] text-muted">
                            {sessao?.terminal_id} • Turno {sessao?.data_turno}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/5 rounded"><X size={18} /></button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1 px-4 py-3 border-b border-border bg-bg-dark">
                {(['resumo', 'declaracao', 'conferencia'] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-1 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                            step === s ? 'bg-primary-blue-light text-white' :
                            (['resumo', 'declaracao', 'conferencia'].indexOf(step) > i) ? 'bg-success text-white' :
                            'bg-surface-subtle text-muted'
                        }`}>
                            {(['resumo', 'declaracao', 'conferencia'].indexOf(step) > i) ? '✓' : i + 1}
                        </div>
                        <span className={`text-[10px] font-bold ${step === s ? 'text-text-primary' : 'text-muted'}`}>
                            {s === 'resumo' ? 'Resumo' : s === 'declaracao' ? 'Declaração' : 'Conferência'}
                        </span>
                        {i < 2 && <ChevronRight size={12} className="text-muted mx-1" />}
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

                {/* STEP 1: Resumo do Sistema */}
                {step === 'resumo' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <p className="text-xs text-muted font-medium">
                            Resumo automático das movimentações registradas durante o turno.
                        </p>

                        {/* Fundo Inicial */}
                        <div className="flex justify-between items-center p-3 rounded-xl bg-surface-subtle border border-border">
                            <span className="text-sm font-medium text-muted">Fundo Inicial</span>
                            <span className="text-sm font-black">R$ {valorInicial.toFixed(2)}</span>
                        </div>

                        {/* Entradas */}
                        <div className="rounded-xl border border-success/20 overflow-hidden">
                            <div className="px-3 py-2 bg-success/10 flex justify-between items-center">
                                <span className="text-xs font-black text-success flex items-center gap-1">
                                    <ArrowUpCircle size={14} /> ENTRADAS
                                </span>
                                <span className="text-sm font-black text-success">
                                    R$ {resumo.total_entradas.toFixed(2)}
                                </span>
                            </div>
                            <div className="p-3 space-y-2">
                                <LinhaResumo icon={<Smartphone size={14} />} label="PIX recebidos" valor={resumo.entradas_pix} />
                                <LinhaResumo icon={<DollarSign size={14} />} label="Dinheiro (jogos/serviços)" valor={resumo.entradas_dinheiro} />
                                <LinhaResumo icon={<Ticket size={14} />} label="Dinheiro (bolões)" valor={resumo.entradas_bolao_dinheiro} />
                                {resumo.entradas_bolao_pix > 0 && (
                                    <LinhaResumo icon={<Ticket size={14} />} label="PIX (bolões)" valor={resumo.entradas_bolao_pix} />
                                )}
                            </div>
                        </div>

                        {/* Saídas */}
                        <div className="rounded-xl border border-danger/20 overflow-hidden">
                            <div className="px-3 py-2 bg-danger/10 flex justify-between items-center">
                                <span className="text-xs font-black text-danger flex items-center gap-1">
                                    <ArrowDownCircle size={14} /> SAÍDAS
                                </span>
                                <span className="text-sm font-black text-danger">
                                    R$ {resumo.total_saidas.toFixed(2)}
                                </span>
                            </div>
                            <div className="p-3 space-y-2">
                                <LinhaResumo icon={<Shield size={14} />} label="Sangrias ao cofre" valor={resumo.saidas_sangria} />
                                <LinhaResumo icon={<FileText size={14} />} label="Boletos pagos" valor={resumo.saidas_boleto} />
                                <LinhaResumo icon={<Building size={14} />} label="Depósitos filial" valor={resumo.saidas_deposito} />
                                {resumo.saidas_trocados > 0 && (
                                    <LinhaResumo icon={<ArrowRightLeft size={14} />} label="Trocados" valor={resumo.saidas_trocados} />
                                )}
                            </div>
                        </div>

                        {/* Saldo esperado em dinheiro (preview) */}
                        <div className="p-3 rounded-xl bg-primary-blue-light/10 border border-primary-blue-light/20">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-primary-blue-light">SALDO ESPERADO EM DINHEIRO</span>
                                <span className="text-lg font-black text-primary-blue-light">
                                    R$ {calcularReconciliacao(valorInicial, resumo, 0).saldo_esperado_dinheiro.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-[10px] text-muted mt-1">
                                Fundo + entradas em dinheiro - saídas (PIX não fica na gaveta)
                            </p>
                        </div>

                        <button className="btn btn-primary w-full h-12" onClick={() => setStep('declaracao')}>
                            Próximo: Informar Valores <ChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* STEP 2: Declaração do Operador */}
                {step === 'declaracao' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <p className="text-xs text-muted font-medium">
                            Informe os valores reais do seu caixa.
                        </p>

                        {/* Dinheiro em mãos */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-muted uppercase">
                                    Quanto dinheiro você tem agora?
                                </label>
                                <button
                                    onClick={() => setShowCalculadora(true)}
                                    className="text-[10px] font-bold text-primary-blue-light hover:underline flex items-center gap-1"
                                >
                                    <Calculator size={12} /> Contar notas
                                </button>
                            </div>
                            <MoneyInput
                                value={dinheiroEmMaos}
                                onValueChange={setDinheiroEmMaos}
                                className="text-xl font-black h-14"
                                placeholder="0,00"
                                autoFocus
                            />
                        </div>

                        {/* Valor enviado ao cofre */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted uppercase">
                                Quanto vai enviar ao cofre?
                            </label>
                            <MoneyInput
                                value={valorEnviadoCofre}
                                onValueChange={setValorEnviadoCofre}
                                className="text-lg font-bold h-12"
                                placeholder="0,00"
                            />
                            {valorEnviadoCofre > dinheiroEmMaos && (
                                <p className="text-xs text-danger font-bold">
                                    ⚠️ Não pode enviar mais do que tem em mãos
                                </p>
                            )}
                        </div>

                        {/* Fundo de caixa */}
                        <div className="p-3 rounded-xl bg-surface-subtle border border-border">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={fundoCaixaDevolvido}
                                    onChange={(e) => setFundoCaixaDevolvido(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded"
                                />
                                <div>
                                    <p className="text-sm font-bold">
                                        Devolvi o fundo de R$ {valorInicial.toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-muted mt-0.5">
                                        O fundo está incluso no valor "dinheiro em mãos" acima
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* PIX externo */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted uppercase">
                                PIX de jogos externos (opcional)
                            </label>
                            <MoneyInput
                                value={pixExternoInformado}
                                onValueChange={setPixExternoInformado}
                                className="h-10"
                                placeholder="0,00"
                            />
                            <p className="text-[10px] text-muted">
                                PIX recebidos fora do sistema TFL (jogos avulsos, etc.)
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button className="btn btn-ghost flex-1 h-12" onClick={() => setStep('resumo')}>
                                <ChevronLeft size={16} /> Voltar
                            </button>
                            <button
                                className="btn btn-primary flex-[2] h-12"
                                onClick={() => setStep('conferencia')}
                                disabled={dinheiroEmMaos <= 0}
                            >
                                Próximo: Conferência <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Conferência e Envio */}
                {step === 'conferencia' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* Resultado da reconciliação */}
                        <div className={`p-4 rounded-xl border-2 text-center ${
                            reconciliacao.status === 'batido' ? 'bg-success/10 border-success/30' :
                            reconciliacao.status === 'sobra' ? 'bg-warning/10 border-warning/30' :
                            'bg-danger/10 border-danger/30'
                        }`}>
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted mb-1">
                                Conferência Automática
                            </p>
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <div className="text-center">
                                    <p className="text-[10px] text-muted">Esperado</p>
                                    <p className="text-lg font-black">R$ {reconciliacao.saldo_esperado_dinheiro.toFixed(2)}</p>
                                </div>
                                <span className="text-muted">vs</span>
                                <div className="text-center">
                                    <p className="text-[10px] text-muted">Declarado</p>
                                    <p className="text-lg font-black">R$ {dinheiroEmMaos.toFixed(2)}</p>
                                </div>
                            </div>
                            <p className="text-2xl font-black" style={{ color: statusInfo.cor }}>
                                {reconciliacao.diferenca >= 0 ? '+' : ''}R$ {reconciliacao.diferenca.toFixed(2)}
                            </p>
                            <p className="text-xs font-black mt-1" style={{ color: statusInfo.cor }}>
                                {statusInfo.label}
                            </p>
                        </div>

                        {/* Destino do dinheiro */}
                        <div className="rounded-xl border border-border overflow-hidden">
                            <div className="px-3 py-2 bg-surface-subtle">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                                    Destino do Dinheiro
                                </span>
                            </div>
                            <div className="p-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted">Enviado ao cofre</span>
                                    <span className="font-bold">R$ {valorEnviadoCofre.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted">Fundo devolvido</span>
                                    <span className="font-bold">
                                        {fundoCaixaDevolvido ? `R$ ${valorInicial.toFixed(2)} ✅` : 'Não ⚠️'}
                                    </span>
                                </div>
                                {pixExternoInformado > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted">PIX externo</span>
                                        <span className="font-bold">R$ {pixExternoInformado.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Justificativa (obrigatória se diferença) */}
                        {Math.abs(reconciliacao.diferenca) >= 0.01 && (
                            <div className="space-y-2 animate-in slide-in-from-top-2">
                                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 flex gap-2">
                                    <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                                    <p className="text-xs text-warning">
                                        Há diferença de R$ {Math.abs(reconciliacao.diferenca).toFixed(2)} no caixa.
                                        Justificativa obrigatória.
                                    </p>
                                </div>
                                <textarea
                                    className="input w-full"
                                    rows={3}
                                    value={justificativa}
                                    onChange={(e) => setJustificativa(e.target.value)}
                                    placeholder="Explique o motivo da diferença..."
                                />
                            </div>
                        )}

                        {/* Observações gerais */}
                        {Math.abs(reconciliacao.diferenca) < 0.01 && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted uppercase">
                                    Observações (opcional)
                                </label>
                                <textarea
                                    className="input w-full"
                                    rows={2}
                                    value={justificativa}
                                    onChange={(e) => setJustificativa(e.target.value)}
                                    placeholder="Alguma observação sobre o turno?"
                                />
                            </div>
                        )}

                        {erroValidacao && (
                            <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex gap-2">
                                <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
                                <p className="text-xs text-danger font-bold">{erroValidacao}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button className="btn btn-ghost flex-1 h-12" onClick={() => setStep('declaracao')} disabled={isProcessing}>
                                <ChevronLeft size={16} /> Voltar
                            </button>
                            <button
                                className="btn btn-primary flex-[2] h-12 font-black"
                                onClick={handleConfirm}
                                disabled={isProcessing || !!erroValidacao}
                            >
                                {isProcessing ? (
                                    <><Loader2 className="animate-spin" size={16} /> Processando...</>
                                ) : (
                                    'ENCERRAR TURNO'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Calculadora de Numerário */}
            {showCalculadora && (
                <CalculadoraNumerario
                    onClose={() => setShowCalculadora(false)}
                    onApply={(total) => {
                        setDinheiroEmMaos(total);
                        setShowCalculadora(false);
                    }}
                    valorAtual={dinheiroEmMaos}
                />
            )}
        </Overlay>
    );
}

// Componentes auxiliares

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]">
                {children}
            </div>
        </>
    );
}

function LinhaResumo({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: number }) {
    if (valor === 0) return null;
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted">
                {icon} {label}
            </span>
            <span className="font-bold">R$ {valor.toFixed(2)}</span>
        </div>
    );
}
