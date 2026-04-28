'use client';

import { useState, useEffect } from 'react';
import { getPrestacaoContasOperadores, liquidarOperador, getResumoCaixaMaster } from '@/actions/boloes';
import { usePerfil } from '@/hooks/usePerfil';
import { useLoja } from '@/contexts/LojaContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { ShieldCheck, Banknote, Smartphone, CreditCard, ArrowRightLeft, AlertTriangle, Search, RefreshCw, Wallet } from 'lucide-react';

export function OperatorSettlementTab() {
    const { isGerente, isAdmin, loading: perfilLoading } = usePerfil();  // ← use 'loading' ao invés de 'isLoading'
    const { lojaAtual } = useLoja();
    const { toast } = useToast();
    const confirm = useConfirm();

    const [contaOperadores, setContaOperadores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [liquidatingId, setLiquidatingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [resumoMaster, setResumoMaster] = useState({ totalColetado: 0, qtdLiquidacoes: 0 });

    // Se não tiver permissão, não carrega dados
    if (!perfilLoading && !isGerente && !isAdmin) {
        return (
            <div className="p-8 text-center text-muted">
                <ShieldCheck size={48} className="mx-auto mb-4 opacity-20" />
                <p>Você não tem permissão para acessar esta área.</p>
            </div>
        );
    }

    const loadData = async () => {
        setLoading(true);
        try {
            const [dataOperadores, dataMaster] = await Promise.all([
                getPrestacaoContasOperadores(lojaAtual?.id),
                getResumoCaixaMaster()
            ]);
            setContaOperadores(dataOperadores);
            setResumoMaster(dataMaster);
        } catch (error) {
            console.error('Erro ao carregar prestação de contas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLiquidar = async (operadorId: string, valorEspecie: number, valorPix: number) => {
        const confirmed = await confirm({
            title: 'Liquidar Contas',
            description: `Confirmar acerto de R$ ${(valorEspecie + valorPix).toLocaleString('pt-BR')}?`,
            variant: 'neutral',
            confirmLabel: 'Confirmar Acerto'
        });
        if (!confirmed) return;

        setLiquidatingId(operadorId);
        try {
            const result = await liquidarOperador(operadorId, valorEspecie, valorPix);
            if (result.success) {
                toast({ message: 'Acerto realizado com sucesso!', type: 'success' });
                loadData();
            } else {
                toast({ message: 'Erro ao realizar acerto: ' + result.error, type: 'error' });
            }
        } catch (error) {
            toast({ message: 'Ocorreu um erro no servidor.', type: 'error' });
        } finally {
            setLiquidatingId(null);
        }
    };

    useEffect(() => {
        if (isGerente || isAdmin) loadData();
    }, [lojaAtual, isGerente, isAdmin]);

    const filtered = contaOperadores.filter(o =>
        o.operadorNome?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totaisDia = contaOperadores.reduce((acc, curr) => ({
        especie: acc.especie + curr.totalEspecie,
        pix: acc.pix + curr.totalPix,
        geral: acc.geral + curr.totalGeral
    }), { especie: 0, pix: 0, geral: 0 });

    if (loading) {
        return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="animate-in fade-in duration-500">
            {/* Dashboard Master */}
            <div className="mb-8 card-premium p-6 bg-linear-to-br from-indigo-500/10 to-transparent border-indigo-500/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted tracking-widest mb-1">Meu Caixa Físico (Master)</p>
                            <h3 className="text-3xl font-black text-indigo-400">
                                R$ {resumoMaster.totalColetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                            <p className="text-xs text-muted mt-1">{resumoMaster.qtdLiquidacoes} liquidação(ões) confirmada(s) hoje</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="badge badge-success flex items-center gap-1 text-[10px] py-1.5 px-3">
                            <Wallet size={12} /> Dinheiro Coletado
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="card-premium p-6 flex items-center gap-4 bg-success/5 border-success/10">
                    <Banknote size={24} className="text-success" />
                    <div>
                        <p className="text-[10px] text-muted uppercase font-black tracking-widest">Total em Espécie</p>
                        <h3 className="text-2xl font-black">R$ {totaisDia.especie.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                </div>
                <div className="card-premium p-6 flex items-center gap-4 bg-accent/5 border-accent/10">
                    <Smartphone size={24} className="text-accent" />
                    <div>
                        <p className="text-[10px] text-muted uppercase font-black tracking-widest">Total em PIX</p>
                        <h3 className="text-2xl font-black">R$ {totaisDia.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                </div>
                <div className="card-premium p-6 flex items-center gap-4 bg-primary/5 border-primary/10">
                    <ArrowRightLeft size={24} className="text-primary" />
                    <div>
                        <p className="text-[10px] text-muted uppercase font-black tracking-widest">Acerto Geral Hoje</p>
                        <h3 className="text-2xl font-black">R$ {totaisDia.geral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input type="text" placeholder="Buscar operador..." className="input pl-10 h-[46px] w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button onClick={loadData} className="btn btn-ghost h-[46px] px-6"><RefreshCw size={18} /> Atualizar</button>
            </div>

            {/* Tabela */}
            <div className="card-premium overflow-hidden">
                <div className="table-container">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-4 px-6">Operador</th>
                                <th className="text-right py-4 px-6">Espécie</th>
                                <th className="text-right py-4 px-6">PIX</th>
                                <th className="text-right py-4 px-6">Cartão</th>
                                <th className="text-right py-4 px-6 font-black">Total</th>
                                <th className="text-center py-4 px-6">Status</th>
                                <th className="text-center py-4 px-6">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map(op => (
                                <tr key={op.operadorId}>
                                    <td className="py-4 px-6 font-bold">{op.operadorNome}</td>
                                    <td className="py-4 px-6 text-right text-success font-bold">R$ {op.totalEspecie.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-4 px-6 text-right text-accent font-bold">R$ {op.totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-4 px-6 text-right text-muted">R$ {op.totalCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-4 px-6 text-right font-black">R$ {op.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-4 px-6 text-center">
                                        {op.totalGeral > 0 ? (
                                            <span className="badge badge-warning flex items-center gap-1 text-[10px] py-1 px-3"><AlertTriangle size={10} /> Pendente</span>
                                        ) : (
                                            <span className="badge badge-success flex items-center gap-1 text-[10px] py-1 px-3"><ShieldCheck size={10} /> Liquidado</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <button
                                            onClick={() => handleLiquidar(op.operadorId, op.totalEspecie, op.totalPix)}
                                            disabled={op.totalGeral === 0 || liquidatingId === op.operadorId}
                                            className="btn btn-primary btn-sm h-8 px-4 text-[10px] font-black uppercase disabled:opacity-30"
                                        >
                                            {liquidatingId === op.operadorId ? 'Processando...' : 'Liquidar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
