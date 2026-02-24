'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Pencil,
    Trash2,
    TrendingUp,
    TrendingDown,
    DollarSign,
    BarChart3,
    Scale,
    AlertCircle,
    Plus,
    X,
    Calendar,
    RefreshCcw,
    CheckCircle2,
    Loader2,
    FileText,
    Printer,
    Copy
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { FinancialGrowthChart } from './FinancialGrowthChart';
import { ReplicarUltimoMesModal } from './ReplicarUltimoMesModal';
import { ModalBaixaFinanceira } from './ModalBaixaFinanceira';
import { useFinanceiro, TransacaoFinanceira } from '@/hooks/useFinanceiro';
import { useItensFinanceiros } from '@/hooks/useItensFinanceiros';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil';
import { PageHeader } from '@/components/ui/PageHeader';
import { KPICard } from '@/components/ui/KPICard';
import { LoadingState } from '@/components/ui/LoadingState';
import { useParametros } from '@/hooks/useParametros';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';


type Aba = 'receitas' | 'despesas' | 'fechamento';

export function VisaoGestor() {
    const { transacoes, resumo, loading, fetchTransacoes, fetchAnosDisponiveis, salvarTransacao, darBaixa, atualizarTransacao, excluirTransacao } = useFinanceiro();
    const { itens: categorias, atualizarItem, fetchItens } = useItensFinanceiros();
    const { getParametro } = useParametros();

    const { lojaAtual, lojasDisponiveis, setLojaAtual } = useLoja();
    const { isAdmin } = usePerfil();

    const { toast } = useToast();
    const confirm = useConfirm();

    // Filtros
    const [ano, setAno] = useState(new Date().getFullYear());
    const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([new Date().getFullYear()]);
    const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1); // 1-12 (Padrão: Mês Atual)
    const [visualizacaoAnual, setVisualizacaoAnual] = useState(false); // Toggle Ano Completo

    // UI State
    const [abaAtiva, setAbaAtiva] = useState<Aba>('receitas');
    const [showModal, setShowModal] = useState(false);
    const [showReplicarModal, setShowReplicarModal] = useState(false); // Novo Estado
    const [modalType, setModalType] = useState<'receita' | 'despesa'>('receita');
    const [processing, setProcessing] = useState(false);
    const [modalBaixaOpen, setModalBaixaOpen] = useState(false);
    const [transacaoParaBaixa, setTransacaoParaBaixa] = useState<TransacaoFinanceira | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<TransacaoFinanceira | null>(null);

    // Form Data
    const [formData, setFormData] = useState({
        descricao: '',
        valor: 0,
        item: '',
        vencimento: new Date().toISOString().split('T')[0],
        recorrente: false,
        frequencia: 'mensal',
        observacao: '',
        loja_id: lojaAtual?.id || '',
        modalidade: 'VARIAVEL' as 'FIXO_MENSAL' | 'FIXO_VARIAVEL' | 'VARIAVEL'
    });

    // Auto-preenchimento inteligente ao mudar o item
    const handleItemChange = (itemNome: string) => {
        const cat = categorias.find(c => c.item === itemNome);
        if (cat) {
            setFormData(prev => {
                const newData: typeof prev = { ...prev, item: itemNome, modalidade: cat.tipo_recorrencia || 'VARIAVEL' };

                // Se a descrição estiver vazia ou for igual ao item anterior, assume o novo nome
                const lastItem = categorias.find(c => c.item === prev.item);
                if (!prev.descricao || prev.descricao === lastItem?.item) {
                    newData.descricao = cat.item;
                }

                // Se for item fixo e tiver valor padrão
                if (cat.fixo && cat.valor_padrao) {
                    newData.valor = cat.valor_padrao;
                }

                // Sugerir vencimento se tiver dia padrão
                if (cat.dia_vencimento) {
                    const d = new Date();
                    d.setDate(cat.dia_vencimento);
                    newData.vencimento = d.toISOString().split('T')[0];
                }

                return newData;
            });
        } else {
            setFormData({ ...formData, item: itemNome });
        }
    };

    useEffect(() => {
        // Sempre busca o ano todo para ter o gráfico completo
        fetchTransacoes(ano, 0, lojaAtual?.id || null);
        fetchItens(lojaAtual?.id || null);

        // Buscar anos disponíveis para o filtro
        fetchAnosDisponiveis(lojaAtual?.id || null).then(anos => {
            if (anos.length > 0) {
                setAnosDisponiveis(anos);
            }
        });
    }, [ano, lojaAtual?.id, fetchTransacoes, fetchAnosDisponiveis]);

    // Filtragem Local baseada no Período (Mês ou Ano)
    const transacoesDoPeriodo = useMemo(() => {
        return transacoes.filter(t => {
            const parts = t.data_vencimento.split('-');
            const tAno = parseInt(parts[0]);
            if (tAno !== ano) return false;

            if (visualizacaoAnual) return true;

            const tMes = parseInt(parts[1]);
            return tMes === mesSelecionado;
        });
    }, [transacoes, ano, mesSelecionado, visualizacaoAnual]);

    // Lista Filtrada para a Tabela (Período + Aba)
    const filteredList = useMemo(() => {
        return transacoesDoPeriodo.filter(t => {
            if (abaAtiva === 'receitas' && t.tipo !== 'receita') return false;
            if (abaAtiva === 'despesas' && t.tipo !== 'despesa') return false;
            return true;
        });
    }, [transacoesDoPeriodo, abaAtiva]);

    // Resumo Calculado Dinamicamente para os KPIs
    const resumoCalculado = useMemo(() => {
        const receitas = transacoesDoPeriodo.filter(t => t.tipo === 'receita');
        const despesas = transacoesDoPeriodo.filter(t => t.tipo === 'despesa');

        const sum = (list: any[]) => list.reduce((acc, t) => acc + t.valor, 0);
        const byCategory = (list: any[]) => {
            const map = new Map<string, number>();
            list.forEach(i => {
                const val = map.get(i.item) || 0;
                map.set(i.item, val + i.valor);
            });
            return Array.from(map.entries()).map(([k, v]) => ({ item: k, total: v }));
        };

        return {
            receitas: sum(receitas),
            despesas: sum(despesas),
            detalheReceitas: byCategory(receitas),
            detalheDespesas: byCategory(despesas)
        };
    }, [transacoesDoPeriodo]);

    // Preparar dados para o Gráfico (Ano Todo)
    const chartData = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const monthName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i];

        const monthTransacoes = transacoes.filter(t => {
            const m = parseInt(t.data_vencimento.split('-')[1]);
            const isType = abaAtiva === 'receitas' ? t.tipo === 'receita' : t.tipo === 'despesa';
            return m === monthNum && isType;
        });

        // Se está vendo uma loja específica, dado simples
        if (lojaAtual) {
            return {
                month: monthName,
                value: monthTransacoes.reduce((acc, curr) => acc + curr.valor, 0),
                fullLabel: new Date(ano, i, 1).toLocaleString('pt-BR', { month: 'long' })
            };
        }

        // Se está vendo "Todas", agrupa por loja para o gráfico
        const dataPoint: any = {
            month: monthName,
            fullLabel: new Date(ano, i, 1).toLocaleString('pt-BR', { month: 'long' }),
            value: monthTransacoes.reduce((acc, curr) => acc + curr.valor, 0) // Total ainda útil para fallback
        };

        lojasDisponiveis.forEach(loja => {
            const totalLoja = monthTransacoes
                .filter(t => t.loja_id === loja.id)
                .reduce((acc, curr) => acc + curr.valor, 0);
            dataPoint[`loja_${loja.id}`] = totalLoja;
        });

        return dataPoint;
    });

    // Definir séries para o gráfico (apenas se for multi-loja)
    const chartSeries = !lojaAtual ? lojasDisponiveis.map((loja, idx) => {
        const colors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981'];
        return {
            key: `loja_${loja.id}`,
            label: loja.nome_fantasia,
            color: colors[idx % colors.length]
        };
    }) : undefined;

    const handleOpenModalNew = (tipo: 'receita' | 'despesa') => {
        setModalType(tipo);
        setEditingTransaction(null);
        setFormData({
            descricao: '',
            valor: 0,
            item: '',
            vencimento: new Date().toISOString().split('T')[0],
            recorrente: false,
            frequencia: 'mensal',
            observacao: '',
            loja_id: lojaAtual?.id || '',
            modalidade: 'VARIAVEL'
        });
        setShowModal(true);
    };

    const handleEditClick = (t: TransacaoFinanceira) => {
        setEditingTransaction(t);
        setModalType(t.tipo);
        // Buscar modalidade da categoria vinculada
        let cat = categorias.find(c => c.id === t.item_financeiro_id);
        if (!cat) cat = categorias.find(c => c.item === t.item);
        setFormData({
            descricao: t.descricao,
            valor: t.valor,
            item: t.item,
            vencimento: t.data_vencimento,
            recorrente: t.recorrente,
            frequencia: t.frequencia || 'mensal',
            observacao: '',
            loja_id: t.loja_id || lojaAtual?.id || '',
            modalidade: t.recorrente
                ? (t.frequencia === 'mensal' ? 'FIXO_MENSAL' : t.frequencia === 'mensal_variavel' ? 'FIXO_VARIAVEL' : 'FIXO_MENSAL')
                : 'VARIAVEL'
        });
        setShowModal(true);
    };

    const handleDeleteClick = async (t: TransacaoFinanceira) => {
        const confirmed = await confirm({
            title: 'Excluir Lançamento',
            description: `Deseja realmente excluir "${t.descricao}"? Esta ação removerá o lançamento do banco de dados permanentemente.`,
            variant: 'danger',
            confirmLabel: 'Excluir Lançamento'
        });

        if (!confirmed) return;

        try {
            await excluirTransacao(t.id);
            toast({ message: 'Lançamento excluído com sucesso!', type: 'success' });
            fetchTransacoes(ano, 0, lojaAtual?.id || null);
        } catch (error: any) {
            toast({ message: 'Erro ao excluir: ' + error.message, type: 'error' });
        }
    };

    const handleSave = async () => {
        try {
            // Validação de Filial se estiver em modo "Todas"
            if (!formData.loja_id) {
                toast({
                    message: "⚠️ Por favor, selecione a Filial para este lançamento.",
                    type: 'error'
                });
                return;
            }

            setProcessing(true);

            // 1. Vincular Categoria
            const catAtual = categorias.find(c => c.item === formData.item);

            // 2. Sincronizar Categoria (Modalidade) - REMOVIDO PARA SIMPLIFICAÇÃO
            // Não vamos mais alterar o cadastro do item base só porque o lançamento mudou.
            // if (catAtual && catAtual.tipo_recorrencia !== formData.modalidade) { ... }

            // Derivar recorrente/frequencia da modalidade selecionada
            const isRecorrente = formData.modalidade === 'FIXO_MENSAL' || formData.modalidade === 'FIXO_VARIAVEL';
            const freqFinal = formData.modalidade === 'FIXO_MENSAL' ? 'mensal'
                : formData.modalidade === 'FIXO_VARIAVEL' ? 'mensal_variavel'
                    : null;

            const payload = {
                tipo: modalType,
                descricao: formData.descricao,
                valor: formData.valor,
                item: formData.item,
                data_vencimento: formData.vencimento,
                recorrente: isRecorrente,
                frequencia: freqFinal,
                loja_id: formData.loja_id,
                item_financeiro_id: catAtual?.id || null,
                status: (editingTransaction?.status || 'pendente') as any,
                data_pagamento: editingTransaction?.data_pagamento || null
            };

            if (editingTransaction) {
                await atualizarTransacao(editingTransaction.id, payload);
                toast({ message: 'Lançamento atualizado com sucesso!', type: 'success' });
            } else {
                await salvarTransacao(payload);
                toast({ message: 'Lançamento registrado com sucesso!', type: 'success' });
            }

            // Fechar Modal e Limpar Estados Imediatamente
            setShowModal(false);
            setEditingTransaction(null);

            // Refreshes em background (não bloqueiam a UI)
            fetchItens(lojaAtual?.id || null);
            fetchTransacoes(ano, 0, lojaAtual?.id || null);
        } catch (error: any) {
            console.error('[FINANCEIRO] Erro ao salvar:', error);
            toast({ message: 'Erro: ' + (error.message || 'Falha na comunicação'), type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleBaixaClick = (transacao: TransacaoFinanceira) => {
        setTransacaoParaBaixa(transacao);
        setModalBaixaOpen(true);
    };

    const handleConfirmBaixa = async (dados: { dataPagamento: string; metodo: string; arquivo: File | null }) => {
        if (!transacaoParaBaixa) return;
        try {
            await darBaixa(transacaoParaBaixa.id, dados);
            toast({ message: 'Baixa realizada com sucesso!', type: 'success' });
            setModalBaixaOpen(false);
            setTransacaoParaBaixa(null);
            fetchTransacoes(ano, 0, lojaAtual?.id || null);
        } catch (error: any) {
            toast({ message: 'Erro ao dar baixa: ' + error.message, type: 'error' });
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const headers = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Status"];
        const rows = filteredList.map(t => [
            t.data_vencimento,
            t.descricao,
            t.item,
            t.tipo,
            t.valor.toFixed(2),
            t.status
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `financeiro_${ano}_${visualizacaoAnual ? 'anual' : mesSelecionado}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Cálculos de Regra de Negócio (Loteria MegaB - Dinâmico)
    const comissaoBruta = resumoCalculado.receitas;
    const totalDespesas = resumoCalculado.despesas;
    const lucroLiquidoReal = comissaoBruta - totalDespesas;

    const taxaDiretor = getParametro('divisao_diretor', 70) / 100;
    const taxaOperadores = getParametro('pool_operadores', 30) / 100;

    const cotaDiretor = comissaoBruta * taxaDiretor;
    const poolOperadores = comissaoBruta * taxaOperadores;

    // Handler para clique no gráfico (filtrar por mês)
    const handleChartClick = (monthNumber: number) => {
        if (visualizacaoAnual) return;
        setMesSelecionado(monthNumber);
    };


    return (
        <div className="financeiro-real">
            <PageHeader
                title="Gestão Financeira Real"
            >
                {/* Filtro de Filial (Apenas Admin) */}
                {isAdmin && (
                    <select
                        className="input min-w-[180px] font-bold border-accent-orange/50"
                        value={lojaAtual?.id || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                                setLojaAtual(null);
                            } else {
                                const selected = lojasDisponiveis.find(l => l.id === val);
                                if (selected) setLojaAtual(selected);
                            }
                        }}
                    >
                        <option value="">Todas as Filiais</option>
                        {lojasDisponiveis.map(loja => (
                            <option key={loja.id} value={loja.id}>Filial {loja.nome_fantasia}</option>
                        ))}
                    </select>
                )}


            </PageHeader>

            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KPICard
                    label="Receitas"
                    value={`R$ ${resumoCalculado.receitas.toLocaleString('pt-BR')}`}
                    icon={TrendingUp}
                    variant="success"
                    loading={loading}
                    trend={{ value: 'Entrada', direction: 'up', description: 'Total do período' }}
                />

                <KPICard
                    label="Custos Fixos / Variáveis"
                    value={`R$ ${resumoCalculado.despesas.toLocaleString('pt-BR')}`}
                    icon={TrendingDown}
                    variant="danger"
                    loading={loading}
                    trend={{ value: 'Saída', direction: 'down', description: 'Total do período' }}
                />

                <KPICard
                    label="Resultado Líquido"
                    value={`R$ ${lucroLiquidoReal.toLocaleString('pt-BR')}`}
                    icon={Scale}
                    variant={lucroLiquidoReal >= 0 ? 'default' : 'danger'}
                    loading={loading}
                    trend={{
                        value: lucroLiquidoReal >= 0 ? 'Lucro' : 'Prejuízo',
                        direction: lucroLiquidoReal >= 0 ? 'up' : 'down',
                        description: 'Resultado real'
                    }}
                />
            </div>

            {/* Abas */}
            <div className="flex gap-2 mb-4">
                <button className={`btn ${abaAtiva === 'receitas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAbaAtiva('receitas')}>
                    <TrendingUp size={16} /> Receitas
                </button>
                <button className={`btn ${abaAtiva === 'despesas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAbaAtiva('despesas')}>
                    <TrendingDown size={16} /> Despesas
                </button>
                <button className={`btn ${abaAtiva === 'fechamento' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAbaAtiva('fechamento')}>
                    <BarChart3 size={16} /> Fechamento (DRE)
                </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="card transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="chart-title mb-0">
                            {abaAtiva === 'receitas' ? 'Melhoria de Fluxo (Receitas)' : abaAtiva === 'despesas' ? 'Evolução de Custos (Despesas)' : 'Fechamento Consolidado (DRE)'}
                        </h3>
                        {abaAtiva !== 'fechamento' && !visualizacaoAnual && (
                            <p className="text-[10px] text-muted mt-1 flex items-center gap-1">
                                <Calendar size={10} /> Clique nas barras do gráfico para filtrar por mês
                            </p>
                        )}
                    </div>
                    {abaAtiva !== 'fechamento' && (
                        <div className="flex gap-3 items-center">
                            {/* Toggle Ano Completo */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
                                <span className="text-xs font-semibold text-muted whitespace-nowrap">
                                    Ano Completo:
                                </span>
                                <div
                                    className={`relative w-10 h-5 rounded-full cursor-pointer transition-all duration-300 ${visualizacaoAnual ? 'bg-blue-500' : 'bg-white/20'
                                        }`}
                                    onClick={() => setVisualizacaoAnual(!visualizacaoAnual)}
                                    title={visualizacaoAnual ? 'Clique para ver mês atual' : 'Clique para ver ano completo'}
                                >
                                    <div
                                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-lg ${visualizacaoAnual ? 'left-5' : 'left-0.5'
                                            }`}
                                    />
                                </div>
                            </div>

                            <div className="w-px h-6 bg-white/10" />

                            {/* Filtro de Ano */}
                            <select
                                className="input input-sm font-bold text-xs px-3 py-1"
                                value={ano}
                                onChange={e => setAno(parseInt(e.target.value))}
                                title="Selecionar ano"
                            >
                                {/* Garantir que o ano atual e o selecionado estejam na lista para não bugar o select */}
                                {[...new Set([new Date().getFullYear(), ano, ...anosDisponiveis])]
                                    .sort((a, b) => b - a)
                                    .map(anoVal => (
                                        <option key={anoVal} value={anoVal}>{anoVal}</option>
                                    ))
                                }
                            </select>

                            <div className="w-px h-6 bg-white/10" />

                            {/* Botões de Exportação/Impressão */}
                            <button className="btn btn-sm btn-ghost text-muted hover:text-white" onClick={handleExport} title="Exportar CSV">
                                <FileText size={16} />
                            </button>
                            <button className="btn btn-sm btn-ghost text-muted hover:text-white" onClick={handlePrint} title="Imprimir / Salvar PDF">
                                <Printer size={16} />
                            </button>

                            <div className="w-px h-6 bg-white/10" />

                            {/* Botão Replicar (Novo) */}
                            <button
                                className="btn btn-sm btn-ghost text-blue-300 hover:text-white border border-blue-500/20 hover:bg-blue-500/10"
                                onClick={() => setShowReplicarModal(true)}
                                title="Copiar Despesas do Mês Anterior"
                            >
                                <Copy size={14} /> Replicar Mês
                            </button>

                            <button className="btn btn-sm btn-accent" onClick={() => handleOpenModalNew(abaAtiva === 'receitas' ? 'receita' : 'despesa')}>
                                <Plus size={14} /> Novo Lançamento
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <LoadingState type="list" />
                ) : abaAtiva === 'fechamento' ? (
                    <div className="animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

                            {/* COLUNA 1: ENTRADAS */}
                            <div className="flex flex-col bg-emerald-500/5 rounded-xl border border-emerald-500/10 overflow-hidden">
                                <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/10 flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <TrendingUp size={20} />
                                        <h3 className="font-bold uppercase tracking-wider text-sm">Entradas</h3>
                                    </div>
                                    <span className="font-black text-lg text-emerald-400">
                                        R$ {resumoCalculado.receitas.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                                <div className="p-4 space-y-3 overflow-y-auto max-h-[500px] scrollbar-thin">
                                    {resumoCalculado.detalheReceitas.length === 0 ? (
                                        <p className="text-center text-muted text-xs py-10">Nenhuma entrada no período.</p>
                                    ) : (
                                        resumoCalculado.detalheReceitas.sort((a, b) => b.total - a.total).map((c, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors border border-emerald-500/5">
                                                <span className="text-sm font-medium text-emerald-100">{c.item}</span>
                                                <span className="font-bold text-emerald-400">R$ {c.total.toLocaleString('pt-BR')}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* COLUNA 2: SAÍDAS */}
                            <div className="flex flex-col bg-red-500/5 rounded-xl border border-red-500/10 overflow-hidden">
                                <div className="p-4 bg-red-500/10 border-b border-red-500/10 flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-red-400">
                                        <TrendingDown size={20} />
                                        <h3 className="font-bold uppercase tracking-wider text-sm">Saídas</h3>
                                    </div>
                                    <span className="font-black text-lg text-red-400">
                                        R$ {resumoCalculado.despesas.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                                <div className="p-4 space-y-3 overflow-y-auto max-h-[500px] scrollbar-thin">
                                    {resumoCalculado.detalheDespesas.length === 0 ? (
                                        <p className="text-center text-muted text-xs py-10">Nenhuma saída no período.</p>
                                    ) : (
                                        resumoCalculado.detalheDespesas.sort((a, b) => b.total - a.total).map((c, i) => {
                                            const catInfo = categorias.find(cat => cat.item === c.item);
                                            return (
                                                <div key={i} className="flex flex-col p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors border border-red-500/5">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-sm font-medium text-red-100">{c.item}</span>
                                                        <span className="font-bold text-red-400">R$ {c.total.toLocaleString('pt-BR')}</span>
                                                    </div>
                                                    <div className="flex justify-start">
                                                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${catInfo?.fixo
                                                            ? 'bg-indigo-500/20 text-indigo-300'
                                                            : 'bg-orange-500/20 text-orange-300'
                                                            }`}>
                                                            {catInfo?.fixo ? 'Custo Fixo' : 'Custo Variável'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* COLUNA 3: RESULTADO */}
                            <div className="flex flex-col bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                                <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-2 text-slate-200">
                                    <Scale size={20} />
                                    <h3 className="font-bold uppercase tracking-wider text-sm">Resultado Líquido</h3>
                                </div>

                                <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                                    <div className={`flex items-center justify-center w-24 h-24 rounded-full ${lucroLiquidoReal >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {lucroLiquidoReal >= 0 ? <TrendingUp size={48} /> : <TrendingDown size={48} />}
                                    </div>

                                    <div className="text-center">
                                        <p className="text-sm text-muted uppercase font-bold mb-2">Saldo do Período</p>
                                        <h2 className={`text-4xl font-black ${lucroLiquidoReal >= 0 ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
                                            R$ {Math.abs(lucroLiquidoReal).toLocaleString('pt-BR')}
                                        </h2>
                                        <p className={`text-sm font-bold mt-2 ${lucroLiquidoReal >= 0 ? 'text-emerald-500' : 'text-red-500'
                                            }`}>
                                            {lucroLiquidoReal >= 0 ? 'LUCRO OPERACIONAL' : 'PREJUÍZO OPERACIONAL'}
                                        </p>
                                    </div>

                                    {/* Indicadores Extras */}
                                    <div className="w-full grid grid-cols-2 gap-4 mt-4 pt-6 border-t border-white/5">
                                        <div className="text-center">
                                            <p className="text-[10px] text-muted uppercase">Margem</p>
                                            <p className="font-bold text-white">
                                                {resumoCalculado.receitas > 0
                                                    ? `${((lucroLiquidoReal / resumoCalculado.receitas) * 100).toFixed(1)}%`
                                                    : '0%'}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-muted uppercase">Balanço</p>
                                            <p className={`font-bold ${lucroLiquidoReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {lucroLiquidoReal >= 0 ? 'Positivo' : 'Negativo'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* CHART SECTION */}
                        <div className="mb-6 px-2">
                            <FinancialGrowthChart
                                data={chartData}
                                type={abaAtiva as 'receita' | 'despesa'}
                                year={ano}
                                series={chartSeries}
                                onBarClick={handleChartClick}
                                selectedMonth={mesSelecionado}
                                showAllMonths={visualizacaoAnual}
                            />
                        </div>

                        {/* TABLE SECTION */}
                        <div className="table-container pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-black uppercase text-muted tracking-widest">
                                    {visualizacaoAnual ? `Movimentações de ${ano} (Ano Completo)` : `Movimentações de ${new Date(ano, mesSelecionado - 1, 1).toLocaleString('pt-BR', { month: 'long' })}`}
                                </h4>
                                <span className="text-xs font-bold text-muted">
                                    {filteredList.length} registros
                                </span>
                            </div>

                            <table>
                                <thead>
                                    <tr>
                                        <th>Vencimento</th>
                                        <th>Filial</th>
                                        <th>Descrição</th>
                                        <th>Modalidade</th>
                                        <th className="text-right">Valor</th>
                                        <th className="text-center">Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredList.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-muted italic">Nenhum lançamento encontrado neste período.</td></tr>
                                    ) : filteredList.map(t => (
                                        <tr key={t.id} className="group hover:bg-white/5 transition-colors">
                                            <td className="text-xs font-mono text-muted">{t.data_vencimento.split('-').reverse().join('/')}</td>
                                            <td className="text-[10px] font-bold text-text-secondary">
                                                {lojasDisponiveis.find(l => l.id === t.loja_id)?.nome_fantasia || 'N/A'}
                                            </td>
                                            <td className="font-semibold text-sm">
                                                {t.descricao}
                                                {t.item && t.descricao !== t.item && (
                                                    <span className="block text-[10px] text-muted font-normal">{t.item}</span>
                                                )}
                                            </td>
                                            <td className="text-[10px] font-bold uppercase">
                                                {(() => {
                                                    // Ler modalidade do registro (recorrente + frequencia)
                                                    if (t.recorrente && t.frequencia === 'mensal') {
                                                        return <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md">Fixo Mensal</span>;
                                                    } else if (t.recorrente && t.frequencia === 'mensal_variavel') {
                                                        return <span className="bg-pink-500/10 text-pink-400 px-2 py-1 rounded-md">Fixo Variável</span>;
                                                    } else if (t.recorrente) {
                                                        // Legado: recorrente sem frequencia especifica, checar categoria
                                                        const cat = categorias.find(c => c.id === t.item_financeiro_id) || categorias.find(c => c.item === t.item);
                                                        if (cat?.tipo_recorrencia === 'FIXO_VARIAVEL') {
                                                            return <span className="bg-pink-500/10 text-pink-400 px-2 py-1 rounded-md">Fixo Variável</span>;
                                                        }
                                                        return <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md">Fixo Mensal</span>;
                                                    } else {
                                                        return <span className="bg-orange-500/10 text-orange-400 px-2 py-1 rounded-md">Variável</span>;
                                                    }
                                                })()}
                                            </td>
                                            <td className={`text-right font-black ${t.tipo === 'receita' ? 'text-success' : 'text-danger'}`}>
                                                R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-center">
                                                <span className={`badge ${t.status === 'pago' ? 'success' : 'warning'} text-[10px]`}>
                                                    {t.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {t.status === 'pendente' && (
                                                    <button className="btn btn-ghost btn-xs text-success hover:bg-success/20" onClick={() => handleBaixaClick(t)} title="Dar Baixa">
                                                        <CheckCircle2 size={14} />
                                                    </button>
                                                )}
                                                <button className="btn btn-ghost btn-xs text-blue-400 hover:bg-blue-400/20" onClick={() => handleEditClick(t)} title="Editar">
                                                    <Pencil size={14} />
                                                </button>
                                                <button className="btn btn-ghost btn-xs text-danger hover:bg-danger/20" onClick={() => handleDeleteClick(t)} title="Excluir">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Replicação (Novo) */}
            <ReplicarUltimoMesModal
                isOpen={showReplicarModal}
                onClose={() => setShowReplicarModal(false)}
                lojaId={lojaAtual?.id || null}
                anoAtual={ano}
                mesAtual={mesSelecionado}
                onSuccess={() => {
                    fetchTransacoes(ano, 0, lojaAtual?.id || null);
                }}
            />

            {/* Modal de Baixa */}
            <ModalBaixaFinanceira
                isOpen={modalBaixaOpen}
                onClose={() => setModalBaixaOpen(false)}
                transaction={transacaoParaBaixa}
                onConfirm={handleConfirmBaixa}
            />


            {/* Modal de Cadastro */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '1.5rem' }}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                            <h3 className="text-lg font-bold">
                                {editingTransaction ? 'Editar Lançamento' : (modalType === 'receita' ? 'Nova Receita' : 'Nova Despesa')}
                            </h3>
                            <button onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Seleção de Filial (Apenas para Admin ou visualização global) */}
                            {(isAdmin || lojasDisponiveis.length > 1) && (
                                <div className="form-group pb-2 border-b border-white/5">
                                    <label className="text-blue-400">Filial de Destino</label>
                                    <select
                                        className="input border-blue-500/30 bg-blue-500/5 font-bold"
                                        value={formData.loja_id}
                                        onChange={e => setFormData({ ...formData, loja_id: e.target.value })}
                                    >
                                        <option value="">Selecione a Filial...</option>
                                        {lojasDisponiveis.map(loja => (
                                            <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                        ))}
                                    </select>
                                    {!formData.loja_id && (
                                        <p className="text-[9px] text-danger mt-1 italic font-bold">⚠️ Campo obrigatório para lançamentos globais</p>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Descrição (Item do Catálogo)</label>
                                <div className="relative">
                                    <input
                                        className="input pr-10"
                                        list="categorias-list"
                                        value={formData.item}
                                        onChange={e => handleItemChange(e.target.value)}
                                        placeholder="Digite ou selecione..."
                                        autoComplete="off"
                                    />
                                    <datalist id="categorias-list">
                                        {categorias
                                            .filter(c => c.tipo === modalType)
                                            .map(c => (
                                                <option key={c.id} value={c.item} />
                                            ))
                                        }
                                    </datalist>
                                </div>
                                <p className="text-[10px] text-muted mt-1">
                                    Os itens acima já trazem valores e modalidades sugeridas.
                                </p>
                            </div>

                            <div className="form-group">
                                <label>Descrição Complementar (Opcional)</label>
                                <input
                                    className="input"
                                    value={formData.descricao}
                                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                    placeholder="Ex: Ref. ao conserto da porta"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label>Valor (R$)</label>
                                    <MoneyInput
                                        value={formData.valor}
                                        onValueChange={v => setFormData({ ...formData, valor: v })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Vencimento</label>
                                    <input type="date" className="input" value={formData.vencimento} onChange={e => setFormData({ ...formData, vencimento: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Tipo de Recorrência</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { key: 'FIXO_MENSAL' as const, label: 'Fixo Mensal', desc: 'Automático todo mês', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.5)', text: '#a5b4fc' },
                                        { key: 'FIXO_VARIAVEL' as const, label: 'Fixo Variável', desc: 'Todo mês, valor varia', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.5)', text: '#f9a8d4' },
                                        { key: 'VARIAVEL' as const, label: 'Variável', desc: 'Eventual / Manual', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.5)', text: '#fdba74' }
                                    ].map(opt => {
                                        const isSelected = formData.modalidade === opt.key;
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                style={isSelected ? {
                                                    background: opt.bg,
                                                    borderColor: opt.border,
                                                    color: opt.text
                                                } : {}}
                                                className={`p-2 rounded-lg border text-left transition-all text-xs ${isSelected
                                                    ? ''
                                                    : 'border-white/10 text-muted hover:border-white/20'
                                                    }`}
                                                onClick={() => setFormData({ ...formData, modalidade: opt.key })}
                                            >
                                                <span className="font-bold block">{opt.label}</span>
                                                <span className="text-[10px] opacity-70">{opt.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-muted mt-1">Alterar aqui atualiza a classificação da categoria no cadastro.</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={processing}>Cancelar</button>
                            <button className={`btn ${modalType === 'receita' ? 'btn-primary' : 'btn-danger'}`} onClick={handleSave} disabled={processing}>
                                {processing ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

