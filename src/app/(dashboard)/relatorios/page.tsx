'use client';

import { useState } from 'react';
import {
    TrendingUp,
    Building2,
    ArrowUpRight,
    ArrowDownRight,
    Download,
    FileSpreadsheet,
    FileText,
    CheckCircle2
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts';
import { useLoja } from '@/contexts/LojaContext';

export default function RelatoriosPage() {
    const { lojaAtual, lojasDisponiveis, setLojaAtual, loading: loadingLoja } = useLoja();
    // const [filialSelecionada, setFilialSelecionada] = useState('todas'); // SubstituÃ­do pelo context
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportSuccess, setExportSuccess] = useState<'pdf' | 'excel' | null>(null);

    const dadosFiliais = [
        { filial: 'Natureza', vendas: 45000, pagamentos: 28000, boloes: 12000 },
        { filial: 'Aririzal', vendas: 38000, pagamentos: 32000, boloes: 8500 },
    ];

    const composicaoFaturamento = [
        { name: 'Vendas Jogos', value: 35000, color: '#3b82f6' },
        { name: 'Bolões', value: 20500, color: '#8b5cf6' },
        { name: 'Pagamentos', value: 60000, color: '#f59e0b' },
        { name: 'Depósitos', value: 15000, color: '#22c55e' },
    ];

    const comparativoMensal = [
        { mes: 'Set', natureza: 42000, aririzal: 35000 },
        { mes: 'Out', natureza: 48000, aririzal: 40000 },
        { mes: 'Nov', natureza: 52000, aririzal: 38000 },
        { mes: 'Dez', natureza: 65000, aririzal: 55000 },
        { mes: 'Jan', natureza: 45000, aririzal: 38000 },
    ];

    const radarData = [
        { indicador: 'Vendas', natureza: 85, aririzal: 72 },
        { indicador: 'Bolões', natureza: 90, aririzal: 65 },
        { indicador: 'Atendimento', natureza: 78, aririzal: 85 },
        { indicador: 'Conversão', natureza: 82, aririzal: 70 },
        { indicador: 'Fidelização', natureza: 75, aririzal: 80 },
    ];

    const totalGeral = composicaoFaturamento.reduce((acc, item) => acc + item.value, 0);

    const handleExport = (type: 'pdf' | 'excel') => {
        setExportSuccess(type);
        setTimeout(() => {
            setExportSuccess(null);
            setShowExportModal(false);
        }, 1500);
    };

    if (loadingLoja) {
        return <LoadingState type="dashboard" />;
    }

    return (
        <div className="dashboard-content">
            <PageHeader
                title="BI & Relatórios"
            />

            <div className="flex gap-2 justify-end mb-6">
                <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={lojaAtual?.id || ''}
                    onChange={e => {
                        const selected = lojasDisponiveis.find(l => l.id === e.target.value);
                        if (selected) setLojaAtual(selected);
                    }}
                    disabled={lojasDisponiveis.length <= 1}
                >
                    {lojasDisponiveis.length > 1 && <option value="todas">Todas Filiais</option>}
                    {lojasDisponiveis.map(loja => (
                        <option key={loja.id} value={loja.id}>
                            {loja.nome_fantasia}
                        </option>
                    ))}
                </select>
                <button className="btn btn-accent" onClick={() => setShowExportModal(true)}>
                    <Download size={16} /> Exportar
                </button>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card primary">
                    <div className="kpi-header">
                        <span className="kpi-label">Faturamento Total</span>
                        <div className="kpi-icon"><TrendingUp size={20} /></div>
                    </div>
                    <div className="kpi-value">R$ {totalGeral.toLocaleString('pt-BR')}</div>
                    <div className="text-xs text-primary font-bold">+12% vs mês anterior</div>
                </div>
                <div className="kpi-card success">
                    <div className="kpi-header">
                        <span className="kpi-label">Filial Líder</span>
                        <div className="kpi-icon"><Building2 size={20} /></div>
                    </div>
                    <div className="kpi-value">Natureza</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                <div className="card">
                    <h3 className="chart-title">Composição do Faturamento</h3>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={composicaoFaturamento} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={5}>
                                    {composicaoFaturamento.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <h3 className="chart-title">Comparativo por Categoria</h3>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dadosFiliais} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="filial" type="category" stroke="#64748b" width={80} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                                <Bar dataKey="vendas" fill="#3b82f6" barSize={20} />
                                <Bar dataKey="pagamentos" fill="#f59e0b" barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div className="card">
                    <h3 className="chart-title">Evolução Mensal</h3>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparativoMensal}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="mes" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                                <Bar dataKey="natureza" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="aririzal" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <h3 className="chart-title">Radar de Performance</h3>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="indicador" stroke="#64748b" />
                                <Radar name="Natureza" dataKey="natureza" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                                <Radar name="Aririzal" dataKey="aririzal" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {
                showExportModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="card" style={{ width: 450, padding: '2rem', textAlign: 'center' }}>
                            {!exportSuccess ? (
                                <>
                                    <Download size={48} className="mx-auto mb-4 text-primary" />
                                    <h2 className="text-2xl font-bold mb-6">Exportar Relatório</h2>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <button className="card border-2 border-transparent hover:border-danger transition-all" onClick={() => handleExport('pdf')}>
                                            <FileText size={32} className="mx-auto text-danger mb-2" />
                                            <div className="font-bold">PDF</div>
                                        </button>
                                        <button className="card border-2 border-transparent hover:border-success transition-all" onClick={() => handleExport('excel')}>
                                            <FileSpreadsheet size={32} className="mx-auto text-success mb-2" />
                                            <div className="font-bold">Excel</div>
                                        </button>
                                    </div>
                                    <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Cancelar</button>
                                </>
                            ) : (
                                <div>
                                    <CheckCircle2 size={64} className="text-success mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-success">Documento Gerado!</h2>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div>
    );
}

