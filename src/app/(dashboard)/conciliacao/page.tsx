'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Loader2, TrendingUp, RefreshCw, Filter, ArrowDownCircle, X, Wallet, History, Smartphone, Calendar } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

// ------------------------------------------------------------------
// Interfaces
// ------------------------------------------------------------------
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

interface TransacaoTFL {
    sessao_id: number;
    loja_id: string;
    data_turno: string;
    total_entradas: number;
    valor_cofre: number;
    pix_externo: number;
    valor_liquido: number;
    auditoria_status: string;
    auditoria_data: string;
    operador_nome: string;
}

// ------------------------------------------------------------------
// Componentes memoizados
// ------------------------------------------------------------------
const TFLTable = memo(({ data, formatarMoeda, formatarData }: { data: TransacaoTFL[]; formatarMoeda: (v: number) => string; formatarData: (d: string) => string }) => (
    <div className="overflow-x-auto">
        <table className="w-full">
            <thead>
                <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Data</th>
                    <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">Total Entradas</th>
                    <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">Valor Cofre</th>
                    <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">Valor Líquido</th>
                    <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">PIX Externo</th>
                    <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Operador</th>
                </tr>
            </thead>
            <tbody>
                {data.map(item => (
                    <tr key={item.sessao_id} className="border-b border-border/50 hover:bg-surface-subtle">
                        <td className="py-2 px-2 text-sm">{formatarData(item.data_turno)}</td>
                        <td className="py-2 px-2 text-right text-sm">{formatarMoeda(item.total_entradas)}</td>
                        <td className="py-2 px-2 text-right text-sm text-danger">{formatarMoeda(item.valor_cofre)}</td>
                        <td className="py-2 px-2 text-right text-sm font-bold text-success">{formatarMoeda(item.valor_liquido)}</td>
                        <td className="py-2 px-2 text-right text-sm text-yellow-600">{formatarMoeda(item.pix_externo)}</td>
                        <td className="py-2 px-2 text-sm text-muted">{item.operador_nome || '-'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
));

TFLTable.displayName = 'TFLTable';

const DepositosTable = memo(({ data, formatarMoeda, formatarData }: { data: DepositoConciliacao[]; formatarMoeda: (v: number) => string; formatarData: (d: string) => string }) => (
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
                {data.map(dep => (
                    <tr key={dep.id} className="border-b border-border/50 hover:bg-surface-subtle">
                        <td className="py-3 px-2 text-sm">{formatarData(dep.data_deposito)}</td>
                        <td className="py-3 px-2 text-right font-bold text-success text-sm">{formatarMoeda(dep.valor)}</td>
                        <td className="py-3 px-2 text-muted text-sm">{dep.observacoes || '-'}</td>
                        <td className="py-3 px-2 text-muted text-sm">{dep.usuario_nome || 'Sistema'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
));

DepositosTable.displayName = 'DepositosTable';

// ------------------------------------------------------------------
// Hook useDebounce
// ------------------------------------------------------------------
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// ------------------------------------------------------------------
// Componente Principal
// ------------------------------------------------------------------
export default function ConciliacaoPage() {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();

    // Estados de loading e dados
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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

    // Dados principais (cards)
    const [totalEntradas, setTotalEntradas] = useState(0);
    const [totalDepositado, setTotalDepositado] = useState(0);
    const [totalPixExterno, setTotalPixExterno] = useState(0);

    // Paginação e dados do histórico TFL
    const [historicoTFL, setHistoricoTFL] = useState<TransacaoTFL[]>([]);
    const [pageTFL, setPageTFL] = useState(1);
    const [hasMoreTFL, setHasMoreTFL] = useState(true);
    const [loadingMoreTFL, setLoadingMoreTFL] = useState(false);
    const [filtroTFLDia, setFiltroTFLDia] = useState('');
    const debouncedFiltroDia = useDebounce(filtroTFLDia, 500);

    // Dados de depósitos (paginação separada)
    const [depositosDetalhes, setDepositosDetalhes] = useState<DepositoConciliacao[]>([]);
    const [pageDepositos, setPageDepositos] = useState(1);
    const [hasMoreDepositos, setHasMoreDepositos] = useState(true);
    const [loadingMoreDepositos, setLoadingMoreDepositos] = useState(false);

    // Filtros client-side para depósitos (após carregados)
    const [filtroDepositoDataInicio, setFiltroDepositoDataInicio] = useState('');
    const [filtroDepositoDataFim, setFiltroDepositoDataFim] = useState('');
    const [filtroValorMin, setFiltroValorMin] = useState('');
    const [depositosFiltrados, setDepositosFiltrados] = useState<DepositoConciliacao[]>([]);

    // Aba ativa
    const [abaAtiva, setAbaAtiva] = useState<'tfl' | 'depositos'>('tfl');

    // Tamanho da página
    const PAGE_SIZE = 20;

    // ------------------------------------------------------------------
    // Funções auxiliares
    // ------------------------------------------------------------------
    const formatarMoeda = (valor: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };
    const formatarData = (data: string) => {
        if (!data) return '-';
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    // ------------------------------------------------------------------
    // Buscar lojas do usuário
    // ------------------------------------------------------------------
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
            if (userError) throw userError;
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
            if (empresasError) throw empresasError;
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

    // ------------------------------------------------------------------
    // Buscar dados dos cards (totais) e também carrega primeira página das listas
    // ------------------------------------------------------------------
    const buscarDadosConciliacao = useCallback(async (showToast: boolean = false) => {
        if (!lojaSelecionada) return;

        setLoading(true);
        try {
            let dataInicioSQL: string;
            let dataFimSQL: string;
            if (filtroTipo === 'mes') {
                dataInicioSQL = `${mesReferencia}-01`;
                const [ano, mes] = mesReferencia.split('-');
                const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
                dataFimSQL = `${mesReferencia}-${ultimoDia}`;
            } else {
                if (!dataInicio || !dataFim) {
                    if (showToast) toast({ message: 'Preencha as datas de início e fim', type: 'warning' });
                    setLoading(false);
                    return;
                }
                dataInicioSQL = dataInicio;
                dataFimSQL = dataFim;
            }

            // 1. Total entradas líquidas
            const { data: entradasData } = await supabase
                .from('vw_entradas_liquidas_conciliacao')
                .select('valor_para_conciliacao')
                .eq('loja_id', lojaSelecionada)
                .gte('data_movimento', dataInicioSQL)
                .lte('data_movimento', dataFimSQL);
            const totalEntradasValor = entradasData?.reduce((sum, e) => sum + (e.valor_para_conciliacao || 0), 0) || 0;
            setTotalEntradas(totalEntradasValor);

            // 2. Total depósitos
            const { data: depositosDataTotal } = await supabase
                .from('depositos_conciliacao')
                .select('valor')
                .eq('loja_id', lojaSelecionada)
                .gte('data_deposito', dataInicioSQL)
                .lte('data_deposito', dataFimSQL);
            const totalDepositosValor = depositosDataTotal?.reduce((sum, d) => sum + (d.valor || 0), 0) || 0;
            setTotalDepositado(totalDepositosValor);

            // 3. Total PIX externo
            const { data: pixData } = await supabase
                .from('vw_pix_externo_conciliacao')
                .select('total_pix_externo')
                .eq('loja_id', lojaSelecionada)
                .gte('data_movimento', dataInicioSQL)
                .lte('data_movimento', dataFimSQL);
            const totalPix = pixData?.reduce((sum, p) => sum + (p.total_pix_externo || 0), 0) || 0;
            setTotalPixExterno(totalPix);

            // 4. Resetar paginação e carregar primeira página das listas
            setPageTFL(1);
            setHasMoreTFL(true);
            setPageDepositos(1);
            setHasMoreDepositos(true);
            await Promise.all([
                carregarHistoricoTFL(dataInicioSQL, dataFimSQL, 1, true),
                carregarDepositos(dataInicioSQL, dataFimSQL, 1, true)
            ]);
        } catch (err: any) {
            console.error(err);
            toast({ message: err.message || 'Erro ao carregar dados', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [supabase, lojaSelecionada, mesReferencia, filtroTipo, dataInicio, dataFim, toast]);

    // ------------------------------------------------------------------
    // Carregar histórico TFL com paginação
    // ------------------------------------------------------------------
    const carregarHistoricoTFL = useCallback(async (dataInicioSQL: string, dataFimSQL: string, page: number, reset: boolean = false) => {
        if (!lojaSelecionada) return;
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await supabase
            .from('vw_historico_tfl_conciliacao')
            .select('*', { count: 'exact' })
            .eq('loja_id', lojaSelecionada)
            .gte('data_turno', dataInicioSQL)
            .lte('data_turno', dataFimSQL)
            .order('data_turno', { ascending: false })
            .range(from, to);

        if (error) throw error;

        if (reset) {
            setHistoricoTFL(data || []);
            setPageTFL(1);
        } else {
            setHistoricoTFL(prev => [...prev, ...(data || [])]);
        }
        setHasMoreTFL(count !== null && (page * PAGE_SIZE) < count);
    }, [supabase, lojaSelecionada]);

    // ------------------------------------------------------------------
    // Carregar depósitos com paginação
    // ------------------------------------------------------------------
    const carregarDepositos = useCallback(async (dataInicioSQL: string, dataFimSQL: string, page: number, reset: boolean = false) => {
        if (!lojaSelecionada) return;
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await supabase
            .from('depositos_conciliacao')
            .select('id, valor, data_deposito, observacoes, usuario_id', { count: 'exact' })
            .eq('loja_id', lojaSelecionada)
            .gte('data_deposito', dataInicioSQL)
            .lte('data_deposito', dataFimSQL)
            .order('data_deposito', { ascending: false })
            .range(from, to);

        if (error) throw error;

        let dataEnriched = data || [];
        if (dataEnriched.length > 0) {
            const userIds = [...new Set(dataEnriched.map(d => d.usuario_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: usuarios } = await supabase
                    .from('usuarios')
                    .select('id, nome')
                    .in('id', userIds);
                const userMap = Object.fromEntries((usuarios || []).map(u => [u.id, u.nome]));
                dataEnriched = dataEnriched.map(d => ({
                    ...d,
                    usuario_nome: userMap[d.usuario_id] || 'Sistema'
                }));
            } else {
                dataEnriched = dataEnriched.map(d => ({ ...d, usuario_nome: 'Sistema' }));
            }
        }

        if (reset) {
            setDepositosDetalhes(dataEnriched);
            setPageDepositos(1);
        } else {
            setDepositosDetalhes(prev => [...prev, ...dataEnriched]);
        }
        setHasMoreDepositos(count !== null && (page * PAGE_SIZE) < count);
    }, [supabase, lojaSelecionada]);

    // ------------------------------------------------------------------
    // Ações de paginação (carregar mais)
    // ------------------------------------------------------------------
    const carregarMaisTFL = useCallback(async () => {
        if (loadingMoreTFL || !hasMoreTFL) return;
        setLoadingMoreTFL(true);
        try {
            let dataInicioSQL, dataFimSQL;
            if (filtroTipo === 'mes') {
                dataInicioSQL = `${mesReferencia}-01`;
                const [ano, mes] = mesReferencia.split('-');
                const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
                dataFimSQL = `${mesReferencia}-${ultimoDia}`;
            } else {
                if (!dataInicio || !dataFim) return;
                dataInicioSQL = dataInicio;
                dataFimSQL = dataFim;
            }
            const nextPage = pageTFL + 1;
            await carregarHistoricoTFL(dataInicioSQL, dataFimSQL, nextPage, false);
            setPageTFL(nextPage);
        } finally {
            setLoadingMoreTFL(false);
        }
    }, [loadingMoreTFL, hasMoreTFL, pageTFL, filtroTipo, mesReferencia, dataInicio, dataFim, carregarHistoricoTFL]);

    const carregarMaisDepositos = useCallback(async () => {
        if (loadingMoreDepositos || !hasMoreDepositos) return;
        setLoadingMoreDepositos(true);
        try {
            let dataInicioSQL, dataFimSQL;
            if (filtroTipo === 'mes') {
                dataInicioSQL = `${mesReferencia}-01`;
                const [ano, mes] = mesReferencia.split('-');
                const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
                dataFimSQL = `${mesReferencia}-${ultimoDia}`;
            } else {
                if (!dataInicio || !dataFim) return;
                dataInicioSQL = dataInicio;
                dataFimSQL = dataFim;
            }
            const nextPage = pageDepositos + 1;
            await carregarDepositos(dataInicioSQL, dataFimSQL, nextPage, false);
            setPageDepositos(nextPage);
        } finally {
            setLoadingMoreDepositos(false);
        }
    }, [loadingMoreDepositos, hasMoreDepositos, pageDepositos, filtroTipo, mesReferencia, dataInicio, dataFim, carregarDepositos]);

    // ------------------------------------------------------------------
    // Filtros client-side de depósitos
    // ------------------------------------------------------------------
    useEffect(() => {
        let filtered = [...depositosDetalhes];
        if (filtroDepositoDataInicio) filtered = filtered.filter(d => d.data_deposito >= filtroDepositoDataInicio);
        if (filtroDepositoDataFim) filtered = filtered.filter(d => d.data_deposito <= filtroDepositoDataFim);
        if (filtroValorMin) {
            const min = parseFloat(filtroValorMin);
            if (!isNaN(min)) filtered = filtered.filter(d => d.valor >= min);
        }
        setDepositosFiltrados(filtered);
    }, [depositosDetalhes, filtroDepositoDataInicio, filtroDepositoDataFim, filtroValorMin]);

    // ------------------------------------------------------------------
    // Filtro por dia no histórico TFL (client-side, com debounce)
    // ------------------------------------------------------------------
    const historicoTFLFiltrado = useMemo(() => {
        if (!debouncedFiltroDia) return historicoTFL;
        return historicoTFL.filter(item => item.data_turno === debouncedFiltroDia);
    }, [historicoTFL, debouncedFiltroDia]);

    // ------------------------------------------------------------------
    // Efeitos de carregamento inicial e reação a mudanças de filtro
    // ------------------------------------------------------------------
    useEffect(() => { carregarLojas(); }, [carregarLojas]);

    // Quando loja, mês ou período personalizado mudar, recarregar tudo
    useEffect(() => {
        if (lojaSelecionada && !initialLoad) {
            buscarDadosConciliacao(false);
        }
    }, [lojaSelecionada, mesReferencia, filtroTipo, dataInicio, dataFim, initialLoad, buscarDadosConciliacao]);

    // ------------------------------------------------------------------
    // Handlers de UI
    // ------------------------------------------------------------------
    const limparFiltrosPrincipais = () => {
        if (lojas.length > 0) setLojaSelecionada(lojas[0].id);
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        setMesReferencia(mesAtual);
        setDataInicio('');
        setDataFim('');
        setFiltroTipo('mes');
        setFiltroDepositoDataInicio('');
        setFiltroDepositoDataFim('');
        setFiltroValorMin('');
        setFiltroTFLDia('');
        setAbaAtiva('tfl');
    };

    const handleAtualizar = () => {
        if (filtroTipo === 'periodo' && (!dataInicio || !dataFim)) {
            toast({ message: 'Preencha as datas de início e fim para o período personalizado', type: 'warning' });
            return;
        }
        buscarDadosConciliacao(true);
    };

    if (initialLoad || (loading && !totalEntradas && !totalDepositado && lojaSelecionada)) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
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
                <div className="flex gap-2">
                    <button onClick={handleAtualizar} disabled={refreshing} className="btn btn-ghost btn-sm">
                        {refreshing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                        Atualizar
                    </button>
                    <button onClick={limparFiltrosPrincipais} className="btn btn-ghost btn-sm">
                        <X size={14} /> Limpar filtros
                    </button>
                </div>
            </div>

            {/* Filtros principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Filial</label>
                    <select value={lojaSelecionada} onChange={e => setLojaSelecionada(e.target.value)} className="input w-full">
                        {lojas.map(loja => <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Tipo de Filtro</label>
                    <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)} className="input w-full">
                        <option value="mes">Mês de Referência</option>
                        <option value="periodo">Período Personalizado</option>
                    </select>
                </div>
            </div>

            {filtroTipo === 'mes' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase">Mês de Referência</label>
                        <input type="month" value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} className="input w-full" />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase">Data Início</label>
                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input w-full" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase">Data Fim</label>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input w-full" />
                    </div>
                </div>
            )}

            {/* Cards de Resumo */}
            {lojaSelecionada && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card p-4 bg-success/5 border-success/20">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={16} className="text-success" />
                                <p className="text-[10px] font-bold text-success uppercase">Entradas Líquidas (Auditadas)</p>
                            </div>
                            <p className="text-2xl font-bold text-success">{formatarMoeda(totalEntradas)}</p>
                            <p className="text-[10px] text-muted mt-2">Valor total que não foi para o cofre (entradas - cofre)</p>
                        </div>
                        <div className="card p-4 bg-primary-blue-light/5 border-primary-blue-light/20">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowDownCircle size={16} className="text-primary-blue-light" />
                                <p className="text-[10px] font-bold text-primary-blue-light uppercase">Depósitos Recebidos</p>
                            </div>
                            <p className="text-2xl font-bold text-primary-blue-light">{formatarMoeda(totalDepositado)}</p>
                            <p className="text-[10px] text-muted mt-2">{depositosDetalhes.length} {depositosDetalhes.length === 1 ? 'depósito' : 'depósitos'} no período</p>
                        </div>
                        <div className="card p-4 bg-yellow-500/5 border-yellow-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Smartphone size={16} className="text-yellow-500" />
                                <p className="text-[10px] font-bold text-yellow-500 uppercase">PIX Externo (Jogos avulsos)</p>
                            </div>
                            <p className="text-2xl font-bold text-yellow-500">{formatarMoeda(totalPixExterno)}</p>
                            <p className="text-[10px] text-muted mt-2">Total de PIX recebidos fora do sistema no período</p>
                        </div>
                    </div>

                    {/* Abas */}
                    <div className="flex gap-1 bg-surface-subtle rounded-xl p-1">
                        <button onClick={() => setAbaAtiva('tfl')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === 'tfl' ? 'bg-bg-card text-text-primary shadow' : 'text-muted hover:text-text-primary'}`}>
                            Entradas TFL
                        </button>
                        <button onClick={() => setAbaAtiva('depositos')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === 'depositos' ? 'bg-bg-card text-text-primary shadow' : 'text-muted hover:text-text-primary'}`}>
                            Depósitos Bancários
                        </button>
                    </div>

                    {/* Aba TFL */}
                    {abaAtiva === 'tfl' && (
                        <div className="card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <History size={18} className="text-success" />
                                    Histórico de Entradas TFL (Auditadas)
                                </h2>
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-muted" />
                                    <input type="date" value={filtroTFLDia} onChange={e => setFiltroTFLDia(e.target.value)} className="input text-sm w-40" placeholder="Filtrar por dia" />
                                    {filtroTFLDia && <button onClick={() => setFiltroTFLDia('')} className="btn btn-ghost btn-sm p-1"><X size={14} /></button>}
                                </div>
                            </div>
                            {historicoTFLFiltrado.length === 0 ? (
                                <p className="text-center text-muted text-sm py-8">
                                    {historicoTFL.length === 0 ? 'Nenhum fechamento aprovado no período.' : 'Nenhum fechamento encontrado para o dia selecionado.'}
                                </p>
                            ) : (
                                <>
                                    <TFLTable data={historicoTFLFiltrado} formatarMoeda={formatarMoeda} formatarData={formatarData} />
                                    {hasMoreTFL && (
                                        <div className="flex justify-center mt-4">
                                            <button onClick={carregarMaisTFL} disabled={loadingMoreTFL} className="btn btn-ghost btn-sm">
                                                {loadingMoreTFL ? <Loader2 className="animate-spin" size={14} /> : 'Carregar mais'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Aba Depósitos */}
                    {abaAtiva === 'depositos' && (
                        <div className="card p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <History size={18} className="text-primary-blue-light" />
                                Histórico de Depósitos
                            </h2>
                            <div className="mb-4 p-4 rounded-xl bg-surface-subtle border border-border">
                                <div className="flex items-center gap-2 mb-3">
                                    <Filter size={16} className="text-primary-blue-light" />
                                    <h3 className="text-sm font-bold">Filtrar Depósitos</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Início</label>
                                        <input type="date" value={filtroDepositoDataInicio} onChange={e => setFiltroDepositoDataInicio(e.target.value)} className="input w-full text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Fim</label>
                                        <input type="date" value={filtroDepositoDataFim} onChange={e => setFiltroDepositoDataFim(e.target.value)} className="input w-full text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Valor Mínimo (R$)</label>
                                        <input type="number" step="0.01" value={filtroValorMin} onChange={e => setFiltroValorMin(e.target.value)} className="input w-full text-sm" placeholder="Ex: 1000" />
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={() => { setFiltroDepositoDataInicio(''); setFiltroDepositoDataFim(''); setFiltroValorMin(''); }} className="btn btn-ghost w-full text-sm">
                                            <X size={12} /> Limpar Filtros
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted mt-3">Exibindo {depositosFiltrados.length} de {depositosDetalhes.length} depósitos</p>
                            </div>
                            {depositosFiltrados.length === 0 ? (
                                <p className="text-center text-muted text-sm py-8">Nenhum depósito corresponde aos filtros aplicados.</p>
                            ) : (
                                <>
                                    <DepositosTable data={depositosFiltrados} formatarMoeda={formatarMoeda} formatarData={formatarData} />
                                    {hasMoreDepositos && (
                                        <div className="flex justify-center mt-4">
                                            <button onClick={carregarMaisDepositos} disabled={loadingMoreDepositos} className="btn btn-ghost btn-sm">
                                                {loadingMoreDepositos ? <Loader2 className="animate-spin" size={14} /> : 'Carregar mais'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
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
