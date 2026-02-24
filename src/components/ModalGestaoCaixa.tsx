'use client';

import { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import { useFinanceiro, TransacaoFinanceira } from '@/hooks/useFinanceiro';
import { useLoja } from '@/contexts/LojaContext';

interface ModalGestaoCaixaProps {
    isOpen: boolean;
    onClose: () => void;
}

const periodos = ['Hoje', 'Semana', 'Mês', 'Trimestre', 'Ano'];



export function ModalGestaoCaixa({ isOpen, onClose }: ModalGestaoCaixaProps) {
    const { lojaAtual } = useLoja();
    const { transacoes, fetchTransacoes, loading } = useFinanceiro();

    const [periodo, setPeriodo] = useState('Mês');
    const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
    const [busca, setBusca] = useState('');

    // Busca dados ao abrir
    useEffect(() => {
        if (isOpen) {
            const anoAtual = new Date().getFullYear();
            fetchTransacoes(anoAtual, 0, lojaAtual?.id || null);
        }
    }, [isOpen, lojaAtual, fetchTransacoes]);

    if (!isOpen) return null;

    // Lógica de Filtragem
    const getDataInicio = () => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        switch (periodo) {
            case 'Hoje': return hoje;
            case 'Semana': {
                const d = new Date(hoje);
                d.setDate(d.getDate() - d.getDay()); // Domingo
                return d;
            }
            case 'Mês': return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            case 'Trimestre': return new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
            case 'Ano': return new Date(hoje.getFullYear(), 0, 1);
            default: return new Date(hoje.getFullYear(), 0, 1);
        }
    };

    const itensFiltrados = transacoes.filter(t => {
        const dataT = new Date(t.data_vencimento + 'T12:00:00'); // Compensar fuso simples
        const dataInicio = getDataInicio();

        // 1. Filtro Data
        if (dataT < dataInicio) return false;

        // 2. Filtro Busca
        if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase()) && !t.item.toLowerCase().includes(busca.toLowerCase())) return false;

        // 3. Filtro Categoria
        if (categoriaFiltro !== 'Todas') {
            // Adaptação simples: Categorias do mock vs reais
            // Se o filtro for genérico, tentamos mapear.
            // Aqui seria ideal ter lista dinâmica de categorias, mas vamos simplificar:
            // Se o usuário selecionar 'Custos Fixos', filtramos itens fixos (precisaria do hook de itens)
            // Por enquanto, filtramos por texto solto ou implementamos depois
        }

        return true;
    });

    // Separar Entradas e Saídas
    const entradas = itensFiltrados.filter(t => t.tipo === 'receita').sort((a, b) => b.valor - a.valor);
    const saidas = itensFiltrados.filter(t => t.tipo === 'despesa').sort((a, b) => b.valor - a.valor);

    // Agrupar Saídas por Item (Subcategorias visualmente)
    const saidasAgrupadas = Object.values(saidas.reduce((acc: any, curr) => {
        if (!acc[curr.item]) acc[curr.item] = { item: curr.item, total: 0, transacoes: [] };
        acc[curr.item].total += curr.valor;
        acc[curr.item].transacoes.push(curr);
        return acc;
    }, {})).sort((a: any, b: any) => b.total - a.total) as { item: string, total: number, transacoes: TransacaoFinanceira[] }[];


    const totalEntradas = entradas.reduce((acc, t) => acc + t.valor, 0);
    const totalSaidas = saidas.reduce((acc, t) => acc + t.valor, 0);
    const saldoLiquido = totalEntradas - totalSaidas;
    const percentual = totalEntradas > 0 ? ((saldoLiquido / totalEntradas) * 100).toFixed(0) : '0';

    return (
        <>
            <div
                onClick={onClose}
                className="modal-overlay"
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998 }}
            />

            <div className="modal-container" style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '90%', maxWidth: 900, maxHeight: '85vh', background: 'var(--bg-card)',
                borderRadius: 16, border: '1px solid var(--border)', zIndex: 9999,
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* HEADLER */}
                <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <DollarSign size={18} className="text-emerald-400" />
                        <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Gestão de Caixa ({lojaAtual?.nome_fantasia || 'Todas'})</h2>
                    </div>
                    <button onClick={onClose} className="hover:text-red-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* FILTROS */}
                <div className="modal-filters" style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)', flexWrap: 'wrap' }}>
                    <select className="input" style={{ width: 'auto', fontSize: '0.75rem' }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
                        {periodos.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input
                        type="search"
                        className="input"
                        placeholder="Buscar lançamento..."
                        style={{ flex: 1, minWidth: 150, fontSize: '0.75rem' }}
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                    />
                </div>

                {/* BODY */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden' }}>

                    {/* COLUNA ENTRADAS */}
                    <div className="col-entradas" style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'rgba(34, 197, 94, 0.02)' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #22c55e20', display: 'flex', justifyContent: 'space-between', background: '#22c55e10' }}>
                            <span style={{ fontWeight: 600, color: '#22c55e', fontSize: '0.8rem', textTransform: 'uppercase' }}>Entradas</span>
                            <span style={{ fontWeight: 700, color: '#22c55e' }}>R$ {totalEntradas.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                            {loading ? <p className="text-xs text-muted text-center pt-4">Carregando...</p> :
                                entradas.length === 0 ? <p className="text-xs text-muted text-center pt-4">Nenhuma entrada no período.</p> :
                                    entradas.map(e => (
                                        <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.03)', alignItems: 'center' }}>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-gray-200">{e.item}</span>
                                                <span className="text-[10px] text-muted">{e.descricao} • {new Date(e.data_vencimento).toLocaleDateString()}</span>
                                            </div>
                                            <span style={{ fontWeight: 600, color: '#22c55e', fontSize: '0.9rem' }}>R$ {e.valor.toLocaleString('pt-BR')}</span>
                                        </div>
                                    ))}
                        </div>
                    </div>

                    {/* COLUNA SAÍDAS */}
                    <div className="col-saidas" style={{ display: 'flex', flexDirection: 'column', background: 'rgba(239, 68, 68, 0.02)' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #ef444420', display: 'flex', justifyContent: 'space-between', background: '#ef444410' }}>
                            <span style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.8rem', textTransform: 'uppercase' }}>Saídas</span>
                            <span style={{ fontWeight: 700, color: '#ef4444' }}>R$ {totalSaidas.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                            {loading ? <p className="text-xs text-muted text-center pt-4">Carregando...</p> :
                                saidasAgrupadas.length === 0 ? <p className="text-xs text-muted text-center pt-4">Nenhuma saída no período.</p> :
                                    saidasAgrupadas.map(group => (
                                        <div key={group.item} style={{ marginBottom: '0.75rem' }}>
                                            <div className="flex justify-between items-center mb-1 px-1">
                                                <span className="text-[10px] uppercase font-bold text-muted">{group.item}</span>
                                                <span className="text-[10px] font-bold text-red-400">R$ {group.total.toLocaleString('pt-BR')}</span>
                                            </div>
                                            {group.transacoes.map(t => (
                                                <div key={t.id} className="flex justify-between p-2 rounded bg-white/5 mb-1 text-xs hover:bg-white/10 transition-colors">
                                                    <span className="text-gray-300 truncate max-w-[180px]">{t.descricao}</span>
                                                    <span style={{ color: '#ef4444' }}>R$ {t.valor.toLocaleString('pt-BR')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
                    <div className="flex gap-6">
                        <div>
                            <div className="text-[10px] text-muted uppercase">Total Entradas</div>
                            <div className="font-bold text-success text-sm">R$ {totalEntradas.toLocaleString('pt-BR')}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-muted uppercase">Total Saídas</div>
                            <div className="font-bold text-danger text-sm">R$ {totalSaidas.toLocaleString('pt-BR')}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-muted uppercase">Saldo Líquido</div>
                        <div className="text-xl font-black" style={{ color: saldoLiquido >= 0 ? '#22c55e' : '#ef4444' }}>
                            R$ {saldoLiquido.toLocaleString('pt-BR')}
                            <span className="text-xs font-medium text-muted ml-2">({percentual}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

