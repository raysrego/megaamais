'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Pencil,
    Trash2,
    TrendingUp,
    TrendingDown,
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
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { FinancialGrowthChart } from './FinancialGrowthChart';
import { ReplicarUltimoMesModal } from './ReplicarUltimoMesModal';
import { ModalBaixaFinanceira } from './ModalBaixaFinanceira';
import { useFinanceiro, TransacaoFinanceira } from '@/hooks/useFinanceiro';
import { useItensFinanceiros, ItemFinanceiro } from '@/hooks/useItensFinanceiros';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil';
import { PageHeader } from '@/components/ui/PageHeader';
import { KPICard } from '@/components/ui/KPICard';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';

type Aba = 'receitas' | 'despesas' | 'fechamento';
type StatusTransacao = 'pendente' | 'pago';

interface ExclusaoState {
    emProgresso: boolean;
    id: number | null;
    erro: string | null;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Erro desconhecido';
}

function escapeCSV(str: string): string {
    if (str === undefined || str === null) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

export function VisaoGestor() {
    const { transacoes, loading, fetchTransacoes, fetchAnosDisponiveis, salvarTransacao, darBaixa, atualizarTransacao, excluirTransacao } = useFinanceiro();
    const { itens: categorias, fetchItens } = useItensFinanceiros();
    const { lojaAtual, lojasDisponiveis, setLojaAtual } = useLoja();
    const { isAdmin } = usePerfil();
    const { toast } = useToast();
    const confirm = useConfirm();

    const mounted = useRef(true);

    const [exclusaoState, setExclusaoState] = useState<ExclusaoState>({ emProgresso: false, id: null, erro: null });

    // Filtros
    const [ano, setAno] = useState(new Date().getFullYear());
    const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([new Date().getFullYear()]);
    const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
    const [visualizacaoAnual, setVisualizacaoAnual] = useState(false);
    const [modalidadeFilter, setModalidadeFilter] = useState<'all' | 'FIXO_MENSAL' | 'FIXO_VARIAVEL' | 'VARIAVEL'>('all');
    const [categoriaPaiFilter, setCategoriaPaiFilter] = useState<number | 'all'>('all');

    // Filtros DRE
    const hoje = new Date();
    const [dataInicio, setDataInicio] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]);
    const [modoFiltroDRE, setModoFiltroDRE] = useState<'mensal' | 'personalizado'>('mensal');

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
    const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<string>>(new Set());

    // Form Data (hierarquia)
    const [formData, setFormData] = useState({
        categoriaPaiId: null as number | null,
        subcategoriaId: null as number | null,
        detalhe: '',
        valor: 0,
        vencimento: new Date().toISOString().split('T')[0],
        recorrente: false,
        frequencia: 'mensal',
        observacao: '',
        loja_id: lojaAtual?.id || '',
        modalidade: 'VARIAVEL' as 'FIXO_MENSAL' | 'FIXO_VARIAVEL' | 'VARIAVEL'
    });

    // Categorias pai para filtro (baseado na aba atual)
    const categoriasPaiFiltro = useMemo(() => {
        const tipo = abaAtiva === 'receitas' ? 'receita' : 'despesa';
        return categorias.filter(c => !c.parent_id && c.tipo === tipo);
    }, [categorias, abaAtiva]);

    // Categorias pai para formulário (baseado no modalType)
    const categoriasPaiForm = useMemo(() => {
        return categorias.filter(c => !c.parent_id && c.tipo === modalType);
    }, [categorias, modalType]);

    const subcategoriasDisponiveis = useMemo(() => {
        if (!formData.categoriaPaiId) return [];
        return categorias.filter(c => c.parent_id === formData.categoriaPaiId);
    }, [categorias, formData.categoriaPaiId]);

    // Sincronizar loja_id
    useEffect(() => {
        if (!showModal && lojaAtual) {
            setFormData(prev => ({ ...prev, loja_id: lojaAtual?.id || '' }));
        }
    }, [lojaAtual, showModal]);

    // Buscar transações segura
    const buscarTransacoesSeguro = useCallback(async (anoParam: number, mesParam: number, lojaId: string | null) => {
        try {
            await fetchTransacoes(anoParam, mesParam, lojaId);
            if (mounted.current) setDataUltimaAtualizacao(new Date());
        } catch (error: any) {
            console.error('[FINANCEIRO] Erro:', error);
            if (mounted.current) toast({ message: 'Erro ao carregar dados: ' + getErrorMessage(error), type: 'error' });
        }
    }, [fetchTransacoes, toast]);

    // Carregar dados iniciais
    useEffect(() => {
        mounted.current = true;
        const carregarDados = async () => {
            await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
        };
        carregarDados();
        fetchItens(lojaAtual?.id || null).catch(error => {
            if (mounted.current) toast({ message: 'Erro ao carregar categorias', type: 'error' });
        });
        fetchAnosDisponiveis(lojaAtual?.id || null).then(anos => {
            if (mounted.current && anos.length) setAnosDisponiveis(anos);
        }).catch(() => {});
        return () => { mounted.current = false; };
    }, [ano, lojaAtual?.id, mesSelecionado, visualizacaoAnual, buscarTransacoesSeguro, fetchItens, fetchAnosDisponiveis, toast]);

    const handleRefresh = useCallback(async () => {
        await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
        if (mounted.current) toast({ message: 'Dados atualizados!', type: 'success' });
    }, [ano, mesSelecionado, visualizacaoAnual, lojaAtual?.id, buscarTransacoesSeguro, toast]);

    const handleCategoriaChange = (categoriaId: number) => {
        const cat = categorias.find(c => c.id === categoriaId);
        if (cat) {
            setFormData(prev => ({
                ...prev,
                modalidade: cat.tipo_recorrencia || 'VARIAVEL',
                detalhe: prev.detalhe || cat.item,
                valor: cat.fixo && cat.valor_padrao ? cat.valor_padrao : prev.valor,
                vencimento: cat.dia_vencimento ? new Date(new Date().setDate(cat.dia_vencimento)).toISOString().split('T')[0] : prev.vencimento
            }));
        }
    };

    // Modalidade com cache
    const modalidadeCache = useRef<Map<number, string>>(new Map());
    const getModalidadeFromTransacao = useCallback((t: TransacaoFinanceira): string => {
        if (modalidadeCache.current.has(t.id)) return modalidadeCache.current.get(t.id)!;
        let modalidade: string;
        if (t.recorrente && t.frequencia === 'mensal') modalidade = 'FIXO_MENSAL';
        else if (t.recorrente && t.frequencia === 'mensal_variavel') modalidade = 'FIXO_VARIAVEL';
        else if (t.recorrente) {
            const cat = categorias.find(c => c.id === t.item_financeiro_id);
            modalidade = cat?.tipo_recorrencia === 'FIXO_VARIAVEL' ? 'FIXO_VARIAVEL' : 'FIXO_MENSAL';
        } else modalidade = 'VARIAVEL';
        modalidadeCache.current.set(t.id, modalidade);
        return modalidade;
    }, [categorias]);

    useEffect(() => { modalidadeCache.current.clear(); }, [categorias]);

    const transacoesDoPeriodo = useMemo(() => {
        return transacoes.filter(t => {
            if (!t.data_vencimento) return false;
            const [tAno, tMes] = t.data_vencimento.split('-');
            if (parseInt(tAno) !== ano) return false;
            if (visualizacaoAnual) return true;
            return parseInt(tMes) === mesSelecionado;
        });
    }, [transacoes, ano, mesSelecionado, visualizacaoAnual]);

    const filteredList = useMemo(() => {
        let lista = transacoesDoPeriodo.filter(t => (abaAtiva === 'receitas' && t.tipo === 'receita') || (abaAtiva === 'despesas' && t.tipo === 'despesa'));
        if (modalidadeFilter !== 'all') lista = lista.filter(t => getModalidadeFromTransacao(t) === modalidadeFilter);
        if (categoriaPaiFilter !== 'all') {
            const subIds = categorias.filter(c => c.parent_id === categoriaPaiFilter).map(c => c.id);
            const ids = [categoriaPaiFilter, ...subIds];
            lista = lista.filter(t => t.item_financeiro_id && ids.includes(t.item_financeiro_id));
        }
        return lista;
    }, [transacoesDoPeriodo, abaAtiva, modalidadeFilter, categoriaPaiFilter, getModalidadeFromTransacao, categorias]);

    const totalFiltrado = useMemo(() => {
        const soma = filteredList.reduce((acc, t) => acc + (t.valor || 0), 0);
        return { soma, quantidade: filteredList.length };
    }, [filteredList]);

    const modalidadeCounts = useMemo(() => {
        const base = transacoesDoPeriodo.filter(t => (abaAtiva === 'receitas' && t.tipo === 'receita') || (abaAtiva === 'despesas' && t.tipo === 'despesa'));
        return {
            total: base.length,
            FIXO_MENSAL: base.filter(t => getModalidadeFromTransacao(t) === 'FIXO_MENSAL').length,
            FIXO_VARIAVEL: base.filter(t => getModalidadeFromTransacao(t) === 'FIXO_VARIAVEL').length,
            VARIAVEL: base.filter(t => getModalidadeFromTransacao(t) === 'VARIAVEL').length,
        };
    }, [transacoesDoPeriodo, abaAtiva, getModalidadeFromTransacao]);

    useEffect(() => {
        setModalidadeFilter('all');
        setCategoriaPaiFilter('all');
    }, [abaAtiva]);

    const resumoCalculado = useMemo(() => {
        const receitas = transacoesDoPeriodo.filter(t => t.tipo === 'receita').reduce((s, t) => s + (t.valor || 0), 0);
        const despesas = transacoesDoPeriodo.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (t.valor || 0), 0);
        return { receitas, despesas };
    }, [transacoesDoPeriodo]);

    const chartData = useMemo(() => {
        const monthsData = Array.from({ length: 12 }, (_, i) => ({
            month: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
            fullLabel: new Date(ano, i, 1).toLocaleString('pt-BR', { month: 'long' }),
            value: 0,
            lojas: {} as Record<string, number>
        }));
        transacoes.forEach(t => {
            if (!t.data_vencimento) return;
            const [tAno, tMes] = t.data_vencimento.split('-');
            if (parseInt(tAno) !== ano) return;
            const mesIdx = parseInt(tMes) - 1;
            const isType = (abaAtiva === 'receitas' && t.tipo === 'receita') || (abaAtiva === 'despesas' && t.tipo === 'despesa');
            if (!isType) return;
            monthsData[mesIdx].value += t.valor || 0;
            if (!lojaAtual && t.loja_id) monthsData[mesIdx].lojas[t.loja_id] = (monthsData[mesIdx].lojas[t.loja_id] || 0) + (t.valor || 0);
        });
        return monthsData;
    }, [transacoes, ano, abaAtiva, lojaAtual]);

    const chartSeries = !lojaAtual ? lojasDisponiveis.map((loja, idx) => ({
        key: loja.id,
        label: loja.nome_fantasia,
        color: ['#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981'][idx % 5]
    })) : undefined;

    const transacoesDoPeriodoDRE = useMemo(() => {
        if (modoFiltroDRE === 'mensal') return transacoesDoPeriodo;
        return transacoes.filter(t => t.data_vencimento && t.data_vencimento >= dataInicio && t.data_vencimento <= dataFim);
    }, [modoFiltroDRE, transacoesDoPeriodo, transacoes, dataInicio, dataFim]);

    // Agrupar receitas por categoria raiz
    const receitasPorCategoriaRaiz = useMemo(() => {
        const grupos = new Map<number, { id: number; nome: string; total: number; subcategorias: Map<number, { id: number; nome: string; total: number; itens: any[] }>; itensDiretos: any[] }>();
        transacoesDoPeriodoDRE.filter(t => t.tipo === 'receita').forEach(r => {
            const cat = categorias.find(c => c.id === r.item_financeiro_id);
            if (!cat) return;
            const raizId = cat.parent_id || cat.id;
            const raizNome = cat.parent_id ? (categorias.find(c => c.id === cat.parent_id)?.item || cat.item) : cat.item;
            if (!grupos.has(raizId)) {
                grupos.set(raizId, { id: raizId, nome: raizNome, total: 0, subcategorias: new Map(), itensDiretos: [] });
            }
            const grupo = grupos.get(raizId)!;
            grupo.total += r.valor;
            if (cat.parent_id) {
                if (!grupo.subcategorias.has(cat.id)) {
                    grupo.subcategorias.set(cat.id, { id: cat.id, nome: cat.item, total: 0, itens: [] });
                }
                const sub = grupo.subcategorias.get(cat.id)!;
                sub.total += r.valor;
                sub.itens.push({ id: r.id, detalhe: r.item || r.descricao || 'Sem detalhe', valor: r.valor, data: r.data_vencimento || '' });
            } else {
                grupo.itensDiretos.push({ id: r.id, detalhe: r.item || r.descricao || 'Sem detalhe', valor: r.valor, data: r.data_vencimento || '' });
            }
        });
        return Array.from(grupos.values()).map(g => ({ ...g, subcategorias: Array.from(g.subcategorias.values()).sort((a, b) => b.total - a.total), itensDiretos: g.itensDiretos.sort((a, b) => b.valor - a.valor) })).sort((a, b) => b.total - a.total);
    }, [transacoesDoPeriodoDRE, categorias]);

    // Agrupar despesas por categoria raiz (mesma lógica)
    const despesasPorCategoriaRaiz = useMemo(() => {
        const grupos = new Map<number, { id: number; nome: string; total: number; subcategorias: Map<number, { id: number; nome: string; total: number; itens: any[] }>; itensDiretos: any[] }>();
        transacoesDoPeriodoDRE.filter(t => t.tipo === 'despesa').forEach(d => {
            const cat = categorias.find(c => c.id === d.item_financeiro_id);
            if (!cat) return;
            const raizId = cat.parent_id || cat.id;
            const raizNome = cat.parent_id ? (categorias.find(c => c.id === cat.parent_id)?.item || cat.item) : cat.item;
            if (!grupos.has(raizId)) {
                grupos.set(raizId, { id: raizId, nome: raizNome, total: 0, subcategorias: new Map(), itensDiretos: [] });
            }
            const grupo = grupos.get(raizId)!;
            grupo.total += d.valor;
            if (cat.parent_id) {
                if (!grupo.subcategorias.has(cat.id)) {
                    grupo.subcategorias.set(cat.id, { id: cat.id, nome: cat.item, total: 0, itens: [] });
                }
                const sub = grupo.subcategorias.get(cat.id)!;
                sub.total += d.valor;
                sub.itens.push({ id: d.id, detalhe: d.item || d.descricao || 'Sem detalhe', valor: d.valor, data: d.data_vencimento || '' });
            } else {
                grupo.itensDiretos.push({ id: d.id, detalhe: d.item || d.descricao || 'Sem detalhe', valor: d.valor, data: d.data_vencimento || '' });
            }
        });
        return Array.from(grupos.values()).map(g => ({ ...g, subcategorias: Array.from(g.subcategorias.values()).sort((a, b) => b.total - a.total), itensDiretos: g.itensDiretos.sort((a, b) => b.valor - a.valor) })).sort((a, b) => b.total - a.total);
    }, [transacoesDoPeriodoDRE, categorias]);

    const totalReceitasDRE = receitasPorCategoriaRaiz.reduce((acc, cat) => acc + cat.total, 0);
    const totalDespesasDRE = despesasPorCategoriaRaiz.reduce((acc, cat) => acc + cat.total, 0);
    const lucroLiquidoDRE = totalReceitasDRE - totalDespesasDRE;

    // Handlers
    const handleOpenModalNew = (tipo: 'receita' | 'despesa') => {
        setModalType(tipo);
        setEditingTransaction(null);
        setFormData({
            categoriaPaiId: null,
            subcategoriaId: null,
            detalhe: '',
            valor: 0,
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
        const cat = categorias.find(c => c.id === t.item_financeiro_id);
        setFormData({
            categoriaPaiId: cat?.parent_id || null,
            subcategoriaId: cat?.id || null,
            detalhe: t.item || '',
            valor: t.valor || 0,
            vencimento: t.data_vencimento || new Date().toISOString().split('T')[0],
            recorrente: t.recorrente || false,
            frequencia: t.frequencia || 'mensal',
            observacao: '',
            loja_id: t.loja_id || lojaAtual?.id || '',
            modalidade: t.recorrente ? (t.frequencia === 'mensal' ? 'FIXO_MENSAL' : t.frequencia === 'mensal_variavel' ? 'FIXO_VARIAVEL' : 'FIXO_MENSAL') : 'VARIAVEL'
        });
        setShowModal(true);
    };

    const handleDeleteClick = async (t: TransacaoFinanceira) => {
        if (exclusaoState.emProgresso) {
            toast({ message: 'Exclusão em andamento...', type: 'warning' });
            return;
        }
        const confirmed = await confirm({ title: 'Excluir Lançamento', description: `Excluir "${t.descricao || t.item}"?`, variant: 'danger', confirmLabel: 'Excluir' });
        if (!confirmed) return;
        setExclusaoState({ emProgresso: true, id: t.id, erro: null });
        try {
            await excluirTransacao(t.id);
            toast({ message: 'Lançamento excluído!', type: 'success' });
            await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
        } catch (error: any) {
            setExclusaoState(prev => ({ ...prev, erro: getErrorMessage(error) }));
            toast({ message: `Erro: ${getErrorMessage(error)}`, type: 'error' });
        } finally {
            setExclusaoState({ emProgresso: false, id: null, erro: null });
        }
    };

    const handleSave = async () => {
        if (!formData.loja_id) return toast({ message: "Selecione a Filial.", type: 'error' });
        if (modalType === 'despesa' && !formData.categoriaPaiId && !formData.subcategoriaId) return toast({ message: "Selecione uma categoria para a despesa.", type: 'error' });
        if (formData.valor <= 0) return toast({ message: "Valor deve ser maior que zero.", type: 'error' });
        setProcessing(true);
        try {
            const categoriaFinalId = formData.subcategoriaId || formData.categoriaPaiId;
            const catAtual = categoriaFinalId ? categorias.find(c => c.id === categoriaFinalId) : null;
            const isRecorrente = formData.modalidade === 'FIXO_MENSAL' || formData.modalidade === 'FIXO_VARIAVEL';
            const freqFinal = formData.modalidade === 'FIXO_MENSAL' ? 'mensal' : formData.modalidade === 'FIXO_VARIAVEL' ? 'mensal_variavel' : null;
            const itemFinal = formData.detalhe.trim() || (catAtual?.item || '');
            const descricaoFinal = formData.observacao || itemFinal;
            const payload = {
                tipo: modalType,
                descricao: descricaoFinal,
                valor: formData.valor,
                item: itemFinal,
                data_vencimento: formData.vencimento,
                recorrente: isRecorrente,
                frequencia: freqFinal,
                loja_id: formData.loja_id,
                item_financeiro_id: categoriaFinalId,
                status: (editingTransaction?.status || 'pendente') as StatusTransacao,
                data_pagamento: editingTransaction?.data_pagamento || null
            };
            if (editingTransaction) await atualizarTransacao(editingTransaction.id, payload);
            else await salvarTransacao(payload);
            toast({ message: `Lançamento ${editingTransaction ? 'atualizado' : 'registrado'}!`, type: 'success' });
            setShowModal(false);
            setEditingTransaction(null);
            await Promise.all([fetchItens(lojaAtual?.id || null), buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null)]);
        } catch (error: any) {
            toast({ message: 'Erro: ' + getErrorMessage(error), type: 'error' });
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
            toast({ message: 'Baixa realizada!', type: 'success' });
            setModalBaixaOpen(false);
            setTransacaoParaBaixa(null);
            await buscarTransacoesSeguro(ano, visualizacaoAnual ? 0 : mesSelecionado, lojaAtual?.id || null);
        } catch (error: any) {
            toast({ message: 'Erro na baixa: ' + getErrorMessage(error), type: 'error' });
        }
    };

    const handleExport = () => {
        try {
            const headers = ["Data", "Categoria", "Detalhe", "Tipo", "Valor", "Status"];
            const rows = filteredList.map(t => {
                const cat = categorias.find(c => c.id === t.item_financeiro_id);
                const nomeExibicao = cat ? (cat.parent_id ? `${categorias.find(p => p.id === cat.parent_id)?.item} › ${cat.item}` : cat.item) : 'Sem categoria';
                return [escapeCSV(t.data_vencimento || ''), escapeCSV(nomeExibicao), escapeCSV(t.item || ''), escapeCSV(t.tipo || ''), escapeCSV((t.valor || 0).toFixed(2)), escapeCSV(t.status || '')];
            });
            const csvContent = headers.join(",") + "\n" + rows.map(row => row.join(",")).join("\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `financeiro_${ano}_${visualizacaoAnual ? 'anual' : mesSelecionado}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({ message: 'Arquivo exportado!', type: 'success' });
        } catch (error) {
            toast({ message: 'Erro ao exportar', type: 'error' });
        }
    };

    const handlePrintTabela = () => {
        if (filteredList.length === 0) return toast({ message: 'Nenhum dado para imprimir.', type: 'warning' });
        const printWindow = window.open('', '_blank');
        if (!printWindow) return toast({ message: 'Permita pop-ups para imprimir', type: 'error' });
        const estilo = `<style>body{font-family:Arial;padding:20px}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f2f2f2}.valor{text-align:right}.total{font-weight:bold;background:#e8e8e8}</style>`;
        const periodo = visualizacaoAnual ? `Ano ${ano}` : `${new Date(ano, mesSelecionado-1, 1).toLocaleString('pt-BR', { month: 'long' })}/${ano}`;
        const titulo = abaAtiva === 'receitas' ? 'Receitas' : 'Despesas';
        const html = `<html><head><title>${titulo} - ${periodo}</title>${estilo}</head><body><h1>${titulo} - ${periodo}</h1><table><thead><tr><th>Vencimento</th><th>Filial</th><th>Categoria</th><th>Detalhe</th><th class="valor">Valor (R$)</th><th>Status</th></tr></thead><tbody>${filteredList.map(t => {
            const cat = categorias.find(c => c.id === t.item_financeiro_id);
            const nomeExibicao = cat ? (cat.parent_id ? `${categorias.find(p => p.id === cat.parent_id)?.item} › ${cat.item}` : cat.item) : 'Sem categoria';
            return `<tr><td>${t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '-'}</td><td>${lojasDisponiveis.find(l => l.id === t.loja_id)?.nome_fantasia || 'N/A'}</td><td>${nomeExibicao}</td><td>${t.item || '-'}</td><td class="valor">R$ ${(t.valor || 0).toFixed(2).replace('.', ',')}</td><td>${(t.status || 'pendente').toUpperCase()}</td></tr>`;
        }).join('')}<tr class="total"><td colspan="4">Total</td><td class="valor">R$ ${totalFiltrado.soma.toFixed(2).replace('.', ',')}</td><td></td></tr></tbody></table></body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
    };

    const handlePrintDRE = () => {
        if (transacoesDoPeriodoDRE.length === 0) return toast({ message: 'Nenhum dado no período.', type: 'warning' });
        const printWindow = window.open('', '_blank');
        if (!printWindow) return toast({ message: 'Permita pop-ups para imprimir', type: 'error' });
        const estilo = `<style>body{font-family:Arial;padding:20px}h1{font-size:20px}h2{font-size:16px;border-bottom:1px solid #ccc}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f2f2f2}.valor{text-align:right}.total{font-weight:bold;background:#e8e8e8}.lucro{color:green}.prejuizo{color:red}.categoria{font-weight:bold;background:#f9f9f9}.subcategoria{padding-left:20px;font-weight:bold;background:#f0f0f0}.detalhe{padding-left:40px}</style>`;
        let periodoDescricao = modoFiltroDRE === 'mensal' ? (visualizacaoAnual ? `Ano ${ano}` : `${new Date(ano, mesSelecionado-1, 1).toLocaleString('pt-BR', { month: 'long' })}/${ano}`) : `${new Date(dataInicio).toLocaleDateString()} a ${new Date(dataFim).toLocaleDateString()}`;
        const renderCategorias = (categoriasRaiz: any[]) => {
            if (!categoriasRaiz.length) return '<tr><td colspan="2">Nenhum lançamento.</td></tr>';
            return categoriasRaiz.map(raiz => `
                <tr class="categoria"><td><strong>${raiz.nome}</strong></td><td class="valor"><strong>R$ ${raiz.total.toFixed(2).replace('.', ',')}</strong></td></tr>
                ${raiz.subcategorias.map((sub: any) => `
                    <tr class="subcategoria"><td style="padding-left:20px;">└ ${sub.nome}</td><td class="valor">R$ ${sub.total.toFixed(2).replace('.', ',')}</td></tr>
                    ${sub.itens.map((item: any) => `<tr class="detalhe"><td style="padding-left:40px;">  ${item.detalhe}</td><td class="valor">R$ ${item.valor.toFixed(2).replace('.', ',')}</td></tr>`).join('')}
                `).join('')}
                ${raiz.itensDiretos.map((item: any) => `<tr class="detalhe"><td style="padding-left:20px;">  ${item.detalhe}</td><td class="valor">R$ ${item.valor.toFixed(2).replace('.', ',')}</td></tr>`).join('')}
            `).join('');
        };
        const html = `<html><head><title>DRE - ${periodoDescricao}</title>${estilo}</head><body><h1>Demonstração de Resultados - ${periodoDescricao}</h1><h2>Resultado Líquido</h2><table><thead><tr><th>Descrição</th><th class="valor">Valor (R$)</th></tr></thead><tbody><tr><td>Total de Entradas</td><td class="valor">R$ ${totalReceitasDRE.toFixed(2).replace('.', ',')}</td></tr><tr><td>Total de Saídas</td><td class="valor">R$ ${totalDespesasDRE.toFixed(2).replace('.', ',')}</td></tr><tr class="total ${lucroLiquidoDRE >= 0 ? 'lucro' : 'prejuizo'}"><td><strong>Resultado</strong></td><td class="valor"><strong>R$ ${lucroLiquidoDRE.toFixed(2).replace('.', ',')}</strong></td></tr></tbody></table><h2>Entradas (Receitas)</h2><table><thead><tr><th>Categoria / Subcategoria / Detalhe</th><th class="valor">Valor (R$)</th></tr></thead><tbody>${renderCategorias(receitasPorCategoriaRaiz)}<tr class="total"><td><strong>Total de Entradas</strong></td><td class="valor"><strong>R$ ${totalReceitasDRE.toFixed(2).replace('.', ',')}</strong></td></tr></tbody></table><h2>Saídas (Despesas)</h2><table><thead><tr><th>Categoria / Subcategoria / Detalhe</th><th class="valor">Valor (R$)</th></tr></thead><tbody>${renderCategorias(despesasPorCategoriaRaiz)}<tr class="total"><td><strong>Total de Saídas</strong></td><td class="valor"><strong>R$ ${totalDespesasDRE.toFixed(2).replace('.', ',')}</strong></td></tr></tbody></table></body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
    };

    const handleChartClick = (monthNumber: number) => { if (!visualizacaoAnual) setMesSelecionado(monthNumber); };
    const isBeingDeleted = (id: number) => exclusaoState.emProgresso && exclusaoState.id === id;
    const lucroLiquidoReal = resumoCalculado.receitas - resumoCalculado.despesas;
    const toggleCategoriaExpandida = (prefixo: string, nome: string) => {
        const key = `${prefixo}_${nome}`;
        setCategoriasExpandidas(prev => { const newSet = new Set(prev); if (newSet.has(key)) newSet.delete(key); else newSet.add(key); return newSet; });
    };

    return (
        <div className="financeiro-real">
            <PageHeader title="Gestão Financeira Real">
                {dataUltimaAtualizacao && <div className="flex items-center gap-2 text-xs text-muted mr-4"><RefreshCcw size={12} /><span>Atualizado: {dataUltimaAtualizacao.toLocaleTimeString()}</span></div>}
                {isAdmin && <select className="input min-w-[180px] font-bold border-accent-orange/50" value={lojaAtual?.id || ''} onChange={(e) => { const val = e.target.value; setLojaAtual(val ? lojasDisponiveis.find(l => l.id === val) || null : null); setMesSelecionado(new Date().getMonth() + 1); }}><option value="">Todas as Filiais</option>{lojasDisponiveis.map(loja => <option key={loja.id} value={loja.id}>Filial {loja.nome_fantasia}</option>)}</select>}
            </PageHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KPICard label="Receitas" value={`R$ ${resumoCalculado.receitas.toLocaleString('pt-BR')}`} icon={TrendingUp} variant="success" loading={loading} trend={{ value: 'Entrada', direction: 'up', description: 'Total do período' }} />
                <KPICard label="Custos" value={`R$ ${resumoCalculado.despesas.toLocaleString('pt-BR')}`} icon={TrendingDown} variant="danger" loading={loading} trend={{ value: 'Saída', direction: 'down', description: 'Total do período' }} />
                <KPICard label="Resultado Líquido" value={`R$ ${lucroLiquidoReal.toLocaleString('pt-BR')}`} icon={Scale} variant={lucroLiquidoReal >= 0 ? 'default' : 'danger'} loading={loading} trend={{ value: lucroLiquidoReal >= 0 ? 'Lucro' : 'Prejuízo', direction: lucroLiquidoReal >= 0 ? 'up' : 'down', description: 'Resultado real' }} />
            </div>
            <div className="flex gap-2 mb-4">
                <button className={`btn ${abaAtiva === 'receitas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAbaAtiva('receitas')}><TrendingUp size={16} /> Receitas</button>
                <button className={`btn ${abaAtiva === 'despesas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAbaAtiva('despesas')}><TrendingDown size={16} /> Despesas</button>
                <button className={`btn ${abaAtiva === 'fechamento' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAbaAtiva('fechamento')}><BarChart3 size={16} /> Fechamento (DRE)</button>
            </div>
            <div className="card transition-all duration-300">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <div><h3 className="chart-title mb-0">{abaAtiva === 'receitas' ? 'Melhoria de Fluxo (Receitas)' : abaAtiva === 'despesas' ? 'Evolução de Custos (Despesas)' : 'Fechamento Consolidado (DRE)'}</h3>{abaAtiva !== 'fechamento' && !visualizacaoAnual && <p className="text-[10px] text-muted mt-1 flex items-center gap-1"><Calendar size={10} /> Clique nas barras do gráfico para filtrar por mês</p>}</div>
                    {abaAtiva !== 'fechamento' ? (
                        <div className="flex gap-3 items-center flex-wrap">
                            <button className="btn btn-sm btn-ghost text-muted hover:text-white" onClick={handleRefresh} disabled={loading}><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /></button>
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10"><span className="text-xs font-semibold text-muted">Ano Completo:</span><div className={`relative w-10 h-5 rounded-full cursor-pointer transition-all ${visualizacaoAnual ? 'bg-blue-500' : 'bg-white/20'}`} onClick={() => setVisualizacaoAnual(!visualizacaoAnual)}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${visualizacaoAnual ? 'left-5' : 'left-0.5'}`} /></div></div>
                            <select className="input input-sm font-bold text-xs px-2 py-1" value={ano} onChange={e => setAno(parseInt(e.target.value))}>{[...new Set([new Date().getFullYear(), ano, ...anosDisponiveis])].sort((a,b)=>b-a).map(anoVal => <option key={anoVal} value={anoVal}>{anoVal}</option>)}</select>
                            <select className="input input-sm font-medium text-xs px-2 py-1 bg-blue/5 border border-white/10 rounded-md min-w-[180px]" value={modalidadeFilter} onChange={e => setModalidadeFilter(e.target.value as typeof modalidadeFilter)}><option value="all">Recorrência: Todas ({modalidadeCounts.total})</option><option value="FIXO_MENSAL">📆 Fixo Mensal ({modalidadeCounts.FIXO_MENSAL})</option><option value="FIXO_VARIAVEL">🔄 Fixo Variável ({modalidadeCounts.FIXO_VARIAVEL})</option><option value="VARIAVEL">⚡ Variável ({modalidadeCounts.VARIAVEL})</option></select>
                            {abaAtiva === 'despesas' && categoriasPaiFiltro.length > 0 && <select className="input input-sm font-medium text-xs px-2 py-1 bg-purple/5 border border-white/10 rounded-md min-w-[180px]" value={categoriaPaiFilter === 'all' ? 'all' : String(categoriaPaiFilter)} onChange={e => setCategoriaPaiFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}><option value="all">Categoria: Todas</option>{categoriasPaiFiltro.map(cat => <option key={cat.id} value={cat.id}>{cat.item}</option>)}</select>}
                            <button className="btn btn-sm btn-ghost text-muted hover:text-white" onClick={handleExport} disabled={filteredList.length===0}><FileText size={16} /></button>
                            <button className="btn btn-sm btn-ghost text-muted hover:text-white" onClick={handlePrintTabela}><Printer size={16} /></button>
                            <button className="btn btn-sm btn-ghost text-blue-300 hover:text-white border border-blue-500/20" onClick={() => setShowReplicarModal(true)} disabled={loading}><Copy size={14} /> Replicar Mês</button>
                            <button className="btn btn-sm btn-accent" onClick={() => handleOpenModalNew(abaAtiva === 'receitas' ? 'receita' : 'despesa')} disabled={loading}><Plus size={14} /> Novo Lançamento</button>
                        </div>
                    ) : (
                        <div className="flex gap-3 items-center flex-wrap">
                            <div className="flex items-center gap-2 bg-white/5 px-2 py-1.5 rounded-lg"><span className="text-xs text-muted">Filtro:</span><button className={`px-2 py-1 text-xs rounded ${modoFiltroDRE === 'mensal' ? 'bg-blue-500 text-white' : 'bg-white/10 text-muted'}`} onClick={() => setModoFiltroDRE('mensal')}>Mês/Ano</button><button className={`px-2 py-1 text-xs rounded ${modoFiltroDRE === 'personalizado' ? 'bg-blue-500 text-white' : 'bg-white/10 text-muted'}`} onClick={() => setModoFiltroDRE('personalizado')}>Personalizado</button></div>
                            {modoFiltroDRE === 'mensal' ? (
                                <>
                                    <select className="input input-sm font-bold text-xs px-2 py-1" value={ano} onChange={e => setAno(parseInt(e.target.value))}>{[...new Set([new Date().getFullYear(), ano, ...anosDisponiveis])].sort((a,b)=>b-a).map(anoVal => <option key={anoVal} value={anoVal}>{anoVal}</option>)}</select>
                                    <select className="input input-sm font-bold text-xs px-2 py-1" value={mesSelecionado} onChange={e => setMesSelecionado(parseInt(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{new Date(ano,m-1,1).toLocaleString('pt-BR',{month:'long'})}</option>)}</select>
                                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5"><span className="text-xs">Ano Completo:</span><div className={`relative w-10 h-5 rounded-full cursor-pointer transition-all ${visualizacaoAnual ? 'bg-blue-500' : 'bg-white/20'}`} onClick={() => setVisualizacaoAnual(!visualizacaoAnual)}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${visualizacaoAnual ? 'left-5' : 'left-0.5'}`} /></div></div>
                                </>
                            ) : (
                                <>
                                    <input type="date" className="input input-sm" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                                    <span className="text-muted">até</span>
                                    <input type="date" className="input input-sm" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                                </>
                            )}
                            <button className="btn btn-sm btn-primary" onClick={handlePrintDRE}><Printer size={16} /> Imprimir DRE</button>
                        </div>
                    )}
                </div>
                {loading ? <LoadingState type="list" /> : abaAtiva === 'fechamento' ? (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-2 text-slate-200"><Scale size={20} /><h3 className="font-bold uppercase tracking-wider text-sm">Resultado Líquido</h3></div>
                            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                                <div className={`flex items-center justify-center w-24 h-24 rounded-full ${lucroLiquidoDRE>=0?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400'}`}>{lucroLiquidoDRE>=0?<TrendingUp size={48}/>:<TrendingDown size={48}/>}</div>
                                <div className="text-center"><p className="text-sm text-muted uppercase font-bold mb-2">Saldo do Período</p><h2 className={`text-4xl font-black ${lucroLiquidoDRE>=0?'text-emerald-400':'text-red-400'}`}>R$ {Math.abs(lucroLiquidoDRE).toLocaleString('pt-BR')}</h2><p className={`text-sm font-bold mt-2 ${lucroLiquidoDRE>=0?'text-emerald-500':'text-red-500'}`}>{lucroLiquidoDRE>=0?'LUCRO OPERACIONAL':'PREJUÍZO OPERACIONAL'}</p></div>
                                <div className="w-full grid grid-cols-2 gap-4 mt-4 pt-6 border-t border-white/5"><div className="text-center"><p className="text-[10px] text-muted uppercase">Margem</p><p className="font-bold text-white">{totalReceitasDRE>0?((lucroLiquidoDRE/totalReceitasDRE)*100).toFixed(1):'0'}%</p></div><div className="text-center"><p className="text-[10px] text-muted uppercase">Balanço</p><p className={`font-bold ${lucroLiquidoDRE>=0?'text-emerald-400':'text-red-400'}`}>{lucroLiquidoDRE>=0?'Positivo':'Negativo'}</p></div></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Receitas */}
                            <div className="flex flex-col bg-emerald-500/5 rounded-xl border border-emerald-500/10 overflow-hidden">
                                <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/10 flex justify-between items-center"><div className="flex items-center gap-2 text-emerald-400"><TrendingUp size={20} /><h3 className="font-bold uppercase tracking-wider text-sm">Entradas (Receitas)</h3></div><span className="font-black text-lg text-emerald-400">R$ {totalReceitasDRE.toLocaleString('pt-BR')}</span></div>
                                <div className="p-4 space-y-2 overflow-y-auto max-h-[500px]">
                                    {receitasPorCategoriaRaiz.length === 0 ? <p className="text-center text-muted text-sm py-10">Nenhuma receita no período.</p> : receitasPorCategoriaRaiz.map(raiz => {
                                        const isExpanded = categoriasExpandidas.has(`receita_${raiz.nome}`);
                                        return <div key={raiz.id} className="border border-white/10 rounded-lg overflow-hidden">
                                            <div className="flex justify-between items-center p-3 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 transition-colors" onClick={() => toggleCategoriaExpandida('receita', raiz.nome)}><div className="flex items-center gap-2">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span className="font-bold text-emerald-100">{raiz.nome}</span><span className="text-xs text-muted">({raiz.subcategorias.reduce((acc, sub) => acc + sub.itens.length, 0) + raiz.itensDiretos.length} item(s))</span></div><span className="font-bold text-emerald-400">R$ {raiz.total.toLocaleString('pt-BR')}</span></div>
                                            {isExpanded && <div className="p-3 space-y-2 border-t border-white/5">
                                                {raiz.subcategorias.map(sub => <div key={sub.id} className="ml-4"><div className="flex justify-between items-center text-sm font-semibold text-emerald-200/80"><span>└ {sub.nome}</span><span>R$ {sub.total.toLocaleString('pt-BR')}</span></div><div className="ml-4 space-y-1 mt-1">{sub.itens.map(item => <div key={item.id} className="flex justify-between items-center text-xs pl-2 text-muted"><span>{item.detalhe}</span><span className="font-mono text-emerald-300">R$ {item.valor.toLocaleString('pt-BR')}</span></div>)}</div></div>)}
                                                {raiz.itensDiretos.map(item => <div key={item.id} className="ml-4 flex justify-between items-center text-sm"><span>{item.detalhe}</span><span className="font-mono text-emerald-300">R$ {item.valor.toLocaleString('pt-BR')}</span></div>)}
                                            </div>}
                                        </div>;
                                    })}
                                </div>
                            </div>
                            {/* Despesas */}
                            <div className="flex flex-col bg-red-500/5 rounded-xl border border-red-500/10 overflow-hidden">
                                <div className="p-4 bg-red-500/10 border-b border-red-500/10 flex justify-between items-center"><div className="flex items-center gap-2 text-red-400"><TrendingDown size={20} /><h3 className="font-bold uppercase tracking-wider text-sm">Saídas (Despesas)</h3></div><span className="font-black text-lg text-red-400">R$ {totalDespesasDRE.toLocaleString('pt-BR')}</span></div>
                                <div className="p-4 space-y-2 overflow-y-auto max-h-[500px]">
                                    {despesasPorCategoriaRaiz.length === 0 ? <p className="text-center text-muted text-sm py-10">Nenhuma despesa no período.</p> : despesasPorCategoriaRaiz.map(raiz => {
                                        const isExpanded = categoriasExpandidas.has(`despesa_${raiz.nome}`);
                                        return <div key={raiz.id} className="border border-white/10 rounded-lg overflow-hidden">
                                            <div className="flex justify-between items-center p-3 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-colors" onClick={() => toggleCategoriaExpandida('despesa', raiz.nome)}><div className="flex items-center gap-2">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span className="font-bold text-red-100">{raiz.nome}</span><span className="text-xs text-muted">({raiz.subcategorias.reduce((acc, sub) => acc + sub.itens.length, 0) + raiz.itensDiretos.length} item(s))</span></div><span className="font-bold text-red-400">R$ {raiz.total.toLocaleString('pt-BR')}</span></div>
                                            {isExpanded && <div className="p-3 space-y-2 border-t border-white/5">
                                                {raiz.subcategorias.map(sub => <div key={sub.id} className="ml-4"><div className="flex justify-between items-center text-sm font-semibold text-red-200/80"><span>└ {sub.nome}</span><span>R$ {sub.total.toLocaleString('pt-BR')}</span></div><div className="ml-4 space-y-1 mt-1">{sub.itens.map(item => <div key={item.id} className="flex justify-between items-center text-xs pl-2 text-muted"><span>{item.detalhe}</span><span className="font-mono text-red-300">R$ {item.valor.toLocaleString('pt-BR')}</span></div>)}</div></div>)}
                                                {raiz.itensDiretos.map(item => <div key={item.id} className="ml-4 flex justify-between items-center text-sm"><span>{item.detalhe}</span><span className="font-mono text-red-300">R$ {item.valor.toLocaleString('pt-BR')}</span></div>)}
                                            </div>}
                                        </div>;
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="mb-6 px-2"><FinancialGrowthChart data={chartData} type={abaAtiva as 'receita' | 'despesa'} year={ano} series={chartSeries} onBarClick={handleChartClick} selectedMonth={visualizacaoAnual ? undefined : (mesSelecionado ?? 1)} showAllMonths={visualizacaoAnual} /></div>
                        <div className="table-container pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between mb-4"><h4 className="text-xs font-black uppercase text-muted tracking-widest">{visualizacaoAnual ? `Movimentações de ${ano} (Ano Completo)` : `Movimentações de ${new Date(ano, mesSelecionado-1, 1).toLocaleString('pt-BR', { month: 'long' })}`}</h4><div className="flex items-center gap-4 text-sm"><span className="text-muted">{totalFiltrado.quantidade} registro{totalFiltrado.quantidade !== 1 ? 's' : ''}</span><span className={`font-bold ${abaAtiva === 'receitas' ? 'text-success' : 'text-danger'}`}>Total: R$ {totalFiltrado.soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div>
                            <table className="w-full"><thead><tr><th>Vencimento</th><th>Filial</th><th>Categoria</th><th>Detalhe</th><th>Recorrência</th><th className="text-right">Valor</th><th className="text-center">Status</th><th></th></tr></thead><tbody>{filteredList.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-muted italic">Nenhum lançamento encontrado.</td></tr> : filteredList.map(t => { const deletando = isBeingDeleted(t.id); const cat = categorias.find(c => c.id === t.item_financeiro_id); let nomeExibicao = 'Sem categoria'; if (cat) nomeExibicao = cat.parent_id ? `${categorias.find(p => p.id === cat.parent_id)?.item} › ${cat.item}` : cat.item; return <tr key={t.id} className={`group hover:bg-white/5 transition-colors ${deletando?'opacity-50 pointer-events-none':''}`}><td className="text-xs font-mono text-muted">{t.data_vencimento?t.data_vencimento.split('-').reverse().join('/'):'-'}</td><td className="text-[10px] font-bold text-text-secondary">{lojasDisponiveis.find(l=>l.id===t.loja_id)?.nome_fantasia||'N/A'}</td><td className="text-xs font-semibold">{nomeExibicao}</td><td className="text-sm">{t.item || '-'}</td><td className="text-[10px] font-bold uppercase">{(()=>{const m = getModalidadeFromTransacao(t); if(m === 'FIXO_MENSAL') return <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md">Fixo Mensal</span>; if(m === 'FIXO_VARIAVEL') return <span className="bg-pink-500/10 text-pink-400 px-2 py-1 rounded-md">Fixo Variável</span>; return <span className="bg-orange-500/10 text-orange-400 px-2 py-1 rounded-md">Variável</span>;})()}</td><td className={`text-right font-black ${t.tipo==='receita'?'text-success':'text-danger'}`}>R$ {(t.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td className="text-center"><span className={`badge ${t.status==='pago'?'success':'warning'} text-[10px]`}>{(t.status||'pendente').toUpperCase()}</span></td><td className="text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">{t.status==='pendente' && <button className="btn btn-ghost btn-xs text-success hover:bg-success/20" onClick={()=>handleBaixaClick(t)} disabled={deletando}><CheckCircle2 size={14}/></button>}<button className="btn btn-ghost btn-xs text-blue-400 hover:bg-blue-400/20" onClick={()=>handleEditClick(t)} disabled={deletando}><Pencil size={14}/></button><button className={`btn btn-ghost btn-xs text-danger hover:bg-danger/20 relative ${deletando?'cursor-not-allowed opacity-50':''}`} onClick={()=>handleDeleteClick(t)} disabled={deletando}>{deletando?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}</button></td></tr>;})}</tbody></table>
                            {exclusaoState.erro && <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2"><AlertCircle size={16} className="text-danger" /><span className="text-xs text-danger">Erro na exclusão: {exclusaoState.erro}. Tente novamente.</span><button className="btn btn-xs btn-ghost text-danger ml-auto" onClick={()=>setExclusaoState(prev=>({...prev,erro:null}))}><X size={12}/></button></div>}
                        </div>
                    </div>
                )}
            </div>
            <ReplicarUltimoMesModal isOpen={showReplicarModal} onClose={()=>setShowReplicarModal(false)} lojaId={lojaAtual?.id||null} anoAtual={ano} mesAtual={mesSelecionado} onSuccess={()=>buscarTransacoesSeguro(ano,visualizacaoAnual?0:mesSelecionado,lojaAtual?.id||null)} />
            <ModalBaixaFinanceira isOpen={modalBaixaOpen} onClose={()=>{setModalBaixaOpen(false);setTransacaoParaBaixa(null);}} transaction={transacaoParaBaixa} onConfirm={handleConfirmBaixa} />
            {showModal && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={(e)=>{if(e.target===e.currentTarget&&!processing) setShowModal(false);}}>
                    <div className="card" style={{width:'100%',maxWidth:'550px',padding:'1.5rem'}}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10"><h3 className="text-lg font-bold">{editingTransaction?'Editar Lançamento':(modalType==='receita'?'Nova Receita':'Nova Despesa')}</h3><button onClick={()=>setShowModal(false)} disabled={processing} className="text-muted hover:text-white"><X size={18}/></button></div>
                        <div className="flex flex-col gap-4">
                            {(isAdmin||lojasDisponiveis.length>1) && <div className="form-group"><label className="text-blue-400">Filial *</label><select className="input border-blue-500/30 bg-blue-500/5 font-bold" value={formData.loja_id} onChange={e=>setFormData({...formData,loja_id:e.target.value})} disabled={processing}><option value="">Selecione a Filial...</option>{lojasDisponiveis.map(loja=><option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>)}</select></div>}
                            <div className="form-group"><label>Categoria Principal {modalType === 'despesa' && '*'}</label><select className="input" value={formData.categoriaPaiId || ''} onChange={(e)=>{const paiId=e.target.value?Number(e.target.value):null; setFormData({...formData,categoriaPaiId:paiId,subcategoriaId:null,modalidade:'VARIAVEL',detalhe:'',valor:0}); if(paiId){const pai=categoriasPaiForm.find(c=>c.id===paiId); if(pai) setFormData(prev=>({...prev,modalidade:pai.tipo_recorrencia||'VARIAVEL'}));}}} disabled={processing}><option value="">Selecione uma categoria principal</option>{categoriasPaiForm.map(cat=><option key={cat.id} value={cat.id}>{cat.item}</option>)}</select>{modalType==='despesa'&&!formData.categoriaPaiId&&!formData.subcategoriaId&&<p className="text-[9px] text-danger mt-1">⚠️ Obrigatório para despesas</p>}</div>
                            {formData.categoriaPaiId && subcategoriasDisponiveis.length > 0 && <div className="form-group"><label>Subcategoria (opcional)</label><select className="input" value={formData.subcategoriaId || ''} onChange={(e)=>{const subId=e.target.value?Number(e.target.value):null; setFormData({...formData,subcategoriaId:subId}); if(subId) handleCategoriaChange(subId);}} disabled={processing}><option value="">Selecione uma subcategoria</option>{subcategoriasDisponiveis.map(sub=><option key={sub.id} value={sub.id}>{sub.item}</option>)}</select><p className="text-[10px] text-muted mt-1">Use para detalhar ainda mais (ex: Salário, INSS, etc.)</p></div>}
                            <div className="form-group"><label>Detalhamento (opcional)</label><input className="input" value={formData.detalhe} onChange={e=>setFormData({...formData,detalhe:e.target.value})} placeholder="Ex: João Silva, competência Maio/2025" disabled={processing} /><p className="text-[10px] text-muted mt-1">Especificação adicional (funcionário, tipo de encargo, etc.)</p></div>
                            <div className="grid grid-cols-2 gap-4"><div className="form-group"><label>Valor (R$)</label><MoneyInput value={formData.valor} onValueChange={v=>setFormData({...formData,valor:v})} disabled={processing} /></div><div className="form-group"><label>Vencimento</label><input type="date" className="input" value={formData.vencimento} onChange={e=>setFormData({...formData,vencimento:e.target.value})} disabled={processing} /></div></div>
                            <div className="form-group"><label>Tipo de Recorrência</label><div className="grid grid-cols-3 gap-2">{[
                                {key:'FIXO_MENSAL',label:'Fixo Mensal',desc:'Automático todo mês'},
                                {key:'FIXO_VARIAVEL',label:'Fixo Variável',desc:'Todo mês, valor varia'},
                                {key:'VARIAVEL',label:'Variável',desc:'Eventual / Manual'}
                            ].map(opt=>{const isSelected=formData.modalidade===opt.key; return <button key={opt.key} type="button" className={`p-2 rounded-lg border text-left transition-all text-xs ${isSelected?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-muted hover:border-white/20'}`} onClick={()=>setFormData({...formData,modalidade:opt.key as any})} disabled={processing}><span className="font-bold block">{opt.label}</span><span className="text-[10px] opacity-70">{opt.desc}</span></button>;})}</div></div>
                            <div className="form-group"><label>Observação (opcional)</label><textarea className="input" rows={2} value={formData.observacao} onChange={e=>setFormData({...formData,observacao:e.target.value})} placeholder="Informações adicionais" disabled={processing} /></div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10"><button className="btn btn-ghost" onClick={()=>setShowModal(false)} disabled={processing}>Cancelar</button><button className={`btn ${modalType==='receita'?'btn-primary':'btn-danger'}`} onClick={handleSave} disabled={processing||!formData.loja_id||(modalType==='despesa'&&!formData.categoriaPaiId&&!formData.subcategoriaId)||formData.valor<=0}>{processing?<><Loader2 size={14} className="animate-spin mr-1"/> Salvando...</>:'Salvar'}</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
