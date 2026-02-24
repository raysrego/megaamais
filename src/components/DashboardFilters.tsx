'use client';

import React from 'react';
import { Filter, Calendar, Building2, RefreshCw } from 'lucide-react';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil';

interface DashboardFiltersProps {
    onApply: (filters: { lojaId: string | 'all'; mes: number; ano: number }) => void;
    isLoading?: boolean;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({ onApply, isLoading }) => {
    const { lojaAtual, lojasDisponiveis, setLojaAtual } = useLoja();
    const { isAdmin } = usePerfil();

    const [selectedLoja, setSelectedLoja] = React.useState<string>(lojaAtual?.id || 'all');
    const [selectedMes, setSelectedMes] = React.useState<number>(new Date().getMonth() + 1);
    const [selectedAno, setSelectedAno] = React.useState<number>(new Date().getFullYear());

    const meses = [
        { value: 1, label: 'Janeiro' },
        { value: 2, label: 'Fevereiro' },
        { value: 3, label: 'Março' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Maio' },
        { value: 6, label: 'Junho' },
        { value: 7, label: 'Julho' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Setembro' },
        { value: 10, label: 'Outubro' },
        { value: 11, label: 'Novembro' },
        { value: 12, label: 'Dezembro' },
    ];

    const anos = [
        new Date().getFullYear() - 1,
        new Date().getFullYear(),
        new Date().getFullYear() + 1,
    ];

    const handleApply = () => {
        onApply({
            lojaId: selectedLoja as any,
            mes: selectedMes,
            ano: selectedAno,
        });
    };

    return (
        <div className="card mb-6 p-4!">
            <div className="flex flex-wrap items-end gap-4">
                <div className="form-group flex-1 min-w-[200px] mb-0!">
                    <label className="flex items-center gap-2">
                        <Building2 size={14} /> Filial
                    </label>
                    <select
                        className="input"
                        value={selectedLoja}
                        onChange={(e) => setSelectedLoja(e.target.value)}
                        disabled={!isAdmin}
                    >
                        {isAdmin && <option value="all">Todas as Filiais</option>}
                        {lojasDisponiveis.map((loja) => (
                            <option key={loja.id} value={loja.id}>
                                {loja.nome_fantasia}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group min-w-[150px] mb-0!">
                    <label className="flex items-center gap-2">
                        <Calendar size={14} /> Mês
                    </label>
                    <select
                        className="input"
                        value={selectedMes}
                        onChange={(e) => setSelectedMes(Number(e.target.value))}
                    >
                        {meses.map((m) => (
                            <option key={m.value} value={m.value}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group min-w-[120px] mb-0!">
                    <label className="flex items-center gap-2">
                        <Calendar size={14} /> Ano
                    </label>
                    <select
                        className="input"
                        value={selectedAno}
                        onChange={(e) => setSelectedAno(Number(e.target.value))}
                    >
                        {anos.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    className="btn btn-primary h-[42px] px-6"
                    onClick={handleApply}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <div className="loader mr-2" />
                    ) : (
                        <Filter size={16} className="mr-2" />
                    )}
                    Filtrar Resultados
                </button>
            </div>
        </div>
    );
};
