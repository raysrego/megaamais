'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp, Smartphone, Banknote, RefreshCw, Filter, ArrowDownCircle, X, Wallet, History } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

interface Loja {
    id: string;
    nome_fantasia: string;
}

interface DepositoConciliacao {
    id: number;
    valor: number;
    data_deposito: string;
    observacoes: string;
    usuario_nome?: string;
}

export default function ConciliacaoPage() {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [lojas, setLojas] = useState<Loja[]>([]);

    const [lojaSelecionada, setLojaSelecionada] = useState('');

    // Filtros principais
    const [filtroTipo, setFiltroTipo] = useState<'mes' | 'periodo'>('mes');
    const [mesReferencia, setMesReferencia] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');

    // Dados principais
    const [totalEntradas, setTotalEntradas] = useState(0);
    const [totalDepositado, setTotalDepositado] = useState(0);
    const [depositosDetalhes, setDepositosDetalhes] = useState<DepositoConciliacao[]>([]);

    // Filtros para histórico de depósitos
    const [filtroDepositoDataInicio, setFiltroDepositoDataInicio] = useState('');
    const [filtroDepositoDataFim, setFiltroDepositoDataFim] = useState('');
    const [filtroValorMin, setFiltroValorMin] = useState('');
    const [depositosFiltrados, setDepositosFiltrados] = useState<DepositoConciliacao[]>([]);

    // Carregar lojas do usuário
    const carregarLojas = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setInitialLoad(false);
                setLoading(false);
                return;
            }

            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('empresa_id, acesso_empresas')
                .eq('id', user.id)
                .single();

            if (userError) {
                console.error('Erro ao buscar usuário:', userError);
                setInitialLoad(false);
                setLoading(false);
                return;
            }

            let lojaIds: string[] = [];
            if (userData?.empresa_id) lojaIds.push(userData.empresa_id);
            if (userData?.acesso_empresas && Array.isArray(userData.acesso_empresas)) {
                lojaIds.push(...userData.acesso_empresas);
            }
            lojaIds = [...new Set(lojaIds)];

            if (lojaIds.length === 0) {
                setInitialLoad(false);
                setLoading(false);
                return;
            }

            const { data: empresasData, error: empresasError } = await supabase
                .from('empresas')
                .select('id, nome_fantasia, nome')
                .in('id', lojaIds)
                .eq('ativo', true);

            if (empresasError) {
                console.error('Erro ao buscar empresas:', empresasError);
                setInitialLoad(false);
                setLoading(false);
                return;
            }

            if (empresasData && empresasData.length > 0) {
                const lojasFormatadas: Loja[] = empresasData.map(emp => ({
                    id: emp.id,
                    nome_fantasia: emp.nome_fantasia || emp.nome || 'Loja sem nome'
                }));
                setLojas(lojasFormatadas);
                if (!lojaSelecionada && lojasFormatadas.length > 0) {
                    setLojaSelecionada(lojasFormatadas[0].id);
                }
            }
            setInitialLoad(false);
        } catch (err) {
            console.error('Erro carregar lojas:', err);
            setInitialLoad(false);
            setLoading(false);
        }
    }, [supabase, lojaSelecionada]);

    // Buscar dados de conciliação (entradas líquidas e depósitos)
    const buscarDadosConciliacao = useCallback(async () => {
        if (!lojaSelecionada) return;

        setLoading(true);
        try {
            let dataInicioSQL: string;
            let dataFimSQL: string;

            if (filtroTipo === 'mes') {
                dataInicioSQL = `${mesReferencia}-01`;
                // último dia do mês
                const [ano, mes] = mesReferencia.split('-');
                const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
                dataFimSQL = `${mesReferencia}-${ultimoDia}`;
            } else {
                dataInicioSQL = dataInicio;
                dataFimSQL = dataFim;
            }

            // 1. Entradas líquidas para conciliação (valor_para_conciliacao)
            const { data: entradasData, error: entradasError } = await supabase
                .from('vw_entradas_liquidas_conciliacao')
                .select('valor_para_conciliacao')
                .eq('loja_id', lojaSelecionada)
                .gte('data_movimento', dataInicioSQL)
                .lte('data_movimento', dataFimSQL);

            if (entradasError) throw entradasError;

            const totalEntradasValor = entradasData?.reduce(
                (sum, e) => sum + (e.valor_para_conciliacao || 0), 0
            ) || 0;
            setTotalEntradas(totalEntradasValor);

            // 2. Depósitos (tabela depositos_conciliacao)
            let queryDepositos = supabase
                .from('depositos_conciliacao')
                .select(`
                    id,
                    valor,
                    data_deposito,
                    observacoes,
                    usuario_id
                `)
                .eq('loja_id', lojaSelecionada)
                .gte('data_deposito', dataInicioSQL)
                .lte('data_deposito', dataFimSQL);

            const { data: depositosData, error: depositosError } = await queryDepositos;

            if (depositosError) throw depositosError;

            const totalDepositosValor = depositosData?.reduce((sum, d) => sum + (d.valor || 0), 0) || 0;
            setTotalDepositado(totalDepositosValor);

            // Enriquecer depósitos com nome do usuário
            if (depositosData && depositosData.length > 0) {
                const userIds = [...new Set(depositosData.map(d => d.usuario_id).filter(Boolean))];
                let userMap: Record<string, string> = {};
                if (userIds.length > 0) {
                    const { data: usuarios } = await supabase
                        .from('usuarios')
                        .select('id, nome')
                        .in('id', userIds);
                    if (usuarios) {
                        userMap = Object.fromEntries(usuarios.map(u => [u.id, u.nome]));
                    }
                }
                const detalhes: DepositoConciliacao[] = depositosData.map(d => ({
                    id: d.id,
                    valor: d.valor,
                    data_deposito: d.data_deposito,
                    observacoes: d.observacoes || '',
                    usuario_nome: userMap[d.usuario_id] || 'Sistema'
                }));
                setDepositosDetalhes(detalhes);
            } else {
                setDepositosDetalhes([]);
            }
        } catch (err: any) {
            console.error('Erro ao buscar dados de conciliação:', err);
            toast({ message: err.message || 'Erro ao carregar dados', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [supabase, lojaSelecionada, mesReferencia, filtroTipo, dataInicio, dataFim, toast]);

    // Aplicar filtros nos depósitos (client-side)
    useEffect(() => {
        let filtered = [...depositosDetalhes];

        if (filtroDepositoDataInicio) {
            filtered = filtered.filter(d => new Date(d.data_deposito) >= new Date(filtroDepositoDataInicio));
        }
        if (filtroDepositoDataFim) {
            filtered = filtered.filter(d => new Date(d.data_deposito) <= new Date(filtroDepositoDataFim + 'T23:59:59'));
        }
        if (filtroValorMin) {
            const min = parseFloat(filtroValorMin);
            if (!isNaN(min)) {
                filtered = filtered.filter(d => d.valor >= min);
            }
        }

        setDepositosFiltrados(filtered);
    }, [depositosDetalhes, filtroDepositoDataInicio, filtroDepositoDataFim, filtroValorMin]);

    // Carregar lojas inicialmente
    useEffect(() => {
        carregarLojas();
    }, [carregarLojas]);

    // Buscar dados quando loja ou filtros mudarem
    useEffect(() => {
        if (lojaSelecionada && !initialLoad) {
            buscarDadosConciliacao();
        }
    }, [lojaSelecionada, mesReferencia, filtroTipo, dataInicio, dataFim, initialLoad, buscarDadosConciliacao]);

    const formatarMoeda = (valor: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    };

    const formatarData = (data: string) => {
        return new Date(data).toLocaleDateString('pt-BR');
    };

    const formatarMes = (mes: string) => {
        const [ano, mesNum] = mes.split('-');
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
    };

    const limparFiltrosDepositos = () => {
        setFiltroDepositoDataInicio('');
        setFiltroDepositoDataFim('');
        setFiltroValorMin('');
    };

    if (initialLoad || (loading && !totalEntradas && !totalDepositado && lojaSelecionada)) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-blue-light/10 flex items-center justify-center">
                        <Wallet size={20} className="text-primary-blue-light" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black">Conciliação Bancária</h1>
                        <p className="text-xs text-muted">Visão consolidada de entradas líquidas e depósitos</p>
                    </div>
                </div>
                <button onClick={buscarDadosConciliacao} className="btn btn-ghost btn-sm">
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>

            {/* Filtros principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Filial</label>
                    <select
                        value={lojaSelecionada}
                        onChange={e => setLojaSelecionada(e.target.value)}
                        className="input w-full"
                    >
                        {lojas.map(loja => (
                            <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Tipo de Filtro</label>
                    <select
                        value={filtroTipo}
                        onChange={e => setFiltroTipo(e.target.value as any)}
                        className="input w-full"
                    >
                        <option value="mes">Mês de Referência</option>
                        <option value="periodo">Período Personalizado</option>
                    </select>
                </div>
            </div>

            {filtroTipo === 'mes' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase">Mês de Referência</label>
                        <input
                            type="month"
                            value={mesReferencia}
                            onChange={e => setMesReferencia(e.target.value)}
                            className="input w-full"
                        />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase">Data Início</label>
                        <input
                            type="date"
                            value={dataInicio}
                            onChange={e => setDataInicio(e.target.value)}
                            className="input w-full"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase">Data Fim</label>
                        <input
                            type="date"
                            value={dataFim}
                            onChange={e => setDataFim(e.target.value)}
                            className="input w-full"
                        />
                    </div>
                </div>
            )}

            {/* Cards de Resumo */}
            {lojaSelecionada && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card p-4 bg-success/5 border-success/20">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={16} className="text-success" />
                                <p className="text-[10px] font-bold text-success uppercase">Entradas Líquidas (Auditadas)</p>
                            </div>
                            <p className="text-2xl font-bold text-success">{formatarMoeda(totalEntradas)}</p>
                            <p className="text-[10px] text-muted mt-2">
                                Valor total que não foi para o cofre (entradas - cofre)
                            </p>
                        </div>

                        <div className="card p-4 bg-primary-blue-light/5 border-primary-blue-light/20">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowDownCircle size={16} className="text-primary-blue-light" />
                                <p className="text-[10px] font-bold text-primary-blue-light uppercase">Depósitos Recebidos</p>
                            </div>
                            <p className="text-2xl font-bold text-primary-blue-light">{formatarMoeda(totalDepositado)}</p>
                            <p className="text-[10px] text-muted mt-2">
                                {depositosDetalhes.length} {depositosDetalhes.length === 1 ? 'depósito' : 'depósitos'} no período
                            </p>
                        </div>
                    </div>

                    {/* Histórico de Depósitos */}
                    {depositosDetalhes.length > 0 && (
                        <div className="card p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <History size={18} className="text-primary-blue-light" />
                                Histórico de Depósitos
                            </h2>

                            {/* Filtros do histórico */}
                            <div className="mb-4 p-4 rounded-xl bg-surface-subtle border border-border">
                                <div className="flex items-center gap-2 mb-3">
                                    <Filter size={16} className="text-primary-blue-light" />
                                    <h3 className="text-sm font-bold">Filtrar Depósitos</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Início</label>
                                        <input
                                            type="date"
                                            value={filtroDepositoDataInicio}
                                            onChange={e => setFiltroDepositoDataInicio(e.target.value)}
                                            className="input w-full text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Fim</label>
                                        <input
                                            type="date"
                                            value={filtroDepositoDataFim}
                                            onChange={e => setFiltroDepositoDataFim(e.target.value)}
                                            className="input w-full text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Valor Mínimo (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={filtroValorMin}
                                            onChange={e => setFiltroValorMin(e.target.value)}
                                            className="input w-full text-sm"
                                            placeholder="Ex: 1000"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={limparFiltrosDepositos}
                                            className="btn btn-ghost w-full text-sm"
                                        >
                                            <X size={12} /> Limpar Filtros
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted mt-3">
                                    Exibindo {depositosFiltrados.length} de {depositosDetalhes.length} depósitos
                                </p>
                            </div>

                            {/* Tabela de Depósitos */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Data</th>
                                            <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">Valor</th>
                                            <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Observações</th>
                                            <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Registrado por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {depositosFiltrados.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-muted text-sm">
                                                    Nenhum depósito corresponde aos filtros aplicados
                                                </td>
                                            </tr>
                                        ) : (
                                            depositosFiltrados.map((dep) => (
                                                <tr key={dep.id} className="border-b border-border/50 hover:bg-surface-subtle transition-colors">
                                                    <td className="py-3 px-2 text-sm">{formatarData(dep.data_deposito)}</td>
                                                    <td className="py-3 px-2 text-right font-bold text-success text-sm">{formatarMoeda(dep.valor)}</td>
                                                    <td className="py-3 px-2 text-muted text-sm">{dep.observacoes || '-'}</td>
                                                    <td className="py-3 px-2 text-muted text-sm">{dep.usuario_nome || 'Sistema'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {!lojaSelecionada && (
                <div className="card p-12 text-center">
                    <Wallet size={48} className="mx-auto mb-4 text-muted opacity-50" />
                    <p className="text-muted">Selecione uma filial e período para visualizar a conciliação</p>
                </div>
            )}
        </div>
    );
}
