'use client';

import { useEffect, useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Scale,
    FileUp,
    CheckCircle2,
    Search,
    Filter,
    Download
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { getTransacoesBancarias, conciliarTransacao } from '@/actions/financeiro';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';

export default function ConciliacaoBancariaPage() {
    const [loading, setLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [transacoes, setTransacoes] = useState<any[]>([]);
    const { toast } = useToast();
    const confirm = useConfirm();
    const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
    const [filtroTipo, setFiltroTipo] = useState('todos');

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getTransacoesBancarias();
            setTransacoes(data);
        } catch (err) {
            console.error('Erro ao carregar transações:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleConciliar = async (id: number) => {
        const confirmed = await confirm({
            title: 'Confirmar Conciliação',
            description: 'Deseja marcar esta transação como conciliada (confirmada no banco)?',
            variant: 'neutral',
            confirmLabel: 'Confirmar'
        });
        if (!confirmed) return;

        try {
            const res = await conciliarTransacao(id);
            if (res.success) {
                toast({ message: 'Transação conciliada com sucesso!', type: 'success' });
                loadData();
            } else {
                toast({ message: 'Erro ao conciliar: ' + res.error, type: 'error' });
            }
        } catch (err: any) {
            console.error(err);
            toast({ message: 'Erro inesperado ao conciliar.', type: 'error' });
        }
    };

    const movFiltradas = transacoes.filter(m => {
        const matchTipo = filtroTipo === 'todos' || m.tipo === (filtroTipo === 'deposito' ? 'entrada' : 'saida');
        // Adicionar filtro de data se necessário aqui
        return matchTipo;
    });

    const entradas = movFiltradas.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + Number(m.valor), 0);
    const saidas = movFiltradas.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + Number(m.valor), 0);
    const saldo = entradas - saidas;

    if (loading) return <LoadingState type="list" />;

    return (
        <div className="dashboard-content">
            <PageHeader
                title="Conciliação Bancária"
            >
                <div className="flex gap-2">
                    <button className="btn btn-accent" onClick={() => toast({ message: 'Em breve: Importação de arquivos OFX', type: 'info' })} disabled={isImporting}>
                        <FileUp size={16} /> Importar OFX
                    </button>
                    <button className="btn btn-ghost" onClick={() => window.print()}><Download size={16} /> Relatório</button>
                </div>
            </PageHeader>

            <div className="card mb-6 p-4">
                <div className="flex items-center gap-4 overflow-x-auto">
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-muted" />
                        <span className="text-sm font-bold">Filtros:</span>
                    </div>
                    <input type="date" className="input" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
                    <select className="input" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                        <option value="todos">Todos Fluxos</option>
                        <option value="deposito">Entradas (PIX/Depósitos)</option>
                        <option value="saque">Saídas (Pagamentos)</option>
                    </select>
                </div>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card success">
                    <div className="kpi-header">
                        <span className="kpi-label">Entradas Digitais</span>
                        <div className="kpi-icon"><TrendingUp size={20} /></div>
                    </div>
                    <div className="kpi-value text-success">R$ {entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="kpi-card danger">
                    <div className="kpi-header">
                        <span className="kpi-label">Saídas/Pagamentos</span>
                        <div className="kpi-icon"><TrendingDown size={20} /></div>
                    </div>
                    <div className="kpi-value text-danger">R$ {saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="kpi-card primary">
                    <div className="kpi-header">
                        <span className="kpi-label">Saldo Bancário (MegaB)</span>
                        <div className="kpi-icon"><Scale size={20} /></div>
                    </div>
                    <div className="kpi-value">R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div className="card mt-8">
                <h3 className="chart-title">Extrato de Transações Digitais</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Conta / Banco</th>
                                <th>Item</th>
                                <th>Valor</th>
                                <th>Status Conciliação</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movFiltradas.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-muted">Nenhuma transação bancária encontrada.</td>
                                </tr>
                            )}
                            {movFiltradas.map(m => {
                                const isEntrada = m.tipo === 'entrada';
                                return (
                                    <tr key={m.id} className="hover:bg-white/2 transition-colors">
                                        <td className="text-muted text-xs">
                                            {new Date(m.data_transacao).toLocaleString('pt-BR')}
                                        </td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs">{m.financeiro_contas_bancarias?.nome || 'Conta Interna'}</span>
                                                <span className="text-[0.6rem] text-muted">{m.financeiro_contas_bancarias?.financeiro_bancos?.nome}</span>
                                            </div>
                                        </td>
                                        <td><span className="badge text-[0.6rem]">{m.item}</span></td>
                                        <td className={`font-black ${isEntrada ? 'text-success' : 'text-danger'} text-sm`}>
                                            {isEntrada ? '+' : '-'} R$ {Number(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td>
                                            {m.status_conciliacao === 'conciliado' ? (
                                                <div className="text-success flex items-center gap-1 text-[0.65rem] font-bold"><CheckCircle2 size={12} /> CONCILIADO</div>
                                            ) : (
                                                <div className="text-warning flex items-center gap-1 text-[0.65rem] font-bold"><Search size={12} /> PENDENTE</div>
                                            )}
                                        </td>
                                        <td>
                                            {m.status_conciliacao === 'pendente' && (
                                                <button
                                                    className="btn btn-ghost text-[0.6rem] py-1! px-2! font-black"
                                                    onClick={() => handleConciliar(m.id)}
                                                >
                                                    Conciliar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
