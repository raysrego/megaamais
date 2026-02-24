'use client';

import { useEffect, useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Ticket,
    Monitor,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    DollarSign,
    Users,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Wallet,
    ShieldCheck,
    Shield
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
// TODO: Remover mocks em produção - usar dados reais do Supabase
import { mockBoloes, mockTerminais, mockSorteios } from '@/data/mockData';
import { useLoja } from '@/contexts/LojaContext';
import {
    getDashboardKPIs,
    getConsolidadoFiliais,
    getFluxoSemanal,
    type DashboardKPIs
} from '@/services/dashboardService';
import { getDashboardKPIsAction, getConsolidadoFiliaisAction } from '@/hooks/actions';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { ModalGestaoCaixa } from '@/components/ModalGestaoCaixa';
import { ModalTransferenciaCofre } from '@/components/ModalTransferenciaCofre';

import { useRouter } from 'next/navigation';
import { usePerfil } from '@/hooks/usePerfil';
import { DashboardFilters } from '@/components/DashboardFilters';
import { KPIDrillDownModal } from '@/components/KPIDrillDownModal';
// TODO: Remover mocks restantes em produção e usar queries reais para drill-down
import { mockMovimentacoes, mockBoloes as mockBoloesData, mockTerminais as mockTerminaisData } from '@/data/mockData';
import { useMotorEncalhe } from '@/hooks/useMotorEncalhe';
import { LoadingState } from '@/components/ui/LoadingState';
import { FINANCIAL_RULES } from '@/lib/financial-constants';

// Novos componentes UI Core
import { PageHeader } from '@/components/ui/PageHeader';
import { KPICard } from '@/components/ui/KPICard';

export default function DashboardPage() {
    const { lojaAtual } = useLoja();
    const { isAdmin, loading: loadingPerfil } = usePerfil();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
    const [consolidadoFiliais, setConsolidadoFiliais] = useState<any[]>([]);
    const [fluxoSemanal, setFluxoSemanal] = useState<any[]>([]);
    const [showGestaoCaixa, setShowGestaoCaixa] = useState(false);
    const [showTransferencia, setShowTransferencia] = useState(false);

    // Ativa os motores de automação financeira (Fase 3)
    useMotorEncalhe();

    // Estados para Drill-down
    const [drillDownConfig, setDrillDownConfig] = useState<{
        isOpen: boolean;
        title: string;
        kpiValue: string;
        data: any[];
        columns: any[];
    }>({
        isOpen: false,
        title: '',
        kpiValue: '',
        data: [],
        columns: []
    });

    const supabase = createBrowserSupabaseClient();

    // Proteção de Rota

    useEffect(() => {
        if (!loadingPerfil && !isAdmin) {
            router.replace('/caixa');
        }
    }, [isAdmin, loadingPerfil, router]);

    useEffect(() => {
        async function loadData() {
            // Se ainda está carregando perfil, não faz nada
            if (loadingPerfil) return;


            // Caso 1: Sem loja selecionada e NÃO é admin (Erros de acesso ou operador sem loja)
            if (!lojaAtual && !isAdmin) {
                setLoading(false);
                return;
            }

            setLoading(true);

            // Caso 2: Carregamento de dados (Com loja ou visão consolidada de Admin)
            try {
                // Se tem loja, carrega dados específicos dela
                if (lojaAtual) {

                    const [kpiRes, consolidadoRes, dataFluxo] = await Promise.all([
                        getDashboardKPIsAction(lojaAtual.id),
                        getConsolidadoFiliaisAction(),
                        getFluxoSemanal(supabase, lojaAtual.id)
                    ]);

                    if (kpiRes.data) setKpis(kpiRes.data as any);
                    if (consolidadoRes.data) setConsolidadoFiliais(consolidadoRes.data as any);
                    setFluxoSemanal(dataFluxo);
                }
                // Se não tem loja mas é Admin (Visão Geral)
                else if (isAdmin) {
                    const consolidadoRes = await getConsolidadoFiliaisAction();
                    if (consolidadoRes.data) setConsolidadoFiliais(consolidadoRes.data as any);
                    setKpis(null);
                }
            } catch (err: any) {
                console.error('Erro CRÍTICO ao carregar dashboard:', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [lojaAtual, supabase, isAdmin, loadingPerfil]);

    // Loading State
    if (loadingPerfil || (loading && !kpis && !consolidadoFiliais.length)) {
        return <LoadingState type="dashboard" />;
    }

    const kpiData = kpis || {
        faturamentoHoje: 0,
        vendasJogos: 0,
        vendasBoloes: 0,
        lucroBoloes: 0,
        terminaisAtivos: 0,
        terminaisTotal: 0,
        caixasAbertos: 0,
        quebrasHoje: 0,
        saldoCofre: 0,
        saldoBancos: 0
    };

    // Dados Reais para PieChart
    const dataPie = [
        { name: 'Bolões', value: kpiData.vendasBoloes, color: '#8b5cf6' },
        { name: 'Vendas Jogos', value: kpiData.vendasJogos, color: '#3b82f6' },
        // Outros pode ser calculado se houver serviços etc. Por enquanto 0.
        { name: 'Outros', value: 0, color: '#f59e0b' },
    ].filter(item => item.value > 0);
    // Filter para não mostrar fatias vazias na legenda ou feio no gráfico

    if (loadingPerfil || loading) {
        return <LoadingState type="dashboard" />;
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Shield size={48} className="text-muted mb-4 opacity-20" />
                <h1 className="text-xl font-bold text-white mb-2">Acesso Restrito</h1>
                <p className="text-muted max-w-md">
                    Este painel é exclusivo para administradores. Redirecionando para sua área de trabalho...
                </p>
            </div>
        );
    }

    return (
        <div className="dashboard-content animate-in fade-in duration-700">
            <PageHeader
                title="Painel Estratégico"
            >
                <button className="btn btn-ghost" onClick={() => setShowGestaoCaixa(true)}>
                    <Zap size={16} /> Entradas / Saídas
                </button>
                <button className="btn btn-primary" onClick={() => setShowTransferencia(true)}>
                    <ShieldCheck size={16} /> Gestão de Cofre
                </button>
            </PageHeader>

            <DashboardFilters onApply={() => { }} />

            {/* KPIs Principais */}
            <div className="kpi-grid">
                <KPICard
                    label="Faturamento Hoje"
                    value={`R$ ${kpiData.faturamentoHoje.toLocaleString('pt-BR')}`}
                    icon={DollarSign}
                    trend={{ value: '18%', direction: 'up', description: 'vs ontem' }}
                    onClick={() => setDrillDownConfig({
                        isOpen: true,
                        title: 'Detalhamento de Faturamento',
                        kpiValue: `R$ ${kpiData.faturamentoHoje.toLocaleString('pt-BR')}`,
                        data: mockMovimentacoes,
                        columns: [
                            { key: 'horario', label: 'Hora' },
                            { key: 'tipo', label: 'Tipo' },
                            { key: 'descricao', label: 'Descrição' },
                            { key: 'valor', label: 'Valor', format: (v: any) => `R$ ${v.toLocaleString('pt-BR')}` },
                            { key: 'terminal', label: 'Terminal' }
                        ]
                    })}
                />

                <KPICard
                    label="Lucro Bolões"
                    value={`R$ ${kpiData.lucroBoloes.toLocaleString('pt-BR')}`}
                    icon={Ticket}
                    trend={{ value: '12%', direction: 'up', description: 'Ágio acumulado' }}
                    variant="success"
                    onClick={() => setDrillDownConfig({
                        isOpen: true,
                        title: 'Lucro de Bolões (Ágio)',
                        kpiValue: `R$ ${kpiData.lucroBoloes.toLocaleString('pt-BR')}`,
                        data: mockBoloesData,
                        columns: [
                            { key: 'jogo', label: 'Jogo' },
                            { key: 'concurso', label: 'Concurso' },
                            { key: 'valorCota', label: 'Vlr Cota', format: (v: any) => `R$ ${v.toLocaleString('pt-BR')}` },
                            { key: 'cotasVendidas', label: 'Vendidas' },
                            { key: 'agio', label: 'Ágio', format: (v: any) => `${v}%` }
                        ]
                    })}
                />

                <KPICard
                    label="Terminais Ativos"
                    value={`${kpiData.terminaisAtivos} / ${kpiData.terminaisTotal}`}
                    icon={Monitor}
                    trend={{ value: 'OK', direction: 'neutral', description: 'Operação normal' }}
                    variant="accent"
                    onClick={() => setDrillDownConfig({
                        isOpen: true,
                        title: 'Status dos Terminais (TFL)',
                        kpiValue: `${kpiData.terminaisAtivos} / ${kpiData.terminaisTotal}`,
                        data: mockTerminaisData,
                        columns: [
                            { key: 'numeroTFL', label: 'Terminal' },
                            { key: 'operador', label: 'Operador' },
                            { key: 'volumeVendas', label: 'Vendas', format: (v: any) => `R$ ${v.toLocaleString('pt-BR')}` },
                            { key: 'status', label: 'Status' }
                        ]
                    })}
                />

                <KPICard
                    label="Caixas Abertos"
                    value={kpiData.caixasAbertos}
                    icon={BarChart3}
                    trend={{ value: 'Ativo', direction: 'neutral', description: 'No turno atual' }}
                />

                <KPICard
                    label="Saldo em Cofre"
                    value={`R$ ${kpiData.saldoCofre.toLocaleString('pt-BR')}`}
                    icon={Wallet}
                    trend={{ value: 'Físico', direction: 'neutral', description: 'Dinheiro em espécie' }}
                    variant="warning"
                />

                <KPICard
                    label="Saldo em Bancos"
                    value={`R$ ${kpiData.saldoBancos.toLocaleString('pt-BR')}`}
                    icon={ShieldCheck}
                    trend={{ value: 'Digital', direction: 'neutral', description: 'Dinheiro em conta' }}
                    variant="accent"
                />
            </div>

            {/* Gráficos */}
            <div className="charts-grid mt-6">
                <div className="chart-card">
                    <h3 className="chart-title mb-6"><TrendingUp size={18} className="text-success" /> Fluxo Financeiro (Última Semana)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={fluxoSemanal}>
                                <defs>
                                    <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                                <XAxis dataKey="dia" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                <Area type="monotone" dataKey="entradas" stroke="var(--success)" fillOpacity={1} fill="url(#colorEntradas)" strokeWidth={3} />
                                <Area type="monotone" dataKey="saidas" stroke="var(--danger)" fillOpacity={1} fill="url(#colorSaidas)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card">
                    <h3 className="chart-title mb-6"><BarChart3 size={18} className="text-primary-blue-light" /> Composição do Faturamento</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={dataPie} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                                    {dataPie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={`var(--chart-${index + 1})`} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)'
                                    }}
                                    formatter={(v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tabela de Fechamento por Filial */}
            <div className="card-premium mt-6 overflow-visible">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="chart-title mb-0!">Fechamento Consolidado por Filial</h3>
                    <button className="btn btn-ghost text-[0.65rem] py-1! px-3! font-black">Ver Relatório Completo</button>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Filial</th>
                                <th>Jogos ({FINANCIAL_RULES.MARGEM_JOGOS_CAIXA}%)</th>
                                <th>Bolões ({FINANCIAL_RULES.AGIO_BOLOES}%)</th>
                                <th>Serviços</th>
                                <th>Pagamentos (Saída)</th>
                                <th>Resultado Líquido</th>
                            </tr>
                        </thead>
                        <tbody>
                            {consolidadoFiliais.map((f, idx) => (
                                <tr key={idx} className="hover:bg-muted/50 transition-colors">
                                    <td className="font-bold py-5">{f.filial}</td>
                                    <td>R$ {Number(f.vendas_jogos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td>R$ {Number(f.vendas_boloes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td>R$ 0,00</td>
                                    <td className="text-danger">R$ {Number(f.premios_pagos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="text-success font-black">R$ {Number(f.resultado_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t border-border bg-muted/30">
                            <tr>
                                <td className="p-5 font-black text-foreground text-base">TOTAL GERAL</td>
                                <td className="p-5 font-bold">R$ {consolidadoFiliais.reduce((acc, f) => acc + Number(f.vendas_jogos), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-5 font-bold">R$ {consolidadoFiliais.reduce((acc, f) => acc + Number(f.vendas_boloes), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-5 font-bold">R$ 0,00</td>
                                <td className="p-5 font-bold text-danger">R$ {consolidadoFiliais.reduce((acc, f) => acc + Number(f.premios_pagos), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-5 font-black text-primary-blue-light text-xl">R$ {consolidadoFiliais.reduce((acc, f) => acc + Number(f.resultado_liquido), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Modais */}
            <ModalGestaoCaixa isOpen={showGestaoCaixa} onClose={() => setShowGestaoCaixa(false)} />

            <ModalTransferenciaCofre
                isOpen={showTransferencia}
                onClose={() => setShowTransferencia(false)}
                onSuccess={() => {
                    // Recarregar dados se necessário
                    window.location.reload();
                }}
            />

            <KPIDrillDownModal
                isOpen={drillDownConfig.isOpen}
                onClose={() => setDrillDownConfig(prev => ({ ...prev, isOpen: false }))}
                title={drillDownConfig.title}
                kpiValue={drillDownConfig.kpiValue}
                data={drillDownConfig.data}
                columns={drillDownConfig.columns}
            />
        </div>
    );
}


