'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Search,
    ChevronRight,
    Calendar,
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
import { ArrowLeft } from 'lucide-react';
import { ModalVendaBolao } from './ModalVendaBolao';
import { ModalVendaLoteBolao } from './ModalVendaLoteBolao';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';

interface ModalListaBoloesProps {
    jogo: string;
    cor: string;
    onClose: () => void;
}

export function ModalListaBoloes({ jogo, cor, onClose }: ModalListaBoloesProps) {
    const [filter, setFilter] = useState('todos'); // todos, disponiveis, finalizados
    const [boloes, setBoloes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [viewMode, setViewMode] = useState<'list' | 'cotas'>('list');
    const [selectedBolao, setSelectedBolao] = useState<any | null>(null);
    const [cotas, setCotas] = useState<any[]>([]);
    const [isLoadingCotas, setIsLoadingCotas] = useState(false);
    const [cotasError, setCotasError] = useState<string | null>(null);

    const { venderCota, loading: selling } = useVendasBolao();
    const { podeGerenciarCaixaBolao: canManageBoloes } = usePerfil();

    const { toast } = useToast();
    const confirm = useConfirm();

    const [sellingId, setSellingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [editingBolao, setEditingBolao] = useState<any | null>(null);
    const [cotaToSell, setCotaToSell] = useState<any | null>(null);
    const [bolaoForBulkSale, setBolaoForBulkSale] = useState<any | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getBoloes();
                // Filtramos pelo nome do jogo que vem via prop
                setBoloes(data.filter(b => b.jogo === jogo));
            } catch (error) {
                console.error('Falha ao carregar bolões para o modal');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [jogo]);

    const handleDeleteBolao = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation(); // Evita abrir as cotas ao clicar no lixo

        const confirmed = await confirm({
            title: 'Excluir Concurso',
            description: 'Deseja realmente excluir este concurso e todas as suas cotas? Esta ação não pode ser desfeita.',
            variant: 'danger',
            confirmLabel: 'Sim, Excluir'
        });

        if (!confirmed) return;

        setIsDeleting(id);
        try {
            await deleteBolao(id);
            setBoloes(prev => prev.filter(b => b.id !== id));
            toast({ message: 'Bolão excluído com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: 'Falha ao excluir bolão: ' + error.message, type: 'error' });
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

        const original = boloes.find(b => b.id === editingBolao.id);
        // Comparação básica de campos editáveis
        const hasChanges =
            original.concurso !== editingBolao.concurso ||
            original.dataSorteio !== editingBolao.dataSorteio ||
            original.precoVendaCota !== editingBolao.precoVendaCota ||
            original.qtdCotas !== editingBolao.qtdCotas ||
            original.status !== editingBolao.status;

        if (!hasChanges) {
            setEditingBolao(null);
            return;
        }

        try {
            await updateBolao(editingBolao.id, editingBolao);
            setBoloes(prev => prev.map(b => b.id === editingBolao.id ? editingBolao : b));
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
            console.log('[DEBUG] Buscando cotas para bolao_id:', bolao.id, 'tipo:', typeof bolao.id);
            const result = await getCotasBolao(bolao.id);
            console.log('[DEBUG] Resultado:', result);

            if (result.error) {
                setCotasError(`Erro Supabase: ${result.error}`);
                setCotas([]);
            } else {
                setCotas(result.data);
                if (result.data.length === 0) {
                    setCotasError(`Nenhuma cota encontrada para bolão ID ${bolao.id}. As cotas podem não ter sido criadas no banco.`);
                }
            }
        } catch (error: any) {
            console.error('[DEBUG] Erro ao carregar cotas:', error);
            setCotasError(`Erro catch: ${error?.message || 'Falha desconhecida'}`);
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

            // Atualiza o estado local das cotas
            setCotas(prev => prev.map(c => c.id === cotaId ? { ...c, status: 'vendida' } : c));

            // Atualiza contagem local de bolões
            setBoloes(prev => prev.map(b => b.id === selectedBolao.id ? { ...b, cotasVendidas: b.cotasVendidas + 1 } : b));
            toast({ message: 'Cota vendida com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: error.message, type: 'error' });
        } finally {
            setSellingId(null);
        }
    };

    const handleBulkSellSuccess = async () => {
        // Recarrega os dados do bolão após venda em lote
        if (!bolaoForBulkSale) return;

        const bolaoId = bolaoForBulkSale.id;
        setBolaoForBulkSale(null);

        try {
            const updatedData = await getBoloes();
            setBoloes(updatedData.filter(b => b.jogo === jogo));

            // Se estivermos na visão de cotas do bolão que acabamos de vender em lote, atualize as cotas também
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
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
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
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <LogoLoteria cor="#FFF" tamanho={16} temPlus={config?.temPlus} />
                            Loterias CAIXA
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{jogo}</h2>
                        <p style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '0.25rem' }}>Confira todas as cotas e concursos ativos para esta modalidade</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(0,0,0,0.2)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '50%',
                            width: 36,
                            height: 36,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 px-6 border-b border-border bg-bg-card flex items-center gap-4 overflow-x-auto scrollbar-hide">
                    {['todos', 'disponiveis', 'finalizados'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${filter === f ? 'bg-surface-subtle text-text-primary' : 'text-text-muted hover:text-text-primary'
                                }`}
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

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-dark)', position: 'relative' }}>

                    {/* VIEW: LISTA DE BOLÕES AGRUPADOS */}
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
                                        {/* Cabeçalho do Concurso */}
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
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em'
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
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease-in-out'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'transparent';
                                                }}
                                                onClick={() => handleOpenCotas(bolao)}
                                            >
                                                {/* Meta Info */}
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

                                                {/* Stats & Actions */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                                    <div style={{ textAlign: 'right', minWidth: '90px' }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 900, marginBottom: '0.25rem' }}>
                                                            {bolao.cotasVendidas} / {bolao.qtdCotas}
                                                        </div>
                                                        <div style={{ height: '3px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                height: '100%',
                                                                width: `${(bolao.cotasVendidas / bolao.qtdCotas) * 100}%`,
                                                                background: cor,
                                                                borderRadius: '2px'
                                                            }} />
                                                        </div>
                                                    </div>

                                                    {/* Botões de Gestão (Apenas para autorizados) */}
                                                    {canManageBoloes && (
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBolaoForBulkSale(bolao);
                                                                }}
                                                                title="Venda em Lote (Rápida)"
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
                                <p>Nenhum bolão encontrado para este concurso.</p>
                            </div>
                        )
                    )}

                    {/* VIEW: MICRO-GESTÃO DE COTAS */}
                    {viewMode === 'cotas' && selectedBolao && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} className="animate-in slide-in-from-right duration-300">
                            {/* Header Interno de Navegação */}
                            <div style={{
                                padding: '1.25rem 2rem',
                                borderBottom: '1px solid var(--border)',
                                background: 'var(--bg-card)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <button
                                    onClick={() => setViewMode('list')}
                                    style={{
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
                                    }}
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900 }}>Gerenciamento de Cotas Individual</h4>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Bolão ID #{selectedBolao.id} • Concurso {selectedBolao.concurso} • {selectedBolao.qtdCotas} cotas totais
                                    </p>
                                </div>
                            </div>

                            {/* Lista de Cotas Reformulada */}
                            <div style={{ padding: '0 2rem 2rem 2rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {isLoadingCotas ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                        <Loader2 size={32} className="animate-spin mb-4" />
                                        <p>Carregando as cotas reais do banco de dados...</p>
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
                                        {/* Header da Tabela */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '80px 1fr 120px 100px 120px',
                                            padding: '0.75rem 1.5rem',
                                            background: 'var(--surface-subtle)',
                                            borderBottom: '1px solid var(--border)',
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            <span>Cota</span>
                                            <span>Identificador</span>
                                            <span>Valor</span>
                                            <span>Status</span>
                                            <span style={{ textAlign: 'right' }}>Ação</span>
                                        </div>

                                        <div style={{ overflowY: 'auto', flex: 1 }}>
                                            {cotas.length === 0 && !isLoadingCotas && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                    <AlertCircle size={40} style={{ marginBottom: '1rem', opacity: 0.3, color: '#f97316' }} />
                                                    <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Nenhuma cota encontrada</p>
                                                    {cotasError && <p style={{ fontSize: '0.75rem', color: '#f97316', maxWidth: 400 }}>{cotasError}</p>}
                                                    <p style={{ fontSize: '0.7rem', marginTop: '0.5rem', opacity: 0.5 }}>Bolão ID: {selectedBolao?.id} (tipo: {typeof selectedBolao?.id})</p>
                                                </div>
                                            )}
                                            {cotas.map((cota, index) => (
                                                <div
                                                    key={cota.id}
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '80px 1fr 120px 100px 120px',
                                                        padding: '1rem 1.5rem',
                                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                        alignItems: 'center',
                                                        background: cota.status === 'vendida' ? 'rgba(255,255,255,0.01)' :
                                                            cota.status === 'encalhe_casa' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                                                        transition: 'background 0.2s',
                                                        opacity: (cota.status === 'vendida' || cota.status === 'encalhe_casa') ? 0.7 : 1
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{(index + 1).toString().padStart(2, '0')}</span>
                                                    <span style={{ fontWeight: 900, color: cota.status === 'vendida' ? 'var(--text-muted)' : cor, fontSize: '1rem' }}>{cota.uid}</span>
                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>R$ {selectedBolao.precoVendaCota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

                                                    <div style={{
                                                        fontSize: '0.65rem',
                                                        background: cota.status === 'vendida' ? 'rgba(34, 197, 94, 0.1)' :
                                                            cota.status === 'encalhe_casa' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,153,0,0.1)',
                                                        color: cota.status === 'vendida' ? '#4ade80' :
                                                            cota.status === 'encalhe_casa' ? '#ef4444' : '#ff9900',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontWeight: 800,
                                                        width: 'fit-content',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {cota.status === 'vendida' ? 'VENDIDA' :
                                                            cota.status === 'encalhe_casa' ? 'ENCALHE (CASA)' : 'DISPONÍVEL'}
                                                    </div>

                                                    <div style={{ textAlign: 'right' }}>
                                                        {cota.status === 'vendida' ? (
                                                            <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                                <Check size={14} /> PAGO
                                                            </div>
                                                        ) : cota.status === 'encalhe_casa' ? (
                                                            <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                                <Shield size={14} /> DA CASA
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
                                                                    opacity: selling ? 0.5 : 1,
                                                                    transition: 'transform 0.1s'
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
                    <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: cor,
                        background: 'transparent',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}>
                        Visualizar Histórico Completo <ArrowUpRight size={16} />
                    </button>
                </div>

                {/* MODAL DE EDIÇÃO SOBREPOSTO */}
                {editingBolao && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)',
                            width: '400px',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            boxShadow: 'none'
                        }}>
                            <div style={{ background: cor, padding: '1rem 1.5rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Editar Concurso #{editingBolao.id}</h3>
                                <button onClick={() => setEditingBolao(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Nº Concurso</label>
                                    <input
                                        type="text"
                                        value={editingBolao.concurso}
                                        onChange={e => setEditingBolao({ ...editingBolao, concurso: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Preço Venda Cota (R$)</label>
                                    <MoneyInput
                                        value={editingBolao.precoVendaCota}
                                        onValueChange={v => setEditingBolao({ ...editingBolao, precoVendaCota: v })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total de Cotas</label>
                                    <input
                                        type="number"
                                        value={editingBolao.qtdCotas}
                                        onChange={e => setEditingBolao({ ...editingBolao, qtdCotas: Number(e.target.value) })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</label>
                                    <select
                                        value={editingBolao.status}
                                        onChange={e => setEditingBolao({ ...editingBolao, status: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="disponivel">Disponível</option>
                                        <option value="finalizado">Finalizado</option>
                                        <option value="cancelado">Cancelado</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button
                                        onClick={() => setEditingBolao(null)}
                                        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: cor, color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                                    >
                                        Salvar Alterações
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL DE VENDA / PAGAMENTO */}
                {cotaToSell && selectedBolao && (
                    <ModalVendaBolao
                        cota={cotaToSell}
                        bolao={selectedBolao}
                        onClose={() => setCotaToSell(null)}
                        onSuccess={handleSellSuccess}
                    />
                )}

                {/* MODAL DE VENDA EM LOTE */}
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


