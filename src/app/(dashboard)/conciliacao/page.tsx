'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader as Loader2, TrendingUp, Smartphone, Banknote, RefreshCw, ListFilter as Filter, CircleArrowDown as ArrowDownCircle, X, Wallet, History } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

interface Loja {
    id: string;
    nome_fantasia: string;
}

interface ResumoConciliacao {
    saldo_inicial: number;
    total_entradas_pix: number;
    total_entradas_dinheiro: number;
    total_entradas_bolao_pix: number;
    total_entradas_bolao_dinheiro: number;
    total_entradas_geral: number;
    total_enviado_cofre: number;
    total_depositado: number;
    saldo_esperado_cofre: number;
    saldo_real_cofre: number;
    diferenca: number;
    total_fechamentos: number;
    total_aprovados: number;
    total_pendentes: number;
}

interface DepositoCofre {
    id: number;
    valor: number;
    data_movimentacao: string;
    observacoes: string;
    banco_nome: string;
    conta_nome: string;
    operador_nome: string;
}

export default function ConciliacaoPage() {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [lojas, setLojas] = useState<Loja[]>([]);

    const [lojaSelecionada, setLojaSelecionada] = useState('');
    const [mesReferencia, setMesReferencia] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [resumo, setResumo] = useState<ResumoConciliacao | null>(null);
    const [depositos, setDepositos] = useState<DepositoCofre[]>([]);

    // Filtros para histórico de depósitos
    const [filtroDepositoDataInicio, setFiltroDepositoDataInicio] = useState('');
    const [filtroDepositoDataFim, setFiltroDepositoDataFim] = useState('');
    const [filtroBanco, setFiltroBanco] = useState('');
    const [filtroOperador, setFiltroOperador] = useState('');
    const [depositosFiltrados, setDepositosFiltrados] = useState<DepositoCofre[]>([]);

    // Carregar lojas do usuário (múltiplas filiais)
    const carregarLojas = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setInitialLoad(false);
                setLoading(false);
                return;
            }

            // Buscar o usuário com suas permissões de acesso às empresas
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

            // Colecionar todos os IDs das lojas que o usuário tem acesso
            let lojaIds: string[] = [];
            
            // Adicionar a empresa principal
            if (userData?.empresa_id) {
                lojaIds.push(userData.empresa_id);
            }
            
            // Adicionar empresas adicionais do array acesso_empresas
            if (userData?.acesso_empresas && Array.isArray(userData.acesso_empresas)) {
                lojaIds.push(...userData.acesso_empresas);
            }
            
            // Remover duplicatas
            lojaIds = [...new Set(lojaIds)];
            
            if (lojaIds.length === 0) {
                setInitialLoad(false);
                setLoading(false);
                return;
            }
            
            // Buscar dados das empresas
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
                
                // Selecionar a primeira loja por padrão se ainda não tiver selecionada
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


    // Buscar resumo da conciliação consolidado (todas as contas da loja)
    const buscarResumo = useCallback(async () => {
        if (!lojaSelecionada || !mesReferencia) return;

        setLoading(true);
        try {
            const dataInicio = `${mesReferencia}-01`;
            const dataFim = `${mesReferencia}-31`;

            // Buscar todas as transferências de cofre para banco do mês
            const { data: depositosData, error: depositosError } = await supabase
                .from('cofre_movimentacoes')
                .select(`
                    id,
                    valor,
                    data_movimentacao,
                    observacoes,
                    usuario_id,
                    conta_bancaria_destino_id,
                    financeiro_contas_bancarias!cofre_movimentacoes_conta_bancaria_destino_id_fkey (
                        nome,
                        banco_id,
                        financeiro_bancos (
                            nome
                        )
                    ),
                    usuarios (
                        nome_completo
                    )
                `)
                .eq('loja_id', lojaSelecionada)
                .eq('tipo', 'transferencia_banco')
                .gte('data_movimentacao', dataInicio)
                .lte('data_movimentacao', dataFim)
                .order('data_movimentacao', { ascending: false });

            if (depositosError) throw depositosError;

            // Formatar depósitos
            const depositosFormatados: DepositoCofre[] = (depositosData || []).map((dep: any) => ({
                id: dep.id,
                valor: dep.valor,
                data_movimentacao: dep.data_movimentacao,
                observacoes: dep.observacoes || '',
                banco_nome: dep.financeiro_contas_bancarias?.financeiro_bancos?.nome || 'N/A',
                conta_nome: dep.financeiro_contas_bancarias?.nome || 'N/A',
                operador_nome: dep.usuarios?.nome_completo || 'Sistema'
            }));

            setDepositos(depositosFormatados);

            // Calcular totais para o resumo
            const totalDepositado = depositosFormatados.reduce((sum, dep) => sum + dep.valor, 0);

            // Buscar total de entradas do mês (fechamentos de caixa aprovados)
            const { data: fechamentosData } = await supabase
                .from('caixa_fechamentos')
                .select('total_entradas_pix, total_entradas_dinheiro, total_bolao_pix, total_bolao_dinheiro')
                .eq('loja_id', lojaSelecionada)
                .eq('status', 'aprovado')
                .gte('data_fechamento', dataInicio)
                .lte('data_fechamento', dataFim);

            let totalEntradasPix = 0;
            let totalEntradasDinheiro = 0;
            let totalBolaPix = 0;
            let totalBolaDinheiro = 0;

            if (fechamentosData) {
                fechamentosData.forEach(f => {
                    totalEntradasPix += f.total_entradas_pix || 0;
                    totalEntradasDinheiro += f.total_entradas_dinheiro || 0;
                    totalBolaPix += f.total_bolao_pix || 0;
                    totalBolaDinheiro += f.total_bolao_dinheiro || 0;
                });
            }

            const totalEntradas = totalEntradasPix + totalEntradasDinheiro + totalBolaPix + totalBolaDinheiro;

            // Montar resumo simplificado
            const resumoCalculado: ResumoConciliacao = {
                saldo_inicial: 0,
                total_entradas_pix: totalEntradasPix + totalBolaPix,
                total_entradas_dinheiro: totalEntradasDinheiro + totalBolaDinheiro,
                total_entradas_bolao_pix: totalBolaPix,
                total_entradas_bolao_dinheiro: totalBolaDinheiro,
                total_entradas_geral: totalEntradas,
                total_enviado_cofre: 0,
                total_depositado: totalDepositado,
                saldo_esperado_cofre: 0,
                saldo_real_cofre: 0,
                diferenca: 0,
                total_fechamentos: fechamentosData?.length || 0,
                total_aprovados: fechamentosData?.length || 0,
                total_pendentes: 0
            };

            setResumo(resumoCalculado);

        } catch (err: any) {
            console.error('Erro ao buscar resumo:', err);
            toast({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [supabase, lojaSelecionada, mesReferencia, toast]);

    useEffect(() => {
        carregarLojas();
    }, [carregarLojas]);

    useEffect(() => {
        if (lojaSelecionada && mesReferencia && !initialLoad) {
            buscarResumo();
        }
    }, [lojaSelecionada, mesReferencia, initialLoad, buscarResumo]);

    // Aplicar filtros nos depósitos
    useEffect(() => {
        let filtered = [...depositos];

        if (filtroDepositoDataInicio) {
            filtered = filtered.filter(d => {
                return new Date(d.data_movimentacao) >= new Date(filtroDepositoDataInicio);
            });
        }

        if (filtroDepositoDataFim) {
            filtered = filtered.filter(d => {
                return new Date(d.data_movimentacao) <= new Date(filtroDepositoDataFim + 'T23:59:59');
            });
        }

        if (filtroBanco) {
            filtered = filtered.filter(d =>
                d.banco_nome.toLowerCase().includes(filtroBanco.toLowerCase())
            );
        }

        if (filtroOperador) {
            filtered = filtered.filter(d =>
                d.operador_nome.toLowerCase().includes(filtroOperador.toLowerCase())
            );
        }

        setDepositosFiltrados(filtered);
    }, [depositos, filtroDepositoDataInicio, filtroDepositoDataFim, filtroBanco, filtroOperador]);


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

    if (initialLoad || (loading && !resumo && lojaSelecionada)) {
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
                        <p className="text-xs text-muted">Visão consolidada de entradas, cofre e depósitos realizados</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={buscarResumo} className="btn btn-ghost btn-sm">
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
            </div>

            {/* Filtros */}
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
                    <label className="text-[10px] font-bold text-muted uppercase">Mês de Referência</label>
                    <input
                        type="month"
                        value={mesReferencia}
                        onChange={e => setMesReferencia(e.target.value)}
                        className="input w-full"
                    />
                </div>
            </div>

            {/* Cards de Resumo */}
            {resumo ? (
                <>
                    {/* Cards Principais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card p-4 bg-success/5 border-success/20">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={16} className="text-success" />
                                <p className="text-[10px] font-bold text-success uppercase">Total de Entradas Auditadas (TFL)</p>
                            </div>
                            <p className="text-2xl font-bold text-success">{formatarMoeda(resumo.total_entradas_geral)}</p>
                            <div className="text-xs text-muted mt-2">
                                <div className="flex justify-between">
                                    <span className="inline-flex items-center gap-1"><Smartphone size={10} /> PIX:</span>
                                    <span className="font-bold">{formatarMoeda(resumo.total_entradas_pix)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="inline-flex items-center gap-1"><Banknote size={10} /> Dinheiro:</span>
                                    <span className="font-bold">{formatarMoeda(resumo.total_entradas_dinheiro)}</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted mt-2">
                                {resumo.total_aprovados} fechamentos aprovados
                            </p>
                        </div>

                        <div className="card p-4 bg-primary-blue-light/5 border-primary-blue-light/20">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowDownCircle size={16} className="text-primary-blue-light" />
                                <p className="text-[10px] font-bold text-primary-blue-light uppercase">Depósitos Recebidos</p>
                            </div>
                            <p className="text-2xl font-bold text-primary-blue-light">{formatarMoeda(resumo.total_depositado)}</p>
                            <p className="text-[10px] text-muted mt-2">
                                {depositos.length} {depositos.length === 1 ? 'depósito registrado' : 'depósitos registrados'} no mês
                            </p>
                            <p className="text-[10px] text-muted mt-1">
                                Valores debitados do cofre e depositados em contas bancárias
                            </p>
                        </div>
                    </div>

                    {/* Histórico de Depósitos Recebidos */}
                    {depositos.length > 0 && (
                        <div className="card p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <History size={18} className="text-primary-blue-light" />
                                Histórico de Depósitos Recebidos
                            </h2>

                            {/* Filtros do Histórico */}
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
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Banco</label>
                                        <input
                                            type="text"
                                            value={filtroBanco}
                                            onChange={e => setFiltroBanco(e.target.value)}
                                            placeholder="Filtrar por banco..."
                                            className="input w-full text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Operador</label>
                                        <input
                                            type="text"
                                            value={filtroOperador}
                                            onChange={e => setFiltroOperador(e.target.value)}
                                            placeholder="Filtrar por operador..."
                                            className="input w-full text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-[10px] text-muted">
                                        Exibindo {depositosFiltrados.length} de {depositos.length} depósitos
                                    </p>
                                    <button
                                        onClick={() => {
                                            setFiltroDepositoDataInicio('');
                                            setFiltroDepositoDataFim('');
                                            setFiltroBanco('');
                                            setFiltroOperador('');
                                        }}
                                        className="btn btn-ghost btn-sm text-xs"
                                    >
                                        <X size={12} /> Limpar Filtros
                                    </button>
                                </div>
                            </div>

                            {/* Tabela de Depósitos */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Data</th>
                                            <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Conta de Destino</th>
                                            <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">Valor</th>
                                            <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Observações</th>
                                            <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Registrado por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {depositosFiltrados.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-muted text-sm">
                                                    {depositos.length === 0 ? 'Nenhum depósito registrado' : 'Nenhum depósito corresponde aos filtros aplicados'}
                                                </td>
                                            </tr>
                                        ) : (
                                            depositosFiltrados.map((dep) => (
                                                <tr key={dep.id} className="border-b border-border/50 hover:bg-surface-subtle transition-colors">
                                                    <td className="py-3 px-2 text-sm">{formatarData(dep.data_movimentacao)}</td>
                                                    <td className="py-3 px-2 text-sm">{dep.banco_nome} - {dep.conta_nome}</td>
                                                    <td className="py-3 px-2 text-right font-bold text-success text-sm">{formatarMoeda(dep.valor)}</td>
                                                    <td className="py-3 px-2 text-muted text-sm">{dep.observacoes || '-'}</td>
                                                    <td className="py-3 px-2 text-muted text-sm">{dep.operador_nome || 'Sistema'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="card p-12 text-center">
                    <Wallet size={48} className="mx-auto mb-4 text-muted opacity-50" />
                    <p className="text-muted">Selecione uma filial e mês para visualizar a conciliação</p>
                </div>
            )}
        </div>
    );
}
