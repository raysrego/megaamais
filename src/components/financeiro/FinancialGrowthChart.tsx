'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Line } from 'recharts';

interface FinancialGrowthChartProps {
    data: any[];
    type: 'receita' | 'despesa';
    year: number;
    onBarClick?: (month: number) => void;
    series?: { key: string; label: string; color: string }[];
    selectedMonth?: number;
    showAllMonths?: boolean;
}

export function FinancialGrowthChart({ data, type, year, onBarClick, series, selectedMonth, showAllMonths = false }: FinancialGrowthChartProps) {
    const isReceita = type === 'receita';
    const defaultColor = isReceita ? '#10B981' : '#F43F5E';
    const neutralColor = '#94a3b8';

    // Calcular acumulado
    const dataWithAccumulated = data.map((item, index) => {
        const accumulated = data
            .slice(0, index + 1)
            .reduce((acc, curr) => acc + (curr.value || 0), 0);
        return { ...item, accumulated };
    });

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const monthlyValue = payload.find(p => p.dataKey === 'value' || p.dataKey === Object.keys(payload[0]?.payload?.lojas || {})[0])?.value || 0;
            const accumulatedValue = payload.find(p => p.dataKey === 'accumulated')?.value || 0;
            return (
                <div className="bg-bg-card border border-white/10 p-3 rounded-xl backdrop-blur-md">
                    <p className="text-[10px] font-bold text-text-muted mb-2 uppercase tracking-widest">{label} de {year}</p>
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-[10px] font-bold text-text-secondary uppercase">Mensal</span>
                            <span className="text-sm font-black text-white">
                                R$ {monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-[10px] font-bold text-text-secondary uppercase">Acumulado</span>
                            <span className="text-sm font-black text-blue-400">
                                R$ {accumulatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[280px] mt-4 mb-8 select-none" style={{ minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={dataWithAccumulated}
                    margin={{ top: 20, right: 5, left: -20, bottom: 0 }}
                    onClick={(state) => {
                        if (state && state.activeLabel && onBarClick) {
                            const monthIdx = mesesNomes.indexOf(state.activeLabel);
                            if (monthIdx !== -1) onBarClick(monthIdx + 1);
                        }
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={(props) => {
                            const { x, y, payload } = props;
                            const monthIndex = mesesNomes.indexOf(payload.value);
                            const isActive = !showAllMonths && selectedMonth === monthIndex + 1;
                            return (
                                <text x={x} y={y} dy={10} textAnchor="middle" fill={isActive ? '#fff' : '#64748b'} fontWeight={isActive ? 'bold' : 'normal'} fontSize={10}>
                                    {payload.value}
                                </text>
                            );
                        }}
                    />
                    <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        tickFormatter={(value) => `R$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                    />
                    <YAxis yAxisId="right" orientation="right" hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />

                    {/* Barras principais */}
                    {series && series.length > 0 ? (
                        series.map((s, idx) => (
                            <Bar
                                key={s.key}
                                yAxisId="left"
                                dataKey={s.key}
                                name={s.label}
                                radius={[3, 3, 0, 0]}
                                maxBarSize={30}
                            >
                                {data.map((entry, index) => {
                                    const month = index + 1;
                                    const isActive = showAllMonths || (selectedMonth !== undefined && month === selectedMonth);
                                    return (
                                        <Cell
                                            key={`cell-${s.key}-${index}`}
                                            fill={isActive ? s.color : neutralColor}
                                            fillOpacity={isActive ? 1 : 0.3}
                                            stroke={isActive ? '#ffffff' : 'none'}
                                            strokeWidth={isActive ? 2 : 0}
                                            className={`transition-all duration-300 ${showAllMonths ? 'cursor-default' : 'cursor-pointer hover:fill-opacity-80'}`}
                                        />
                                    );
                                })}
                            </Bar>
                        ))
                    ) : (
                        <Bar yAxisId="left" dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {data.map((entry, index) => {
                                const month = index + 1;
                                const isActive = showAllMonths || (selectedMonth !== undefined && month === selectedMonth);
                                return (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={isActive ? defaultColor : neutralColor}
                                        fillOpacity={isActive ? 1 : 0.3}
                                        stroke={isActive ? '#ffffff' : 'none'}
                                        strokeWidth={isActive ? 2 : 0}
                                        className={`transition-all duration-300 ${showAllMonths ? 'cursor-default' : 'cursor-pointer hover:fill-opacity-80'}`}
                                    />
                                );
                            })}
                        </Bar>
                    )}

                    {/* Linha de acumulado */}
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="accumulated"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={false}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
