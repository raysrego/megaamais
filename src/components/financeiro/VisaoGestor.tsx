'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    Copy,
    RotateCcw
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
type StatusTransacao = 'pendente' | 'pago';

interface ExclusaoState {
    emProgresso: boolean;
    id: number | null;
    erro: string | null;
}

// Função auxiliar para extrair mensagem de erro
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Erro desconhecido';
}

export function VisaoGestor() {
    const { transacoes, resumo, loading, fetchTransacoes, fetchAnosDisponiveis, salvarTransacao, darBaixa, atualizarTransacao, excluirTransacao } = useFinanceiro();
    const { itens: categorias, fetchItens } = useItensFinanceiros();
    const { getParametro } = useParametros();

    const { lojaAtual, lojasDisponiveis, setLojaAtual } = useLoja();
    const { isAdmin } = usePerfil();

    const { toast } = useToast();
    const confirm = useConfirm();

    // Flag para verificar se o componente ainda está montado
    const mounted = useRef(true);

    // Estado para controle de exclusão
    const [exclusaoState, setExclusaoState] = useState<ExclusaoState>({
        emProgresso: false,
        id: null,
        erro: null
    });

    // Filtros globais
    const [ano, setAno] = useState(new Date().getFullYear());
    const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([new Date().getFullYear()]);
    const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
    const [visualizacaoAnual, setVisualizacaoAnual] = useState(false);

    // UI State
    const [abaAtiva, setAbaAtiva] = useState<Aba>('receitas');
    const [showModal, setShowModal] = useState(false);
    const [showReplicarModal, setShowReplicarModal] = useState(false);
    const [modalType, setModalType] = useState<'receita' | 'despesa'>('receita');
    const [processing, setProcessing] = useState(false);
    const [modalBaixaOpen, setModalBaixaOpen] = useState(false);
    const [transacaoParaBaixa, setTransacaoParaBaixa] = useState<TransacaoFinanceira | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<TransacaoFinanceira | null>(null);
    const [dataUltimaAtualizacao, setDataUltimaAtualizacao] = useState<Date | null>(null);

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

    // Função segura para buscar transações (sem signal)
    const buscarTransacoesSeguro = useCallback(async (
        anoParam: number,
        mesParam: number,
        lojaId: string | null
    ) => {
        try {
            await fetchTransacoes(anoParam, mesParam, lojaId);
            if (mounted.current) {
                setDataUltimaAtualizacao(new Date());
            }
        } catch (error: any) {
            console.error('[FINANCEIRO] Erro ao buscar transações:', error);
            if (mounted.current) {
                toast({
                    message: 'Erro ao carregar dados: ' + getErrorMessage(error),
                    type: 'error'
                });
            }
        }
    }, [fetchTransacoes, toast]);

    // Efeito para buscar dados iniciais com proteção contra desmontagem
    useEffect(() => {
        mounted.current = true;

        const carregarDados = async () => {
            await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
        };

        carregarDados();

        fetchItens(lojaAtual?.id || null).catch(error => {
            if (mounted.current) {
                console.error('[FINANCEIRO] Erro ao buscar itens:', error);
                toast({ message: 'Erro ao carregar categorias', type: 'error' });
            }
        });

        fetchAnosDisponiveis(lojaAtual?.id || null).then(anos => {
            if (mounted.current && anos.length > 0) {
                setAnosDisponiveis(anos);
            }
        }).catch(error => {
            if (mounted.current) {
                console.error('[FINANCEIRO] Erro ao buscar anos disponíveis:', error);
                toast({ message: 'Erro ao carregar anos', type: 'error' });
            }
        });

        return () => {
            mounted.current = false;
        };
    }, [ano, lojaAtual?.id, mesSelecionado, visualizacaoAnual, buscarTransacoesSeguro, fetchItens, fetchAnosDisponiveis, toast]);

    // Função para refresh seguro
    const handleRefresh = useCallback(async () => {
        await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
        if (mounted.current) {
            toast({ message: 'Dados atualizados!', type: 'success' });
        }
    }, [ano, mesSelecionado, visualizacaoAnual, lojaAtual?.id, buscarTransacoesSeguro, toast]);

    // Auto-preenchimento inteligente ao mudar o item
    const handleItemChange = (itemNome: string) => {
        const cat = categorias.find(c => c.item === itemNome);
        if (cat) {
            setFormData(prev => {
                const newData: typeof prev = { ...prev, item: itemNome, modalidade: cat.tipo_recorrencia || 'VARIAVEL' };

                const lastItem = categorias.find(c => c.item === prev.item);
                if (!prev.descricao || prev.descricao === lastItem?.item) {
                    newData.descricao = cat.item;
                }

                if (cat.fixo && cat.valor_padrao) {
                    newData.valor = cat.valor_padrao;
                }

                if (cat.dia_vencimento) {
                    const d = new Date();
                    d.setDate(cat.dia_vencimento);
                    newData.vencimento = d.toISOString().split('T')[0];
                }

                return newData;
            });
        } else {
            setFormData(prev => ({ ...prev, item: itemNome }));
        }
    };

    // Filtragem Local baseada no Período (Mês ou Ano)
    const transacoesDoPeriodo = useMemo(() => {
        try {
            return transacoes.filter(t => {
                if (!t.data_vencimento) return false;
                const parts = t.data_vencimento.split('-');
                if (parts.length < 2) return false;

                const tAno = parseInt(parts[0]);
                if (tAno !== ano) return false;

                if (visualizacaoAnual) return true;

                const tMes = parseInt(parts[1]);
                return tMes === mesSelecionado;
            });
        } catch (error) {
            console.error('[FINANCEIRO] Erro ao filtrar transações:', error);
            return [];
        }
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

        const sum = (list: any[]) => list.reduce((acc, t) => acc + (t.valor || 0), 0);
        const byCategory = (list: any[]) => {
            const map = new Map<string, number>();
            list.forEach(i => {
                if (!i.item) return;
                const val = map.get(i.item) || 0;
                map.set(i.item, val + (i.valor || 0));
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

    // Preparar dados para o Gráfico – otimizado (um único loop)
    const chartData = useMemo(() => {
        // Inicializa array de 12 meses
        const monthsData = Array.from({ length: 12 }, (_, i) => {
            const monthNum = i + 1;
            return {
                month: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
                fullLabel: new Date(ano, i, 1).toLocaleString('pt-BR', { month: 'long' }),
                value: 0,
                lojas: {} as Record<string, number>
            };
        });

        // Popula com os dados das transações
        transacoes.forEach(t => {
            if (!t.data_vencimento) return;
            const parts = t.data_vencimento.split('-');
            if (parts.length < 2) return;
            const tAno = parseInt(parts[0]);
            if (tAno !== ano) return;
            const tMes = parseInt(parts[1]) - 1; // 0-based
            if (tMes < 0 || tMes > 11) return;

            const isType = abaAtiva === 'receitas' ? t.tipo === 'receita' : t.tipo === 'despesa';
            if (!isType) return;

            monthsData[tMes].value += t.valor || 0;

            if (!lojaAtual) {
                const lojaId = t.loja_id;
                if (lojaId) {
                    monthsData[tMes].lojas[lojaId] = (monthsData[tMes].lojas[lojaId] || 0) + (t.valor || 0);
                }
            }
        });

        return monthsData;
    }, [transacoes, ano, abaAtiva, lojaAtual]);

    // Adapta as séries para o gráfico usando o novo formato
    const chartSeries = !lojaAtual ? lojasDisponiveis.map((loja, idx) => {
        const colors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981'];
        return {
            key: loja.id,
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
        setFormData({
            descricao: t.descricao || '',
            valor: t.valor || 0,
            item: t.item || '',
            vencimento: t.data_vencimento || new Date().toISOString().split('T')[0],
            recorrente: t.recorrente || false,
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
        if (exclusaoState.emProgresso) {
            toast({
                message: 'Uma exclusão já está em andamento. Aguarde...',
                type: 'warning'
            });
            return;
        }

        const confirmed = await confirm({
            title: 'Excluir Lançamento',
            description: `Deseja realmente excluir "${t.descricao || t.item}"? Esta ação removerá o lançamento do banco de dados permanentemente.`,
            variant: 'danger',
            confirmLabel: 'Excluir Lançamento'
        });

        if (!confirmed) return;

        setExclusaoState({
            emProgresso: true,
            id: t.id,
            erro: null
        });

        try {
            await excluirTransacao(t.id);

            toast({
                message: 'Lançamento excluído com sucesso!',
                type: 'success'
            });

            await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);

        } catch (error: any) {
            console.error('[FINANCEIRO] Erro ao excluir:', error);

            const mensagemErro = getErrorMessage(error);

            setExclusaoState(prev => ({
                ...prev,
                erro: mensagemErro
            }));

            toast({
                message: `Erro ao excluir: ${mensagemErro}`,
                type: 'error'
            });
        } finally {
            setExclusaoState({
                emProgresso: false,
                id: null,
                erro: null
            });
        }
    };

    const handleSave = async () => {
        try {
            if (!formData.loja_id) {
                toast({
                    message: "⚠️ Por favor, selecione a Filial para este lançamento.",
                    type: 'error'
                });
                return;
            }

            if (!formData.item) {
                toast({
                    message: "⚠️ Por favor, selecione um item do catálogo.",
                    type: 'error'
                });
                return;
            }

            if (formData.valor <= 0) {
                toast({
                    message: "⚠️ O valor deve ser maior que zero.",
                    type: 'error'
                });
                return;
            }

            setProcessing(true);

            const catAtual = categorias.find(c => c.item === formData.item);

            const isRecorrente = formData.modalidade === 'FIXO_MENSAL' || formData.modalidade === 'FIXO_VARIAVEL';
            const freqFinal = formData.modalidade === 'FIXO_MENSAL' ? 'mensal'
                : formData.modalidade === 'FIXO_VARIAVEL' ? 'mensal_variavel'
                    : null;

            const payload = {
                tipo: modalType,
                descricao: formData.descricao || formData.item,
                valor: formData.valor,
                item: formData.item,
                data_vencimento: formData.vencimento,
                recorrente: isRecorrente,
                frequencia: freqFinal,
                loja_id: formData.loja_id,
                item_financeiro_id: catAtual?.id || null,
                status: (editingTransaction?.status || 'pendente') as StatusTransacao,
                data_pagamento: editingTransaction?.data_pagamento || null
            };

            if (editingTransaction) {
                await atualizarTransacao(editingTransaction.id, payload);
                toast({ message: 'Lançamento atualizado com sucesso!', type: 'success' });
            } else {
                await salvarTransacao(payload);
                toast({ message: 'Lançamento registrado com sucesso!', type: 'success' });
            }

            setShowModal(false);
            setEditingTransaction(null);

            await Promise.all([
                fetchItens(lojaAtual?.id || null).catch(err => console.error('[FINANCEIRO] Erro ao atualizar itens:', err)),
                buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null)
            ]);

        } catch (error: any) {
            console.error('[FINANCEIRO] Erro ao salvar:', error);
            const mensagemErro = getErrorMessage(error);
            toast({
                message: `Erro: ${mensagemErro}`,
                type: 'error'
            });
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
            await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
        } catch (error: any) {
            console.error('[FINANCEIRO] Erro ao dar baixa:', error);
            toast({
                message: 'Erro ao dar baixa: ' + getErrorMessage(error),
                type: 'error'
            });
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handlePrintDRE = () => {
        // Abre uma nova janela com apenas o conteúdo do DRE para impressão
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({ message: 'Permita pop-ups para imprimir', type: 'error' });
            return;
        }

        const estilo = `
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { font-size: 20px; margin-bottom: 10px; }
                h2 { font-size: 16px; margin-top: 20px; border-bottom: 1px solid #ccc; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
                th { background-color: #f2f2f2; }
                .valor { text-align: right; }
                .total { font-weight: bold; background-color: #e8e8e8; }
                .lucro { color: green; }
                .prejuizo { color: red; }
            </style>
        `;

        const periodo = visualizacaoAnual ? `Ano ${ano}` : `${new Date(ano, mesSelecionado-1, 1).toLocaleString('pt-BR', { month: 'long' })}/${ano}`;

        const html = `
            <html>
                <head><title>DRE - ${periodo}</title>${estilo}</head>
                <body>
                    <h1>Demonstração de Resultados - ${periodo}</h1>
                    <h2>Entradas</h2>
                    <table>
                        <thead><tr><th>Categoria</th><th class="valor">Valor (R$)</th></tr></thead>
                        <tbody>
                            ${resumoCalculado.detalheReceitas.map(c => `<tr><td>${c.item}</td><td class="valor">${c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
                            <tr class="total"><td>Total de Entradas</td><td class="valor">${resumoCalculado.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                        </tbody>
                    </table>

                    <h2>Saídas</h2>
                    <table>
                        <thead><tr><th>Categoria</th><th class="valor">Valor (R$)</th></tr></thead>
                        <tbody>
                            ${resumoCalculado.detalheDespesas.map(c => `<tr><td>${c.item}</td><td class="valor">${c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
                            <tr class="total"><td>Total de Saídas</td><td class="valor">${resumoCalculado.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                        </tbody>
                    </table>

                    <h2>Resultado Líquido</h2>
                    <table>
                        <tr><td>Total de Entradas</td><td class="valor">${resumoCalculado.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                        <tr><td>Total de Saídas</td><td class="valor">${resumoCalculado.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                        <tr class="total ${lucroLiquidoReal >= 0 ? 'lucro' : 'prejuizo'}"><td>Resultado</td><td class="valor">${lucroLiquidoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                    </table>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };

    const handleExport = () => {
        try {
            const headers = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Status"];
            const rows = filteredList.map(t => [
                t.data_vencimento || '',
                t.descricao || t.item || '',
                t.item || '',
                t.tipo || '',
                (t.valor || 0).toFixed(2),
                t.status || ''
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

            toast({ message: 'Arquivo exportado com sucesso!', type: 'success' });
        } catch (error) {
            console.error('[FINANCEIRO] Erro ao exportar:', error);
            toast({ message: 'Erro ao exportar arquivo', type: 'error' });
        }
    };

    const comissaoBruta = resumoCalculado.receitas;
    const totalDespesas = resumoCalculado.despesas;
    const lucroLiquidoReal = comissaoBruta - totalDespesas;

    const handleChartClick = (monthNumber: number) => {
        if (visualizacaoAnual) return;
        setMesSelecionado(monthNumber);
    };

    // Verificar se uma transação específica está sendo excluída
    const isBeingDeleted = (id: number) => {
        return exclusaoState.emProgresso && exclusaoState.id === id;
    };

    return (
        <div className="financeiro-real">
            <PageHeader title="Gestão Financeira Real">
                {/* Indicador de última atualização */}
                {dataUltimaAtualizacao && (
                    <div className="flex items-center gap-2 text-xs text-muted mr-4">
                        <RefreshCcw size={12} />
                        <span>Atualizado: {dataUltimaAtualizacao.toLocaleTimeString()}</span>
                    </div>
                )}

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
                            setMesSelecionado(new Date().getMonth() + 1);
                        }}
                        aria-label="Selecionar filial"
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
                <button
                    className={`btn ${abaAtiva === 'receitas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setAbaAtiva('receitas')}
                    aria-label="Receitas"
                >
                    <TrendingUp size={16} /> Receitas
                </button>
                <button
                    className={`btn ${abaAtiva === 'despesas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setAbaAtiva('despesas')}
                    aria-label="Despesas"
                >
                    <TrendingDown size={16} /> Despesas
                </button>
                <button
                    className={`btn ${abaAtiva === 'fechamento' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setAbaAtiva('fechamento')}
                    aria-label="Fechamento DRE"
                >
                    <BarChart3 size={16} /> Fechamento (DRE)
                </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="card transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="chart-title mb-0">
                            {abaAtiva === 'receitas' ? 'Melhoria de Fluxo (Receitas)' :
                             abaAtiva === 'despesas' ? 'Evolução de Custos (Despesas)' :
                             'Fechamento Consolidado (DRE)'}
                        </h3>
                        {abaAtiva !== 'fechamento' && !visualizacaoAnual && (
                            <p className="text-[10px] text-muted mt-1 flex items-center gap-1">
                                <Calendar size={10} /> Clique nas barras do gráfico para filtrar por mês
                            </p>
                        )}
                    </div>
                    {abaAtiva !== 'fechamento' ? (
                        <div className="flex gap-3 items-center">
                            {/* Botão Refresh */}
                            <button
                                className="btn btn-sm btn-ghost text-muted hover:text-white"
                                onClick={handleRefresh}
                                title="Atualizar dados"
                                disabled={loading}
                                aria-label="Atualizar"
                            >
                                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>

                            {/* Toggle Ano Completo */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
                                <span className="text-xs font-semibold text-muted whitespace-nowrap">
                                    Ano Completo:
                                </span>
                                <div
                                    className={`relative w-10 h-5 rounded-full cursor-pointer transition-all duration-300 ${
                                        visualizacaoAnual ? 'bg-blue-500' : 'bg-white/20'
                                    }`}
                                    onClick={() => setVisualizacaoAnual(!visualizacaoAnual)}
                                    title={visualizacaoAnual ? 'Clique para ver mês atual' : 'Clique para ver ano completo'}
                                    role="switch"
                                    aria-checked={visualizacaoAnual}
                                    aria-label="Alternar visualização anual"
                                >
                                    <div
                                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-lg ${
                                            visualizacaoAnual ? 'left-5' : 'left-0.5'
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
                                disabled={loading}
                                aria-label="Selecionar ano"
                            >
                                {[...new Set([new Date().getFullYear(), ano, ...anosDisponiveis])]
                                    .sort((a, b) => b - a)
                                    .map(anoVal => (
                                        <option key={anoVal} value={anoVal}>{anoVal}</option>
                                    ))
                                }
                            </select>

                            <div className="w-px h-6 bg-white/10" />

                            {/* Botões de Exportação/Impressão */}
                            <button
                                className="btn btn-sm btn-ghost text-muted hover:text-white"
                                onClick={handleExport}
                                title="Exportar CSV"
                                disabled={filteredList.length === 0}
                                aria-label="Exportar CSV"
                            >
                                <FileText size={16} />
                            </button>
                            <button
                                className="btn btn-sm btn-ghost text-muted hover:text-white"
                                onClick={handlePrint}
                                title="Imprimir / Salvar PDF"
                                aria-label="Imprimir"
                            >
                                <Printer size={16} />
                            </button>

                            <div className="w-px h-6 bg-white/10" />

                            {/* Botão Replicar */}
                            <button
                                className="btn btn-sm btn-ghost text-blue-300 hover:text-white border border-blue-500/20 hover:bg-blue-500/10"
                                onClick={() => setShowReplicarModal(true)}
                                title="Copiar Despesas do Mês Anterior"
                                disabled={loading}
                                aria-label="Replicar mês anterior"
                            >
                                <Copy size={14} /> Replicar Mês
                            </button>

                            <button
                                className="btn btn-sm btn-accent"
                                onClick={() => handleOpenModalNew(abaAtiva === 'receitas' ? 'receita' : 'despesa')}
                                disabled={loading}
                                aria-label="Novo lançamento"
                            >
                                <Plus size={14} /> Novo Lançamento
                            </button>
                        </div>
                    ) : (
                        // Controles específicos do DRE (filtro de período + impressão DRE)
                        <div className="flex gap-3 items-center">
                            <select
                                className="input input-sm font-bold text-xs px-3 py-1"
                                value={ano}
                                onChange={e => setAno(parseInt(e.target.value))}
                                aria-label="Ano"
                            >
                                {[...new Set([new Date().getFullYear(), ano, ...anosDisponiveis])]
                                    .sort((a, b) => b - a)
                                    .map(anoVal => (
                                        <option key={anoVal} value={anoVal}>{anoVal}</option>
                                    ))
                                }
                            </select>

                            <select
                                className="input input-sm font-bold text-xs px-3 py-1"
                                value={mesSelecionado}
                                onChange={e => setMesSelecionado(parseInt(e.target.value))}
                                disabled={visualizacaoAnual}
                                aria-label="Mês"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>
                                        {new Date(ano, m-1, 1).toLocaleString('pt-BR', { month: 'long' })}
                                    </option>
                                ))}
                            </select>

                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                                <span className="text-xs">Ano Completo:</span>
                                <div
                                    className={`relative w-10 h-5 rounded-full cursor-pointer transition-all ${
                                        visualizacaoAnual ? 'bg-blue-500' : 'bg-white/20'
                                    }`}
                                    onClick={() => setVisualizacaoAnual(!visualizacaoAnual)}
                                    role="switch"
                                    aria-checked={visualizacaoAnual}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${visualizacaoAnual ? 'left-5' : 'left-0.5'}`} />
                                </div>
                            </div>

                            <button
                                className="btn btn-sm btn-primary"
                                onClick={handlePrintDRE}
                                aria-label="Imprimir DRE"
                            >
                                <Printer size={16} /> Imprimir DRE
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
                                                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                                            catInfo?.fixo
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
                                    <div className={`flex items-center justify-center w-24 h-24 rounded-full ${
                                        lucroLiquidoReal >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {lucroLiquidoReal >= 0 ? <TrendingUp size={48} /> : <TrendingDown size={48} />}
                                    </div>

                                    <div className="text-center">
                                        <p className="text-sm text-muted uppercase font-bold mb-2">Saldo do Período</p>
                                        <h2 className={`text-4xl font-black ${
                                            lucroLiquidoReal >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        }`}>
                                            R$ {Math.abs(lucroLiquidoReal).toLocaleString('pt-BR')}
                                        </h2>
                                        <p className={`text-sm font-bold mt-2 ${
                                            lucroLiquidoReal >= 0 ? 'text-emerald-500' : 'text-red-500'
                                        }`}>
                                            {lucroLiquidoReal >= 0 ? 'LUCRO OPERACIONAL' : 'PREJUÍZO OPERACIONAL'}
                                        </p>
                                    </div>

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
                                            <p className={`font-bold ${
                                                lucroLiquidoReal >= 0 ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
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
                                    {visualizacaoAnual
                                        ? `Movimentações de ${ano} (Ano Completo)`
                                        : `Movimentações de ${new Date(ano, mesSelecionado - 1, 1).toLocaleString('pt-BR', { month: 'long' })}`}
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
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-muted italic">
                                                Nenhum lançamento encontrado neste período.
                                            </td>
                                        </tr>
                                    ) : filteredList.map(t => {
                                        const deletando = isBeingDeleted(t.id);

                                        return (
                                            <tr
                                                key={t.id}
                                                className={`group hover:bg-white/5 transition-colors ${
                                                    deletando ? 'opacity-50 pointer-events-none' : ''
                                                }`}
                                            >
                                                <td className="text-xs font-mono text-muted">
                                                    {t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '-'}
                                                </td>
                                                <td className="text-[10px] font-bold text-text-secondary">
                                                    {lojasDisponiveis.find(l => l.id === t.loja_id)?.nome_fantasia || 'N/A'}
                                                </td>
                                                <td className="font-semibold text-sm">
                                                    {t.descricao || t.item || '-'}
                                                    {t.item && t.descricao !== t.item && (
                                                        <span className="block text-[10px] text-muted font-normal">{t.item}</span>
                                                    )}
                                                </td>
                                                <td className="text-[10px] font-bold uppercase">
                                                    {(() => {
                                                        if (t.recorrente && t.frequencia === 'mensal') {
                                                            return <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md">Fixo Mensal</span>;
                                                        } else if (t.recorrente && t.frequencia === 'mensal_variavel') {
                                                            return <span className="bg-pink-500/10 text-pink-400 px-2 py-1 rounded-md">Fixo Variável</span>;
                                                        } else if (t.recorrente) {
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
                                                <td className={`text-right font-black ${
                                                    t.tipo === 'receita' ? 'text-success' : 'text-danger'
                                                }`}>
                                                    R$ {(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-center">
                                                    <span className={`badge ${
                                                        t.status === 'pago' ? 'success' : 'warning'
                                                    } text-[10px]`}>
                                                        {(t.status || 'pendente').toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {t.status === 'pendente' && (
                                                        <button
                                                            className="btn btn-ghost btn-xs text-success hover:bg-success/20"
                                                            onClick={() => handleBaixaClick(t)}
                                                            title="Dar Baixa"
                                                            disabled={deletando}
                                                            aria-label="Dar baixa"
                                                        >
                                                            <CheckCircle2 size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-ghost btn-xs text-blue-400 hover:bg-blue-400/20"
                                                        onClick={() => handleEditClick(t)}
                                                        title="Editar"
                                                        disabled={deletando}
                                                        aria-label="Editar"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        className={`btn btn-ghost btn-xs text-danger hover:bg-danger/20 relative ${
                                                            deletando ? 'cursor-not-allowed opacity-50' : ''
                                                        }`}
                                                        onClick={() => handleDeleteClick(t)}
                                                        title={deletando ? 'Excluindo...' : 'Excluir'}
                                                        disabled={deletando}
                                                        aria-label="Excluir"
                                                    >
                                                        {deletando ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <Trash2 size={14} />
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Mensagem de erro na exclusão */}
                            {exclusaoState.erro && (
                                <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={16} className="text-danger" />
                                    <span className="text-xs text-danger">
                                        Erro na exclusão: {exclusaoState.erro}. Tente novamente.
                                    </span>
                                    <button
                                        className="btn btn-xs btn-ghost text-danger ml-auto"
                                        onClick={() => setExclusaoState(prev => ({ ...prev, erro: null }))}
                                        aria-label="Fechar"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modais */}
            <ReplicarUltimoMesModal
                isOpen={showReplicarModal}
                onClose={() => setShowReplicarModal(false)}
                lojaId={lojaAtual?.id || null}
                anoAtual={ano}
                mesAtual={mesSelecionado}
                onSuccess={() => {
                    buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
                }}
            />

            <ModalBaixaFinanceira
                isOpen={modalBaixaOpen}
                onClose={() => {
                    setModalBaixaOpen(false);
                    setTransacaoParaBaixa(null);
                }}
                transaction={transacaoParaBaixa}
                onConfirm={handleConfirmBaixa}
            />

            {/* Modal de Cadastro */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        zIndex: 9998,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !processing) {
                            setShowModal(false);
                        }
                    }}
                >
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '1.5rem' }}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                            <h3 className="text-lg font-bold">
                                {editingTransaction ? 'Editar Lançamento' : (modalType === 'receita' ? 'Nova Receita' : 'Nova Despesa')}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                disabled={processing}
                                className="text-muted hover:text-white disabled:opacity-50"
                                aria-label="Fechar"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Seleção de Filial */}
                            {(isAdmin || lojasDisponiveis.length > 1) && (
                                <div className="form-group pb-2 border-b border-white/5">
                                    <label className="text-blue-400">Filial de Destino</label>
                                    <select
                                        className="input border-blue-500/30 bg-blue-500/5 font-bold"
                                        value={formData.loja_id}
                                        onChange={e => setFormData({ ...formData, loja_id: e.target.value })}
                                        disabled={processing}
                                        aria-label="Filial"
                                    >
                                        <option value="">Selecione a Filial...</option>
                                        {lojasDisponiveis.map(loja => (
                                            <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                        ))}
                                    </select>
                                    {!formData.loja_id && (
                                        <p className="text-[9px] text-danger mt-1 italic font-bold">⚠️ Campo obrigatório</p>
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
                                        disabled={processing}
                                        aria-label="Item do catálogo"
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
                                    disabled={processing}
                                    aria-label="Descrição complementar"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label>Valor (R$)</label>
                                    <MoneyInput
                                        value={formData.valor}
                                        onValueChange={v => setFormData({ ...formData, valor: v })}
                                        disabled={processing}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Vencimento</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={formData.vencimento}
                                        onChange={e => setFormData({ ...formData, vencimento: e.target.value })}
                                        disabled={processing}
                                        aria-label="Data de vencimento"
                                    />
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
                                                className={`p-2 rounded-lg border text-left transition-all text-xs ${
                                                    isSelected
                                                        ? ''
                                                        : 'border-white/10 text-muted hover:border-white/20'
                                                }`}
                                                onClick={() => setFormData({ ...formData, modalidade: opt.key })}
                                                disabled={processing}
                                                aria-label={opt.label}
                                            >
                                                <span className="font-bold block">{opt.label}</span>
                                                <span className="text-[10px] opacity-70">{opt.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowModal(false)}
                                disabled={processing}
                                aria-label="Cancelar"
                            >
                                Cancelar
                            </button>
                            <button
                                className={`btn ${modalType === 'receita' ? 'btn-primary' : 'btn-danger'}`}
                                onClick={handleSave}
                                disabled={processing || !formData.loja_id || !formData.item || formData.valor <= 0}
                                aria-label="Salvar"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin mr-1" />
                                        Salvando...
                                    </>
                                ) : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
