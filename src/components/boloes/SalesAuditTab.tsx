'use client';

import { useState, useEffect } from 'react';
import { getAuditoriaCompleta } from '@/actions/boloes';
import { Search, Filter, Download, User, Building2, Ticket, DollarSign, AlertCircle, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLoja } from '@/contexts/LojaContext';

export function SalesAuditTab() {
    const { lojaAtual } = useLoja();
    const [registros, setRegistros] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'venda' | 'encalhe'>('todos');

    useEffect(() => {
        const loadRegistros = async () => {
            setLoading(true);
            try {
                const data = await getAuditoriaCompleta(lojaAtual?.id);
                setRegistros(data);
            } catch (error) {
                console.error('Erro ao carregar auditoria:', error);
            } finally {
                setLoading(false);
            }
        };
        loadRegistros();
    }, [lojaAtual]);

    const filteredRegistros = registros
        .filter(r => {
            // Filtro por tipo
            if (filtroTipo !== 'todos' && r.tipo !== filtroTipo) return false;

            // Filtro de busca
            const searchLower = searchTerm.toLowerCase();
            return (
                r.responsavel.toLowerCase().includes(searchLower) ||
                r.loteria.toLowerCase().includes(searchLower) ||
                r.concurso.toLowerCase().includes(searchLower)
            );
        });

    // Estatísticas
    const totalVendas = registros.filter(r => r.tipo === 'venda').length;
    const totalEncalhes = registros.filter(r => r.tipo === 'encalhe').length;
    const valorTotalVendas = registros
        .filter(r => r.tipo === 'venda')
        .reduce((acc, r) => acc + r.valorTotal, 0);
    const valorTotalEncalhes = registros
        .filter(r => r.tipo === 'encalhe')
        .reduce((acc, r) => acc + r.valorTotal, 0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-muted">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <span>Carregando auditoria completa...</span>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            {/* KPIs de Auditoria */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card bg-success/5 border-success/10">
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-success/60 tracking-widest mb-1">VENDAS</p>
                                <p className="text-2xl font-black text-success">{totalVendas}</p>
                            </div>
                            <Ticket className="text-success/20" size={32} />
                        </div>
                        <p className="text-xs text-muted mt-2">R$ {valorTotalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="card bg-warning/5 border-warning/10">
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-warning/60 tracking-widest mb-1">ENCALHES</p>
                                <p className="text-2xl font-black text-warning">{totalEncalhes}</p>
                            </div>
                            <AlertCircle className="text-warning/20" size={32} />
                        </div>
                        <p className="text-xs text-muted mt-2">R$ {valorTotalEncalhes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="card bg-primary/5 border-primary/10">
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-primary/60 tracking-widest mb-1">TOTAL REGISTROS</p>
                                <p className="text-2xl font-black text-primary">{registros.length}</p>
                            </div>
                            <DollarSign className="text-primary/20" size={32} />
                        </div>
                        <p className="text-xs text-muted mt-2">Vendas + Encalhes</p>
                    </div>
                </div>

                <div className="card bg-accent/5 border-accent/10">
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-accent/60 tracking-widest mb-1">TAXA ENCALHE</p>
                                <p className="text-2xl font-black text-accent">
                                    {totalVendas + totalEncalhes > 0
                                        ? ((totalEncalhes / (totalVendas + totalEncalhes)) * 100).toFixed(1)
                                        : 0}%
                                </p>
                            </div>
                            <Bot className="text-accent/20" size={32} />
                        </div>
                        <p className="text-xs text-muted mt-2">Processamento automático</p>
                    </div>
                </div>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por responsável, loteria ou concurso..."
                        className="input pl-10 h-[46px] w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <select
                        className="input h-[46px] px-4"
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value as any)}
                    >
                        <option value="todos">Todos os Registros</option>
                        <option value="venda">Apenas Vendas</option>
                        <option value="encalhe">Apenas Encalhes</option>
                    </select>

                    <button className="btn btn-primary h-[46px] px-6">
                        <Download size={18} /> Exportar
                    </button>
                </div>
            </div>

            {/* Tabela de Auditoria */}
            <div className="card-premium overflow-hidden">
                <div className="table-container">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-4 px-6">Tipo</th>
                                <th className="text-left py-4 px-6">Data/Hora</th>
                                <th className="text-left py-4 px-6">Responsável</th>
                                <th className="text-left py-4 px-6">Loteria</th>
                                <th className="text-center py-4 px-6">Cotas</th>
                                <th className="text-right py-4 px-6">Valor Total</th>
                                <th className="text-center py-4 px-6">Pagamento</th>
                                <th className="text-left py-4 px-6">Filial</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRegistros.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-muted">
                                        Nenhum registro encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            ) : (
                                filteredRegistros.map((r) => (
                                    <tr key={`${r.tipo}-${r.id}`} className="hover:bg-white/2 transition-colors group">
                                        <td className="py-4 px-6">
                                            {r.tipo === 'venda' ? (
                                                <span className="px-2.5 py-1 bg-success/10 text-success rounded-md text-xs font-bold uppercase tracking-wider border border-success/20">
                                                    Venda
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-warning/10 text-warning rounded-md text-xs font-bold uppercase tracking-wider border border-warning/20">
                                                    Encalhe
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-white">
                                                    {format(new Date(r.dataRegistro), "dd/MM/yyyy", { locale: ptBR })}
                                                </span>
                                                <span className="text-[10px] text-muted uppercase tracking-wider">
                                                    {format(new Date(r.dataRegistro), "HH:mm'h'", { locale: ptBR })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                {r.tipo === 'venda' ? (
                                                    <>
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                            <User size={14} />
                                                        </div>
                                                        <span className="text-sm font-semibold">{r.responsavel}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                                            <Bot size={14} />
                                                        </div>
                                                        <span className="text-sm font-semibold italic text-muted">{r.responsavel}</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Ticket size={14} className="text-accent" />
                                                    <span className="text-sm font-bold text-white">{r.loteria}</span>
                                                </div>
                                                <span className="text-[10px] text-muted ml-5">Conc: {r.concurso}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="badge badge-outline text-xs">{r.quantidadeCotas} cotas</span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <span className={`text-sm font-black ${r.tipo === 'venda' ? 'text-success' : 'text-warning'}`}>
                                                R$ {r.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center">
                                                <span className="text-[10px] bg-white/5 px-2 py-1 rounded uppercase font-bold tracking-tighter">
                                                    {r.metodoPagamento}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 text-muted">
                                                <Building2 size={12} />
                                                <span className="text-xs">{r.filial || 'Matriz'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
