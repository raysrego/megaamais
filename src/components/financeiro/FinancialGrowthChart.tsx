'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancialGrowthChartProps {
    data: any[];
    type: 'receita' | 'despesa';
    year: number;
    onBarClick?: (month: number) => void;
    series?: { key: string; label: string; color: string }[];
    selectedMonth?: number; // Mês selecionado (1-12)
    showAllMonths?: boolean; // Toggle ano completo
}

export function FinancialGrowthChart({ data, type, year, onBarClick, series, selectedMonth, showAllMonths = false }: FinancialGrowthChartProps) {
    const isReceita = type === 'receita';
    const defaultColor = isReceita ? '#10B981' : '#F43F5E';
    const neutralColor = '#64748b'; // Cor neutra para barras inativas

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-bg-card border border-white/10 p-3 rounded-xl backdrop-blur-md">
                    <p className="text-[10px] font-bold text-text-muted mb-2 uppercase tracking-widest">{label} de {year}</p>
                    <div className="space-y-1.5">
                        {payload.map((p: any, i: number) => (
                            <div key={i} className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                                    <span className="text-[10px] font-bold text-text-secondary uppercase">{p.name === 'value' ? 'Total' : p.name}</span>
                                </div>
                                <span className="text-sm font-black text-white">
                                    R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[220px] mt-4 mb-8 select-none" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                    data={data}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                    onClick={(state) => {
                        if (state && state.activeLabel && onBarClick) {
                            const labelStr = String(state.activeLabel);
                            const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                            const monthIdx = mesesNomes.indexOf(labelStr);
                            if (monthIdx !== -1) {
                                onBarClick(monthIdx + 1);
                            }
                        } else if (state && typeof state.activeTooltipIndex === 'number' && onBarClick) {
                            onBarClick(state.activeTooltipIndex + 1);
                        }
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        tickFormatter={(value) => `R$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                    />
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }}
                        allowEscapeViewBox={{ x: false, y: true }}
                    />

                    {series && series.length > 0 ? (
                        series.map((s, idx) => (
                            <Bar
                                key={s.key}
                                dataKey={s.key}
                                name={s.label}
                                radius={[3, 3, 0, 0]}
                                maxBarSize={30}
                            >
                                {data.map((entry, index) => {
                                    const month = index + 1;
                                    const isActive = showAllMonths || month === selectedMonth;
                                    return (
                                        <Cell
                                            key={`cell-${s.key}-${index}`}
                                            fill={isActive ? s.color : neutralColor}
                                            fillOpacity={isActive ? 1 : 0.15}
                                            className={`transition-all duration-300 ${showAllMonths ? 'cursor-default' : 'cursor-pointer hover:fill-opacity-80'}`}
                                        />
                                    );
                                })}
                            </Bar>
                        ))
                    ) : (
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {data.map((entry, index) => {
                                const month = index + 1;
                                const isActive = showAllMonths || month === selectedMonth;
                                return (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={isActive ? defaultColor : neutralColor}
                                        fillOpacity={isActive ? 1 : 0.15}
                                        className={`transition-all duration-300 ${showAllMonths ? 'cursor-default' : 'cursor-pointer hover:fill-opacity-80'}`}
                                    />
                                );
                            })}
                        </Bar>
                    )}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
