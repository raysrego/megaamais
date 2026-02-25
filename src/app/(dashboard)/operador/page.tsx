'use client';

import { useState, useEffect } from 'react';
import {
    DollarSign,
    Ticket,
    Wallet,
    TrendingUp,
    Filter,
    Calendar,
    Building2,
    Trophy,
    Target,
    ChevronRight,
    Search,
    Users,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePerfil } from '@/hooks/usePerfil';
import { getPerformanceOperador, getPerformanceEquipe, getUltimasVendasOperador, PerformanceOperador, HistoricoVenda } from '@/actions/operador';
import { useLoja } from '@/contexts/LojaContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { SessionStatusBadge } from '@/components/layout/SessionStatusBadge';
import { useMovimentacoesOperador } from '@/hooks/useMovimentacoesOperador';

export default function PainelOperadorPage() {
    const { isAdmin, isGerente } = usePerfil();
    const { lojasDisponiveis } = useLoja();
    const canManageTeam = isAdmin || isGerente;

    const [activeTab, setActiveTab] = useState<'meu_desempenho' | 'movimentacoes' | 'equipe'>('meu_desempenho');

    // Estados de Dados
    const [performancePessoal, setPerformancePessoal] = useState<PerformanceOperador | null>(null);
    const [historicoVendas, setHistoricoVendas] = useState<HistoricoVenda[]>([]);
    const [equipe, setEquipe] = useState<PerformanceOperador[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros de Equipe
    const [filtroFilial, setFiltroFilial] = useState('');

    // Filtro Histórico (Operador)
    const [dataFiltroVendas, setDataFiltroVendas] = useState<string>('');
    const [dataFiltroMovimentacoes, setDataFiltroMovimentacoes] = useState<string>('');

    useEffect(() => {
        loadData();
    }, [activeTab, filtroFilial, dataFiltroVendas]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'meu_desempenho') {
                // Carrega em paralelo para ser rápido
                const [perfData, histData] = await Promise.all([
                    getPerformanceOperador(),
                    getUltimasVendasOperador(20, dataFiltroVendas) // Passa o filtro de data
                ]);
                setPerformancePessoal(perfData);
                setHistoricoVendas(histData);
            } else if (activeTab === 'equipe' && canManageTeam) {
                const data = await getPerformanceEquipe(filtroFilial);
                setEquipe(data);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-content space-y-6">
            <PageHeader
                title="Hub de Performance"
                description="Acompanhe suas metas, comissões e resultados em tempo real"
            >
                <div className="min-w-[180px]">
                    <SessionStatusBadge collapsed={false} />
                </div>
            </PageHeader>

            {/* Navegação de Abas */}
            <div className="flex gap-2 border-b border-white/5 pb-4 mb-6">
                <button
                    onClick={() => setActiveTab('meu_desempenho')}
                    className={`btn ${activeTab === 'meu_desempenho' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold transition-all rounded-xl`}
                >
                    <Trophy size={16} /> Meu Desempenho
                </button>
                <button
                    onClick={() => setActiveTab('movimentacoes')}
                    className={`btn ${activeTab === 'movimentacoes' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold transition-all rounded-xl`}
                >
                    <Wallet size={16} /> Minhas Movimentações
                </button>
                {canManageTeam && (
                    <button
                        onClick={() => setActiveTab('equipe')}
                        className={`btn ${activeTab === 'equipe' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold transition-all rounded-xl`}
                    >
                        <Users size={16} /> Gestão de Equipe
                    </button>
                )}
            </div>

            {loading ? (
                <LoadingState type="dashboard" />
            ) : activeTab === 'meu_desempenho' ? (
                <TabMeuDesempenho
                    data={performancePessoal}
                    historico={historicoVendas}
                    dataFiltro={dataFiltroVendas}
                    onFiltroChange={setDataFiltroVendas}
                />
            ) : activeTab === 'movimentacoes' ? (
                <TabMovimentacoes
                    dataFiltro={dataFiltroMovimentacoes}
                    onFiltroChange={setDataFiltroMovimentacoes}
                />
            ) : (
                <TabGestaoEquipe
                    equipe={equipe}
                    filtroFilial={filtroFilial}
                    setFiltroFilial={setFiltroFilial}
                    lojas={lojasDisponiveis}
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// ABA: MEU DESEMPENHO (OPERADOR)
// ----------------------------------------------------------------------
interface TabMeuDesempenhoProps {
    data: PerformanceOperador | null;
    historico: HistoricoVenda[];
    dataFiltro: string;
    onFiltroChange: (date: string) => void;
}

function TabMeuDesempenho({ data, historico, dataFiltro, onFiltroChange }: TabMeuDesempenhoProps) {
    // Dados mockados vazios para Empty State visual
    const emptyData: PerformanceOperador = {
        operadorId: '',
        operadorNome: '',
        lojaId: '',
        filialNome: '',
        qtdVendas: 0,
        totalVendasBruto: 0,
        comissaoTotalGerada: 0,
        parteCasa70: 0,
        partePool30: 0,
        tierAtingido: 0,
        premioAReceber: 0,
        proximaMetaValor: 10000,
        faltaParaProximaMeta: 10000
    };

    const displayData = data || emptyData;

    const progresso = displayData.proximaMetaValor
        ? (displayData.totalVendasBruto / displayData.proximaMetaValor) * 100
        : 100;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    label="Vendas (Mês)"
                    value={`R$ ${displayData.totalVendasBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    trend={{ value: 'Acumulado', direction: 'neutral' }}
                    variant="default"
                />
                <KPICard
                    label="Cotas Vendidas"
                    value={displayData.qtdVendas.toString()}
                    icon={Ticket}
                    trend={{ value: 'Quantidade', direction: 'neutral' }}
                />
                <KPICard
                    label="Prêmio Conquistado"
                    value={`R$ ${displayData.premioAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={Trophy}
                    variant="success"
                    trend={{ value: `Tier ${displayData.tierAtingido}`, direction: 'up' }}
                />
                <KPICard
                    label="Bônus Potencial"
                    value={`R$ ${displayData.partePool30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={Wallet}
                    variant="accent"
                    trend={{ value: 'Fundão 30%', direction: 'neutral' }}
                />
            </div>

            {/* GAMIFICAÇÃO: BARRA DE PROGRESSO */}
            <div className="card bg-linear-to-r from-bg-card to-primary-blue/5 border-primary-blue/20 p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 z-10 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary-blue/20 flex items-center justify-center text-primary-blue-light shadow-lg shadow-primary-blue/10">
                            <Target size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tighter text-white">Sua Jornada de Prêmios</h3>
                            <p className="text-sm text-muted font-medium">
                                {displayData.proximaMetaValor
                                    ? `Faltam R$ ${displayData.faltaParaProximaMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para o próximo nível!`
                                    : "Parabéns! Você é um Operador de Elite (Top Tier)."}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase text-muted mb-1">Próximo Prêmio</div>
                        <div className="text-2xl font-black text-primary-blue-light">
                            {displayData.proximaMetaValor
                                ? "R$ " + (getPremioProximoTier(displayData.tierAtingido)).toLocaleString('pt-BR')
                                : "MÁXIMO"}
                        </div>
                    </div>
                </div>

                {/* Barra de Progresso */}
                <div className="relative mt-2 mb-4">
                    <div className="h-6 w-full bg-surface-subtle rounded-full overflow-hidden border border-border shadow-inner">
                        <div
                            className="h-full bg-linear-to-r from-primary-blue to-primary-blue-light transition-all duration-1000 ease-out relative"
                            style={{ width: `${Math.min(progresso, 100)}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-muted uppercase tracking-wider">
                    <span>Início (R$ 0)</span>
                    <span>
                        {displayData.proximaMetaValor
                            ? `Meta: R$ ${displayData.proximaMetaValor.toLocaleString('pt-BR')}`
                            : "Meta Máxima Atingida"}
                    </span>
                </div>
            </div>

            {/* HISTÓRICO DE VENDAS */}
            <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-muted">
                            <Ticket size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Minhas Vendas Recentes</h3>
                            <p className="text-xs text-muted">
                                {dataFiltro
                                    ? `Exibindo vendas do dia ${new Date(dataFiltro + 'T12:00:00').toLocaleDateString('pt-BR')}`
                                    : "Exibindo últimas movimentações"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted uppercase">Filtrar Data:</span>
                        <input
                            type="date"
                            className="input py-1 px-3 text-xs font-bold bg-bg-dark border-border rounded-lg"
                            value={dataFiltro}
                            onChange={(e) => onFiltroChange(e.target.value)}
                        />
                        {dataFiltro && (
                            <button
                                onClick={() => onFiltroChange('')}
                                className="text-xs text-primary-blue hover:underline"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-subtle text-muted text-[10px] uppercase font-bold tracking-wider border-b border-white/5">
                            <tr>
                                <th className="p-3">Data/Hora</th>
                                <th className="p-3">Bolão</th>
                                <th className="p-3">Conc.</th>
                                <th className="p-3 text-right">Valor Venda</th>
                                <th className="p-3 text-right">Contrib. Bônus (30%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {historico.map((venda) => (
                                <tr key={venda.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-muted text-xs">
                                        {new Date(venda.dataHora).toLocaleDateString('pt-BR')} <span className="opacity-50 text-[10px]">{new Date(venda.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </td>
                                    <td className="p-3 font-medium text-text-secondary">{venda.bolao}</td>
                                    <td className="p-3 text-xs text-muted">{venda.concurso}</td>
                                    <td className="p-3 text-right font-mono font-bold">
                                        R$ {venda.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right font-mono text-accent text-xs">
                                        + R$ {venda.comissaoGerada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {historico.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-muted">
                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                            <Ticket size={32} />
                                            <p>Nenhuma venda registrada recentemente.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function getPremioProximoTier(currentTier: number) {
    // 0 -> 600, 1 -> 700, 2 -> 800, 3 -> 1000
    if (currentTier === 0) return 600;
    if (currentTier === 1) return 700;
    if (currentTier === 2) return 800;
    return 1000;
}

// ----------------------------------------------------------------------
// ABA: MINHAS MOVIMENTAÇÕES (OPERADOR)
// ----------------------------------------------------------------------
interface TabMovimentacoesProps {
    dataFiltro: string;
    onFiltroChange: (date: string) => void;
}

function TabMovimentacoes({ dataFiltro, onFiltroChange }: TabMovimentacoesProps) {
    const { movimentacoes, loading, error } = useMovimentacoesOperador(dataFiltro);

    if (error) {
        return (
            <div className="card p-8 text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                <p className="text-muted">{error}</p>
            </div>
        );
    }

    if (loading) {
        return <LoadingState type="list" />;
    }

    const totalEntradas = movimentacoes
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + Number(m.valor), 0);

    const totalSaidas = movimentacoes
        .filter(m => m.tipo === 'saida')
        .reduce((sum, m) => sum + Number(m.valor), 0);

    const saldo = totalEntradas - totalSaidas;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPIs de Movimentação */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard
                    label="Total Entradas"
                    value={`R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={TrendingUp}
                    variant="success"
                    trend={{ value: 'Acumulado', direction: 'neutral' }}
                />
                <KPICard
                    label="Total Saídas"
                    value={`R$ ${totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    variant="danger"
                    trend={{ value: 'Acumulado', direction: 'neutral' }}
                />
                <KPICard
                    label="Saldo Líquido"
                    value={`R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={Wallet}
                    variant={saldo >= 0 ? 'success' : 'danger'}
                    trend={{ value: dataFiltro ? 'Do dia' : 'Geral', direction: 'neutral' }}
                />
            </div>

            {/* Tabela de Movimentações */}
            <div className="card overflow-hidden">
                <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-muted">
                            <Wallet size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Histórico de Movimentações</h3>
                            <p className="text-xs text-muted">
                                {dataFiltro
                                    ? `Movimentações do dia ${new Date(dataFiltro + 'T12:00:00').toLocaleDateString('pt-BR')}`
                                    : "Exibindo últimas movimentações"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted uppercase">Filtrar Data:</span>
                        <input
                            type="date"
                            className="input py-1 px-3 text-xs font-bold bg-bg-dark border-border rounded-lg"
                            value={dataFiltro}
                            onChange={(e) => onFiltroChange(e.target.value)}
                        />
                        {dataFiltro && (
                            <button
                                onClick={() => onFiltroChange('')}
                                className="text-xs text-primary-blue hover:underline"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-subtle text-muted text-[10px] uppercase font-bold tracking-wider border-b border-white/5">
                            <tr>
                                <th className="p-3">Data/Hora</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Categoria</th>
                                <th className="p-3">Descrição</th>
                                <th className="p-3">Loja</th>
                                <th className="p-3">Sessão</th>
                                <th className="p-3 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {movimentacoes.map((mov) => (
                                <tr key={mov.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-muted text-xs">
                                        {new Date(mov.created_at).toLocaleDateString('pt-BR')} <span className="opacity-50 text-[10px]">{new Date(mov.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </td>
                                    <td className="p-3">
                                        {mov.tipo === 'entrada' ? (
                                            <span className="badge success text-[10px]">ENTRADA</span>
                                        ) : (
                                            <span className="badge danger text-[10px]">SAÍDA</span>
                                        )}
                                    </td>
                                    <td className="p-3 font-medium text-text-secondary text-xs">{mov.categoria}</td>
                                    <td className="p-3 text-muted text-xs">{mov.descricao || '-'}</td>
                                    <td className="p-3 text-muted text-xs">{mov.loja_nome}</td>
                                    <td className="p-3 text-muted text-xs">#{mov.sessao_numero}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${mov.tipo === 'entrada' ? 'text-success' : 'text-red-400'}`}>
                                        {mov.tipo === 'entrada' ? '+' : '-'} R$ {Number(mov.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {movimentacoes.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted">
                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                            <Wallet size={32} />
                                            <p>Nenhuma movimentação registrada.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// ABA: GESTÃO DE EQUIPE (ADMIN/GERENTE)
// ----------------------------------------------------------------------
function TabGestaoEquipe({ equipe, filtroFilial, setFiltroFilial, lojas, isAdmin }: any) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            {/* Filtros */}
            <div className="card bg-surface-subtle border-border p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-muted">
                    <Filter size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
                </div>

                {isAdmin && (
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-muted" />
                        <select
                            className="input py-1 text-xs font-bold bg-bg-dark border-border"
                            value={filtroFilial}
                            onChange={(e) => setFiltroFilial(e.target.value)}
                        >
                            <option value="">Todas as Filiais</option>
                            {lojas.map((l: any) => (
                                <option key={l.id} value={l.id}>{l.nome_fantasia}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Tabela de Equipe */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-subtle text-muted text-xs uppercase font-extrabold tracking-wider border-b border-white/5">
                            <tr>
                                <th className="p-4">Operador</th>
                                <th className="p-4">Filial</th>
                                <th className="p-4 text-right">Vendas (R$)</th>
                                <th className="p-4 text-center">Tier</th>
                                <th className="p-4 text-right text-accent">Fundão 30%</th>
                                <th className="p-4 text-right text-success">Prêmio Devido</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {equipe.map((op: PerformanceOperador) => (
                                <tr key={op.operadorId} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-text-primary">{op.operadorNome}</td>
                                    <td className="p-4 text-muted text-xs">{op.filialNome}</td>
                                    <td className="p-4 text-right font-mono font-bold">
                                        R$ {op.totalVendasBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-blue/10 text-primary-blue font-black text-xs">
                                            {op.tierAtingido}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-accent">
                                        R$ {op.partePool30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right font-mono font-black text-success text-lg">
                                        R$ {op.premioAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center">
                                        {op.premioAReceber > 0 ? (
                                            <span className="badge success text-[10px]">PREMIADO</span>
                                        ) : (
                                            <span className="badge text-[10px] opacity-50">EM BUSCA</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {equipe.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted">Nenhum operador encontrado com vendas neste período.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
