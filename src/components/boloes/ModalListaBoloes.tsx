'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Search,
    ChevronRight,
    ArrowUpRight,
    Loader2,
    ShoppingCart,
    ShoppingBag,
    Check,
    Pencil,
    Trash2,
    Shield,
    AlertCircle
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { LogoLoteria } from '@/components/ui/LogoLoteria';
import { LOTERIAS_OFFICIAL } from '@/data/loterias-config';
import { getBoloes, getCotasBolao, updateBolao, deleteBolao } from '@/actions/boloes';
import { useVendasBolao } from '@/hooks/useVendasBolao';
import { usePerfil } from '@/hooks/usePerfil';
import { useLoja } from '@/contexts/LojaContext';
import { ArrowLeft } from 'lucide-react';
import { ModalVendaBolao } from './ModalVendaBolao';
import { ModalVendaLoteBolao } from './ModalVendaLoteBolao';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { FINANCIAL_RULES } from '@/lib/financial-constants';
import { getProdutos } from '@/actions/boloes';

interface ModalListaBoloesProps {
    jogo: string;
    cor: string;
    onClose: () => void;
}

export function ModalListaBoloes({ jogo, cor, onClose }: ModalListaBoloesProps) {
    const { lojaAtual, lojasDisponiveis } = useLoja();
    const { isAdmin, podeGerenciarCaixaBolao: canManageBoloes } = usePerfil();
    const { toast } = useToast();
    const confirm = useConfirm();

    const [filter, setFilter] = useState('todos');
    const [boloes, setBoloes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [lojaSelecionada, setLojaSelecionada] = useState(lojaAtual);

    const [viewMode, setViewMode] = useState<'list' | 'cotas'>('list');
    const [selectedBolao, setSelectedBolao] = useState<any | null>(null);
    const [cotas, setCotas] = useState<any[]>([]);
    const [isLoadingCotas, setIsLoadingCotas] = useState(false);
    const [cotasError, setCotasError] = useState<string | null>(null);

    const { venderCota, loading: selling } = useVendasBolao();

    const [sellingId, setSellingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [editingBolao, setEditingBolao] = useState<any | null>(null);
    const [cotaToSell, setCotaToSell] = useState<any | null>(null);
    const [bolaoForBulkSale, setBolaoForBulkSale] = useState<any | null>(null);

    // Produtos para o select de dezenas na edição
    const [produtos, setProdutos] = useState<any[]>([]);
    useEffect(() => {
        const loadProdutos = async () => {
            try {
                const data = await getProdutos(lojaSelecionada?.id);
                setProdutos(data);
            } catch (error) {
                console.error('Erro ao carregar produtos:', error);
            }
        };
        loadProdutos();
    }, [lojaSelecionada]);

    const selectedProduct = produtos.find(p => p.nome === jogo);

    // Função para carregar a lista de bolões (centralizada)
    const carregarBoloes = async () => {
        if (!lojaSelecionada?.id) return;
        setIsLoading(true);
        try {
            const data = await getBoloes({ lojaId: lojaSelecionada.id });
            setBoloes(data.filter(b => b.jogo === jogo));
        } catch (error) {
            console.error('Falha ao carregar bolões:', error);
            toast({ message: 'Erro ao carregar bolões. Tente novamente.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Carrega os bolões ao montar ou quando a loja/jogo mudar
    useEffect(() => {
        carregarBoloes();
    }, [jogo, lojaSelecionada]);

    // Excluir bolão (com recarga da lista)
   const handleDeleteBolao = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const confirmed = await confirm({
        title: 'Excluir Concurso',
        description: 'Deseja realmente excluir este bolão e todas as suas cotas? Esta ação não pode ser desfeita.',
        variant: 'danger',
        confirmLabel: 'Sim, Excluir'
    });
    if (!confirmed) return;

    // 1. Remove o item da UI imediatamente (otimista)
    setBoloes(prev => prev.filter(b => b.id !== id));

    setIsDeleting(id);
    try {
        const result = await deleteBolao(id);
        if (result.success) {
            toast({ message: 'Bolão excluído com sucesso!', type: 'success' });
            // 2. Recarrega a lista para garantir consistência com o servidor
            await carregarBoloes();
        } else {
            // Se a exclusão falhou, recarrega para restaurar o item removido
            await carregarBoloes();
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error: any) {
        console.error('Erro ao excluir bolão:', error);
        toast({ message: 'Falha ao excluir bolão: ' + error.message, type: 'error' });
        // Recarrega novamente para garantir consistência
        await carregarBoloes();
    } finally {
        setIsDeleting(null);
    }
};

    const handleEditBolao = (e: React.MouseEvent, bolao: any) => {
        e.stopPropagation();
        setEditingBolao({ ...bolao });
    };

    const handleSaveEdit = async () => {
        if (!editingBolao) return;

        if (editingBolao.qtdCotas < editingBolao.cotasVendidas) {
            toast({ message: `Total de cotas não pode ser menor que ${editingBolao.cotasVendidas} (já vendidas).`, type: 'error' });
            return;
        }

        const taxa = editingBolao.taxaAdministrativa || FINANCIAL_RULES.AGIO_BOLOES;
        const valorBaseRecalculado = editingBolao.precoVendaCota / (1 + taxa / 100);
        const dadosAtualizados = {
            concurso: editingBolao.concurso,
            dataSorteio: editingBolao.dataSorteio,
            qtdJogos: editingBolao.qtdJogos,
            dezenas: editingBolao.dezenas,
            valorCotaBase: valorBaseRecalculado,
            taxaAdministrativa: taxa,
            qtdCotas: editingBolao.qtdCotas,
            precoVendaCota: editingBolao.precoVendaCota,
            status: editingBolao.status
        };

        try {
            await updateBolao(editingBolao.id, dadosAtualizados);
            setBoloes(prev => prev.map(b => b.id === editingBolao.id ? { ...b, ...dadosAtualizados } : b));
            setEditingBolao(null);
            toast({ message: 'Alterações salvas com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: 'Falha ao salvar: ' + error.message, type: 'error' });
        }
    };

    const handleOpenCotas = async (bolao: any) => {
        setSelectedBolao(bolao);
        setViewMode('cotas');
        setIsLoadingCotas(true);
        setCotasError(null);
        try {
            const result = await getCotasBolao(bolao.id);
            if (result.error) {
                setCotasError(`Erro: ${result.error}`);
                setCotas([]);
            } else {
                setCotas(result.data);
                if (result.data.length === 0) {
                    setCotasError(`Nenhuma cota encontrada para bolão ID ${bolao.id}.`);
                }
            }
        } catch (error: any) {
            console.error('Erro ao carregar cotas:', error);
            setCotasError(`Erro: ${error?.message || 'Falha desconhecida'}`);
            setCotas([]);
        } finally {
            setIsLoadingCotas(false);
        }
    };

    const handleSellSuccess = async () => {
        if (!cotaToSell || !selectedBolao) return;
        const cotaId = cotaToSell.id;
        setSellingId(cotaId);
        setCotaToSell(null);
        try {
            await venderCota({
                bolaoId: selectedBolao.id,
                quantidade: 1,
                valorTotal: selectedBolao.precoVendaCota,
                metodo: 'dinheiro',
                cotaId: cotaId
            });
            setCotas(prev => prev.map(c => c.id === cotaId ? { ...c, status: 'vendida' } : c));
            setBoloes(prev => prev.map(b => b.id === selectedBolao.id ? { ...b, cotasVendidas: b.cotasVendidas + 1 } : b));
            toast({ message: 'Cota vendida com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: error.message, type: 'error' });
        } finally {
            setSellingId(null);
        }
    };

    const handleBulkSellSuccess = async () => {
        if (!bolaoForBulkSale) return;
        const bolaoId = bolaoForBulkSale.id;
        setBolaoForBulkSale(null);
        try {
            await carregarBoloes();
            if (viewMode === 'cotas' && selectedBolao?.id === bolaoId) {
                const cotasResult = await getCotasBolao(bolaoId);
                setCotas(cotasResult.data);
            }
        } catch (error) {
            console.error('Erro ao atualizar dados após venda em lote');
        }
    };

    const filteredBoloes = boloes.filter(b => {
        const matchesSearch = b.concurso.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.id.toString().includes(searchTerm);
        if (!matchesSearch) return false;
        if (filter === 'disponiveis') return b.status === 'disponivel';
        if (filter === 'finalizados') return b.status === 'finalizado';
        return true;
    });

    const groupedFilteredBoloes = filteredBoloes.reduce((acc: any, bolao: any) => {
        if (!acc[bolao.concurso]) acc[bolao.concurso] = [];
        acc[bolao.concurso].push(bolao);
        return acc;
    }, {});

    const slug = jogo.toLowerCase().replace(' ', '-');
    const config = LOTERIAS_OFFICIAL[slug];

    return (
        <div className="modal-overlay fixed inset-0 bg-black/60 z-9999 flex items-center justify-center">
            <div className="modal-container animate-in fade-in zoom-in-95" style={{
                width: '90%',
                maxWidth: 900,
                height: '85vh',
                maxHeight: 800,
                background: 'var(--bg-card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header com cor da loteria */}
                <div style={{
                    background: cor,
                    padding: '1.5rem',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }}>
                    <div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            background: 'rgba(255,255,255,0.15)',
                            padding: '0.35rem 1rem',
                            borderRadius: '24px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            marginBottom: '0.75rem',
                            textTransform: 'uppercase'
                        }}>
                            <LogoLoteria cor="#FFF" tamanho={16} temPlus={config?.temPlus} />
                            Loterias CAIXA
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{jogo}</h2>
                        <p style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '0.25rem' }}>Confira todas as cotas e concursos ativos</p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Seletor de filial */}
                {(isAdmin || lojasDisponiveis.length > 1) && (
                    <div className="p-4 px-6 border-b border-border bg-bg-card">
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-muted uppercase">Filial</label>
                            <select
                                className="input text-sm w-64"
                                value={lojaSelecionada?.id || ''}
                                onChange={(e) => {
                                    const loja = lojasDisponiveis.find(l => l.id === e.target.value);
                                    setLojaSelecionada(loja || null);
                                }}
                            >
                                {lojasDisponiveis.map(loja => (
                                    <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Filtros de status e busca */}
                <div className="p-4 px-6 border-b border-border bg-bg-card flex items-center gap-4 overflow-x-auto">
                    {['todos', 'disponiveis', 'finalizados'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${filter === f ? 'bg-surface-subtle text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                        >
                            {f === 'todos' ? 'Todos os Jogos' : f === 'disponiveis' ? 'Próximos Concursos' : 'Histórico'}
                        </button>
                    ))}
                    <div className="flex-1" />
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Buscar concurso..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm w-48 focus:w-64 focus:border-primary-blue-light transition-all outline-none"
                        />
                    </div>
                </div>

                {/* Conteúdo principal */}
                <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-dark)', position: 'relative' }}>
                    {viewMode === 'list' && (
                        isLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                <Loader2 size={32} className="animate-spin mb-4" />
                                <p>Carregando concursos...</p>
                            </div>
                        ) : Object.keys(groupedFilteredBoloes).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {Object.keys(groupedFilteredBoloes).sort((a, b) => b.localeCompare(a)).map(concurso => (
                                    <div key={concurso}>
                                        <div style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            padding: '0.75rem 2rem',
                                            borderBottom: '1px solid var(--border)',
                                            fontSize: '0.7rem',
                                            fontWeight: 900,
                                            color: cor,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            textTransform: 'uppercase'
                                        }}>
                                            <span>CONCURSO {concurso}</span>
                                            <span style={{ opacity: 0.5 }}>{groupedFilteredBoloes[concurso].length} BOLÕES ATIVOS</span>
                                        </div>
                                        {groupedFilteredBoloes[concurso].map((bolao: any) => (
                                            <div
                                                key={bolao.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '1.25rem 2rem',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onClick={() => handleOpenCotas(bolao)}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{
                                                            width: 44,
                                                            height: 44,
                                                            borderRadius: '12px',
                                                            background: `${cor}15`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <LogoLoteria cor={cor} tamanho={28} temPlus={config?.temPlus} />
                                                        </div>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                <span style={{ fontWeight: 800, fontSize: '1rem' }}>Bolão ID #{bolao.id.toString().padStart(4, '0')}</span>
                                                                <span style={{
                                                                    fontSize: '0.65rem',
                                                                    background: bolao.status === 'disponivel' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                                                                    color: bolao.status === 'disponivel' ? '#4ade80' : 'var(--text-muted)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '4px',
                                                                    fontWeight: 700
                                                                }}>
                                                                    {bolao.status.toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                {bolao.qtdJogos} jogos • {bolao.dezenas} dezenas • <strong>R$ {bolao.precoVendaCota.toLocaleString('pt-BR')}</strong>/cota
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                                    <div style={{ textAlign: 'right', minWidth: '90px' }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 900, marginBottom: '0.25rem' }}>
                                                            {bolao.cotasVendidas} / {bolao.qtdCotas}
                                                        </div>
                                                        <div style={{ height: '3px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${(bolao.cotasVendidas / bolao.qtdCotas) * 100}%`, background: cor, borderRadius: '2px' }} />
                                                        </div>
                                                    </div>
                                                    {canManageBoloes && (
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setBolaoForBulkSale(bolao); }}
                                                                title="Venda em Lote"
                                                                style={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    borderRadius: '8px',
                                                                    background: 'rgba(34, 197, 94, 0.1)',
                                                                    color: '#22c55e',
                                                                    border: 'none',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <ShoppingBag size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleEditBolao(e, bolao)}
                                                                title="Editar Concurso"
                                                                style={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    borderRadius: '8px',
                                                                    background: 'rgba(255,153,0,0.1)',
                                                                    color: '#f97316',
                                                                    border: 'none',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteBolao(e, bolao.id)}
                                                                disabled={isDeleting === bolao.id}
                                                                title="Excluir Concurso"
                                                                style={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    borderRadius: '8px',
                                                                    background: 'rgba(239,68,68,0.1)',
                                                                    color: '#ef4444',
                                                                    border: 'none',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    opacity: isDeleting === bolao.id ? 0.5 : 1
                                                                }}
                                                            >
                                                                {isDeleting === bolao.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: '10px',
                                                        background: 'var(--surface-subtle)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: cor,
                                                        border: '1px solid var(--border)'
                                                    }}>
                                                        <ChevronRight size={20} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '3rem', color: 'var(--text-muted)' }}>
                                <Search size={48} style={{ marginBottom: '1rem', opacity: 0.1 }} />
                                <p>Nenhum bolão encontrado para esta filial.</p>
                            </div>
                        )
                    )}

                    {viewMode === 'cotas' && selectedBolao && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} className="animate-in slide-in-from-right duration-300">
                            <div style={{
                                padding: '1.25rem 2rem',
                                borderBottom: '1px solid var(--border)',
                                background: 'var(--bg-card)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <button onClick={() => setViewMode('list')} style={{
                                    background: 'var(--surface-subtle)',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    width: 32,
                                    height: 32,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}>
                                    <ArrowLeft size={18} />
                                </button>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900 }}>Gerenciamento de Cotas</h4>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Bolão ID #{selectedBolao.id} • Concurso {selectedBolao.concurso} • {selectedBolao.qtdCotas} cotas totais
                                    </p>
                                </div>
                            </div>

                            <div style={{ padding: '0 2rem 2rem 2rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {isLoadingCotas ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                        <Loader2 size={32} className="animate-spin mb-4" />
                                        <p>Carregando cotas...</p>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'var(--bg-card)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)',
                                        overflow: 'hidden',
                                        flex: 1
                                    }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '80px 1fr 120px 100px 120px',
                                            padding: '0.75rem 1.5rem',
                                            background: 'var(--surface-subtle)',
                                            borderBottom: '1px solid var(--border)',
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase'
                                        }}>
                                            <span>Cota</span>
                                            <span>Identificador</span>
                                            <span>Valor</span>
                                            <span>Status</span>
                                            <span style={{ textAlign: 'right' }}>Ação</span>
                                        </div>
                                        <div style={{ overflowY: 'auto', flex: 1 }}>
                                            {cotas.length === 0 && !isLoadingCotas && (
                                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    <AlertCircle size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                                    <p><strong>Nenhuma cota encontrada</strong></p>
                                                    {cotasError && <p style={{ fontSize: '0.75rem', color: '#f97316' }}>{cotasError}</p>}
                                                </div>
                                            )}
                                            {cotas.map((cota, index) => (
                                                <div key={cota.id} style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '80px 1fr 120px 100px 120px',
                                                    padding: '1rem 1.5rem',
                                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                    alignItems: 'center',
                                                    background: cota.status === 'vendida' ? 'rgba(255,255,255,0.01)' : 'transparent',
                                                    opacity: cota.status === 'vendida' ? 0.7 : 1
                                                }}>
                                                    <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{index+1}</span>
                                                    <span style={{ fontWeight: 900, color: cota.status === 'vendida' ? 'var(--text-muted)' : cor }}>{cota.uid}</span>
                                                    <span>R$ {selectedBolao.precoVendaCota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    <div style={{
                                                        fontSize: '0.65rem',
                                                        background: cota.status === 'vendida' ? 'rgba(34,197,94,0.1)' : 'rgba(255,153,0,0.1)',
                                                        color: cota.status === 'vendida' ? '#4ade80' : '#ff9900',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontWeight: 800,
                                                        width: 'fit-content',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {cota.status === 'vendida' ? 'VENDIDA' : 'DISPONÍVEL'}
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        {cota.status === 'vendida' ? (
                                                            <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                                <Check size={14} /> PAGO
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setCotaToSell(cota)}
                                                                disabled={selling || sellingId === cota.id}
                                                                style={{
                                                                    background: cor,
                                                                    color: '#fff',
                                                                    border: 'none',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 900,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.4rem',
                                                                    opacity: selling ? 0.5 : 1
                                                                }}
                                                            >
                                                                {sellingId === cota.id ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                                                                VENDER
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                }}>
                    <span>Exibindo {filteredBoloes.length} itens</span>
                </div>

                {/* Modal de edição */}
                {editingBolao && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)',
                            width: '100%',
                            maxWidth: 600,
                            borderRadius: 24,
                            border: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            <div style={{ background: cor, padding: '1rem 1.5rem', color: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Editar Bolão #{editingBolao.id}</h3>
                                    <button onClick={() => setEditingBolao(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', opacity: 0.8 }}>
                                    Concurso {editingBolao.concurso} • {editingBolao.jogo}
                                </p>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} style={{ padding: '1.5rem' }}>
                                {editingBolao.cotasVendidas > 0 && (
                                    <div style={{
                                        background: 'rgba(239,68,68,0.1)',
                                        borderLeft: `4px solid #ef4444`,
                                        padding: '0.75rem 1rem',
                                        borderRadius: 12,
                                        marginBottom: '1.5rem',
                                        display: 'flex',
                                        gap: '0.75rem',
                                        alignItems: 'center'
                                    }}>
                                        <AlertCircle size={18} color="#ef4444" />
                                        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
                                            Este bolão já possui {editingBolao.cotasVendidas} venda(s). Alterar cotas ou preço pode gerar inconsistência.
                                            Recomenda-se alterar apenas o status.
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>Nº Concurso</label>
                                        <input type="text" value={editingBolao.concurso} onChange={e => setEditingBolao({ ...editingBolao, concurso: e.target.value })} className="input-expanded" />
                                    </div>
                                    <div className="form-group">
                                        <label>Data do Sorteio</label>
                                        <input type="date" value={editingBolao.dataSorteio?.split('T')[0] || ''} onChange={e => setEditingBolao({ ...editingBolao, dataSorteio: e.target.value })} className="input-expanded" />
                                    </div>
                                    <div className="form-group">
                                        <label>Quantidade de Jogos</label>
                                        <input type="number" min={1} value={editingBolao.qtdJogos} onChange={e => setEditingBolao({ ...editingBolao, qtdJogos: parseInt(e.target.value) || 1 })} className="input-expanded" />
                                    </div>
                                    <div className="form-group">
                                        <label>Dezenas</label>
                                        <select value={editingBolao.dezenas} onChange={e => setEditingBolao({ ...editingBolao, dezenas: parseInt(e.target.value) })} className="input-expanded">
                                            {selectedProduct && Array.from({ length: selectedProduct.maxDezenas - selectedProduct.minDezenas + 1 }, (_, i) => selectedProduct.minDezenas + i).map(n => (
                                                <option key={n} value={n}>{n} dezenas</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Total de Cotas</label>
                                        <input type="number" min={editingBolao.cotasVendidas} value={editingBolao.qtdCotas} onChange={e => setEditingBolao({ ...editingBolao, qtdCotas: parseInt(e.target.value) || 0 })} disabled={editingBolao.cotasVendidas > 0} className="input-expanded" />
                                        {editingBolao.cotasVendidas > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Mínimo: {editingBolao.cotasVendidas}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Preço Venda Cota (R$)</label>
                                        <MoneyInput value={editingBolao.precoVendaCota} onValueChange={v => setEditingBolao({ ...editingBolao, precoVendaCota: v })} disabled={editingBolao.cotasVendidas > 0} className="input-expanded" />
                                        {editingBolao.cotasVendidas > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Preço não alterável após vendas.</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Taxa Administrativa (%)</label>
                                        <input type="number" value={editingBolao.taxaAdministrativa || FINANCIAL_RULES.AGIO_BOLOES} readOnly className="input-expanded" style={{ background: 'var(--surface-subtle)' }} />
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select value={editingBolao.status} onChange={e => setEditingBolao({ ...editingBolao, status: e.target.value })} className="input-expanded">
                                            <option value="disponivel">Disponível</option>
                                            <option value="finalizado">Finalizado</option>
                                            <option value="cancelado">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                    <button type="button" onClick={() => setEditingBolao(null)} className="btn btn-ghost flex-1">Cancelar</button>
                                    <button type="submit" className="btn btn-primary flex-1" style={{ background: cor, color: '#fff' }}>Salvar Alterações</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modais de venda */}
                {cotaToSell && selectedBolao && (
                    <ModalVendaBolao
                        cota={cotaToSell}
                        bolao={selectedBolao}
                        onClose={() => setCotaToSell(null)}
                        onSuccess={handleSellSuccess}
                    />
                )}

                {bolaoForBulkSale && (
                    <ModalVendaLoteBolao
                        bolao={bolaoForBulkSale}
                        onClose={() => setBolaoForBulkSale(null)}
                        onSuccess={handleBulkSellSuccess}
                    />
                )}
            </div>
        </div>
    );
}
