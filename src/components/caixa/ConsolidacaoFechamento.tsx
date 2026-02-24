'use client';

import {
    Calculator,
    ChevronRight,
    Coins,
    DollarSign,
    FileText,
    PieChart,
    ShieldCheck,
    Smartphone,
    Ticket,
    Wallet
} from 'lucide-react';
import { useGestorCaixa } from '@/hooks/useGestorCaixa';
import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';

export function ConsolidacaoFechamento() {
    const { stats } = useGestorCaixa();

    // TODO: Implementar com dados reais
    const saldoFisicoMaster = 0;
    const saldosOperadores: any[] = [];
    const finalizarJornadaConsolidada = async (_: any) => { };

    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const { toast } = useToast();
    const confirm = useConfirm();

    // Cálculo mock - será substituído por dados reais
    const totalDividaOperadoresBolao = saldosOperadores.reduce((acc, curr) => acc + curr.saldo_especie_divida, 0);
    const totalDigitalBolao = saldosOperadores.reduce((acc, curr) => acc + curr.saldo_digital, 0);

    const saldoTotalBoloes = saldoFisicoMaster + totalDividaOperadoresBolao;
    const pesoTFL = stats.saldoConsolidado;
    const pesoBolao = saldoTotalBoloes + totalDigitalBolao;

    const totalGeralEmpresa = pesoTFL + pesoBolao;

    const handleFinalReconciliation = async () => {
        const confirmed = await confirm({
            title: 'Batimento Final Consolidado',
            description: `Deseja realizar o Batimento Final Consolidado no valor de R$ ${totalGeralEmpresa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}? \n\nIsto irá zerar os saldos operacionais e encerrar a jornada de hoje.`,
            variant: 'neutral',
            confirmLabel: 'Confirmar Batimento'
        });

        if (confirmed) {
            setIsFinalizing(true);
            try {
                await finalizarJornadaConsolidada({
                    totalGeral: totalGeralEmpresa,
                    pesoTFL,
                    pesoBolao,
                    timestamp: new Date().toISOString()
                });
                setIsDone(true);
                toast({ message: 'Jornada encerrada com sucesso!', type: 'success' });
            } catch (error) {
                toast({ message: "Erro ao processar fechamento.", type: 'error' });
            } finally {
                setIsFinalizing(false);
            }
        }
    };

    return (
        <div className="card-premium p-8 bg-bg-card border border-border relative overflow-hidden group">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                <Calculator size={160} />
            </div>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-black text-text-primary flex items-center gap-2">
                        <PieChart className="text-primary" size={24} />
                        Batimento Global de Caixa
                    </h3>
                    <p className="text-xs text-muted font-bold tracking-wider uppercase mt-1">Visão Consolidada: TFL + Bolão Centralizado</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-surface-subtle border border-border flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-muted uppercase">Total no Cofre (Hoje)</span>
                        <span className="text-lg font-black text-emerald-500">R$ {totalGeralEmpresa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                {/* Coluna TFL */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                            <Smartphone size={18} />
                        </div>
                        <h4 className="font-bold text-sm text-text-primary">Operação TFL (Terminais)</h4>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted">Total Digital (Pix/Card)</span>
                        <span className="font-bold text-text-primary">R$ {stats.saldoDigital.toLocaleString('pt-BR')}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted">Espécie em Terminais</span>
                        <span className="font-bold text-text-primary">R$ {stats.saldoFisico.toLocaleString('pt-BR')}</span>
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-border group/row">
                        <span className="text-xs font-black text-muted uppercase">Peso TFL</span>
                        <span className="text-md font-black text-blue-500">R$ {pesoTFL.toLocaleString('pt-BR')}</span>
                    </div>
                </div>

                {/* Coluna Bolão */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                            <Ticket size={18} />
                        </div>
                        <h4 className="font-bold text-sm text-text-primary">Operação Bolão (Central)</h4>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted">Arrecadado (Master/Cofre)</span>
                        <span className="font-bold text-text-primary">R$ {saldoFisicoMaster.toLocaleString('pt-BR')}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted">Repasse Pendente (Ops)</span>
                        <span className="font-bold text-orange-500">R$ {totalDividaOperadoresBolao.toLocaleString('pt-BR')}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted">Digital Bolão (Pix)</span>
                        <span className="font-bold text-emerald-500">R$ {totalDigitalBolao.toLocaleString('pt-BR')}</span>
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-border">
                        <span className="text-xs font-black text-muted uppercase">Peso Bolão</span>
                        <span className="text-md font-black text-indigo-500">R$ {pesoBolao.toLocaleString('pt-BR')}</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs text-muted font-bold">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 -[0_0_8px_rgba(16,185,129,0.5)]" />
                        PRONTO PARA FECHAMENTO
                    </div>
                    <span>|</span>
                    <div className="flex items-center gap-2">
                        <FileText size={14} />
                        Gerar PDF de Auditoria
                    </div>
                </div>

                <button
                    onClick={handleFinalReconciliation}
                    disabled={isFinalizing || isDone || totalGeralEmpresa === 0}
                    className={`btn w-full md:w-auto px-8 font-black uppercase tracking-widest text-xs flex items-center gap-2  transition-all hover:scale-105 active:scale-95 ${isDone ? 'btn-success bg-emerald-500 border-emerald-500 text-white cursor-default scale-100! -emerald-500/20' :
                        'btn-primary -primary/20'
                        }`}
                >
                    {isFinalizing ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            PROCESSANDO...
                        </>
                    ) : isDone ? (
                        <>
                            <Check size={16} />
                            JORNADA ENCERRADA
                        </>
                    ) : (
                        <>
                            Realizar Batimento Final
                            <ChevronRight size={16} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

