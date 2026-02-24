'use client';

import { useState, useEffect, useOptimistic, useTransition, startTransition } from 'react';
import {
    Plus,
    Calendar,
    Settings,
    Trash2,
    Edit3,
    Store,
    Globe,
    ChevronDown,
    ShoppingBag,
    Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModalProduto } from '@/components/cadastros/ModalProduto';
import { Jogo, DIAS_SEMANA, CategoriaProduto } from '@/types/produto';
import { BadgeLoteria } from '@/components/ui/LogoLoteria';
import { LOTERIAS_OFFICIAL } from '@/data/loterias-config';
import {
    getProdutos,
    getProdutosAdmin,
    createProduto,
    updateProduto,
    deleteProduto,
    toggleProdutoLoja,
    getCategorias
} from '@/actions/produtos';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useLoja } from '@/contexts/LojaContext';
import { SidebarCategorias } from '@/components/cadastros/SidebarCategorias';

export default function ProdutosPage() {
    const { lojasDisponiveis, lojaAtual } = useLoja();
    const [contexto, setContexto] = useState<'global' | string>('global');

    // Categorias
    const [categorias, setCategorias] = useState<CategoriaProduto[]>([]);
    const [catSelecionada, setCatSelecionada] = useState<number | null>(null);

    const [produtos, setProdutos] = useState<Jogo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduto, setEditingProduto] = useState<Jogo | null>(null);
    const [isPending, startTransition] = useTransition();

    const [optimisticProdutos, addOptimisticProduto] = useOptimistic(
        produtos,
        (state, action: { type: 'delete' | 'save' | 'toggle', payload: any }) => {
            if (action.type === 'delete') {
                return state.filter(p => p.id !== action.payload);
            }
            if (action.type === 'save') {
                const item = action.payload;
                if (item.id) {
                    return state.map(p => p.id === item.id ? item : p);
                }
                return [...state, { ...item, id: Math.random() }];
            }
            if (action.type === 'toggle') {
                return state.map(p => p.id === action.payload.id ? { ...p, ativo: action.payload.ativo } : p);
            }
            return state;
        }
    );

    const { toast } = useToast();
    const confirm = useConfirm();

    // 1. Carregar Categorias
    useEffect(() => {
        getCategorias().then(setCategorias);
    }, []);

    // 2. Carregar Produtos quando contexto ou categoria mudar
    useEffect(() => {
        loadProdutos();
    }, [contexto, catSelecionada]);

    const loadProdutos = async () => {
        setIsLoading(true);
        try {
            let data: Jogo[] = [];

            if (contexto === 'global') {
                data = await getProdutosAdmin(catSelecionada || undefined);
            } else {
                // Modo Loja: Trazemos todos para mostrar disponibilidade
                const todos = await getProdutosAdmin(catSelecionada || undefined);

                // Buscar ativos desta loja
                try {
                    const ativosLoja = await getProdutos(contexto, catSelecionada || undefined);
                    const idsAtivos = new Set(ativosLoja.map(p => p.id));

                    data = todos.map(p => ({
                        ...p,
                        ativo: idsAtivos.has(p.id!)
                    }));
                } catch {
                    // Fallback se falhar
                    data = todos;
                }
            }

            setProdutos(data);
        } catch (error) {
            console.error('Failed to load products', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (produto: Jogo) => {
        const isEditing = !!(editingProduto && editingProduto.id);

        startTransition(async () => {
            addOptimisticProduto({
                type: 'save',
                payload: isEditing ? { ...produto, id: editingProduto.id } : produto
            });
            setIsModalOpen(false);
            setEditingProduto(null);

            try {
                // Injetar categoria padrão se não tiver
                const payload = {
                    ...produto,
                    categoriaId: produto.categoriaId || catSelecionada || categorias.find(c => c.nome === 'Loterias')?.id
                };

                if (isEditing) {
                    await updateProduto(editingProduto.id!, payload);
                } else {
                    await createProduto(payload);
                }
                loadProdutos();
                toast({ message: `Produto ${isEditing ? 'atualizado' : 'criado'} com sucesso!`, type: 'success' });
            } catch (error: any) {
                console.error('Failed to save product:', error);
                toast({
                    message: `Erro ao salvar produto: ${error.message || 'Falha na comunicação'}`,
                    type: 'error'
                });
            }
        });
    };

    const handleEdit = (produto: Jogo) => {
        setEditingProduto(produto);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: 'Excluir Produto',
            description: 'Tem certeza que deseja remover este produto GLOBALMENTE? Esta ação afetará todas as lojas.',
            variant: 'danger',
            confirmLabel: 'Excluir Globalmente'
        });

        if (confirmed) {
            startTransition(async () => {
                addOptimisticProduto({ type: 'delete', payload: id });
                try {
                    await deleteProduto(id);
                    loadProdutos();
                    toast({ message: 'Produto excluído globalmente.', type: 'success' });
                } catch (error: any) {
                    console.error('Failed to delete product:', error);
                    toast({ message: `Erro ao excluir produto: ${error.message}`, type: 'error' });
                }
            });
        }
    };

    const handleToggleLoja = async (produto: Jogo) => {
        if (contexto === 'global') return;
        const novoStatus = !produto.ativo;
        const lojaAlvo = contexto;

        startTransition(async () => {
            addOptimisticProduto({ type: 'toggle', payload: { id: produto.id, ativo: novoStatus } });
            try {
                await toggleProdutoLoja(lojaAlvo, produto.id!, novoStatus);
                toast({ message: `Produto ${novoStatus ? 'ativado' : 'desativado'} para esta loja.`, type: 'success' });
            } catch (error: any) {
                toast({ message: `Erro ao alterar disponibilidade: ${error.message}`, type: 'error' });
                loadProdutos();
            }
        });
    }

    const handleNew = () => {
        setEditingProduto({ categoriaId: catSelecionada } as any);
        setIsModalOpen(true);
    }

    const contextLabel = contexto === 'global'
        ? 'Global (Todas as Lojas)'
        : lojasDisponiveis.find(l => l.id === contexto)?.nome_fantasia || 'Loja Desconhecida';

    return (
        <div className="dashboard-content">
            <PageHeader title="Catálogo de Produtos">
                <div className="flex gap-3">
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="btn btn-ghost bg-surface-subtle border border-border hover:bg-surface-hover min-w-[200px] justify-between">
                            <div className="flex items-center gap-2">
                                {contexto === 'global' ? <Globe size={16} /> : <Store size={16} />}
                                <span className="text-xs font-bold truncate max-w-[150px]">{contextLabel}</span>
                            </div>
                            <ChevronDown size={14} className="opacity-50" />
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-20 menu p-2 shadow-xl bg-surface-card rounded-xl border border-border w-60 mt-1">
                            <li>
                                <button onClick={() => setContexto('global')} className={contexto === 'global' ? 'active' : ''}>
                                    <Globe size={16} /> Global (Padrão)
                                </button>
                            </li>
                            <div className="divider my-1 text-[10px] font-bold opacity-50">FILIAIS</div>
                            {lojasDisponiveis.map(loja => (
                                <li key={loja.id}>
                                    <button onClick={() => setContexto(loja.id)} className={contexto === loja.id ? 'active' : ''}>
                                        <Store size={16} /> {loja.nome_fantasia}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {contexto === 'global' && (
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn-primary"
                            onClick={handleNew}
                        >
                            <Plus size={18} /> Novo Produto
                        </motion.button>
                    )}
                </div>
            </PageHeader>

            <div className="flex gap-8 items-start relative">
                {/* COLUNA 1: SIDEBAR */}
                <SidebarCategorias
                    categorias={categorias}
                    selecionadaId={catSelecionada}
                    onSelect={setCatSelecionada}
                    onRefresh={() => getCategorias().then(setCategorias)}
                    readOnly={contexto !== 'global'}
                />

                {/* COLUNA 2: GRID & CONTEÚDO */}
                <div className="flex-1">
                    {isLoading ? (
                        <LoadingState type="list" />
                    ) : optimisticProdutos.length === 0 ? (
                        <EmptyState
                            icon={ShoppingBag}
                            title="Nenhum produto nesta categoria"
                            description="Use o botão 'Novo Produto' para começar."
                            actionLabel="Novo Produto"
                            onAction={handleNew}
                        />
                    ) : (
                        <motion.div
                            layout
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '1.5rem',
                                opacity: isPending ? 0.7 : 1,
                                transition: 'opacity 0.2s'
                            }}
                        >
                            <AnimatePresence mode="popLayout">
                                {optimisticProdutos.map((produto, index) => {
                                    const config = LOTERIAS_OFFICIAL[produto.slug || ''];
                                    return (
                                        <motion.div
                                            key={produto.id || index}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2, delay: index * 0.05 }}
                                            whileHover={{ y: -4 }}
                                            className={`card-produto ${contexto !== 'global' && !produto.ativo ? 'opacity-50 grayscale' : ''}`}
                                        >
                                            <div className="card-header-clean">
                                                {/* Se for loteria, usa Badge. Se outro, usa Icone genérico */}
                                                {config ? (
                                                    <BadgeLoteria
                                                        nome={produto.nome}
                                                        cor={produto.cor}
                                                        corDestaque={produto.cor}
                                                        temPlus={config?.temPlus}
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: produto.cor || '#64748b' }}>
                                                            {produto.icone === 'box' ? <Box size={20} /> : <Store size={20} />}
                                                        </div>
                                                        <span className="font-bold text-sm">{produto.nome}</span>
                                                    </div>
                                                )}

                                                {contexto === 'global' ? (
                                                    <div className="actions">
                                                        <button onClick={() => handleEdit(produto)} title="Editar">
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(produto.id!)} title="Excluir">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="form-control">
                                                        <label className="label cursor-pointer gap-2">
                                                            <input
                                                                type="checkbox"
                                                                className="toggle toggle-success toggle-sm"
                                                                checked={!!produto.ativo}
                                                                onChange={() => handleToggleLoja(produto)}
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="card-body">
                                                {/* Detalhes para Loteria */}
                                                {config && (
                                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0 0.5rem' }}>
                                                        <div className="meta-info">
                                                            <Settings size={14} />
                                                            <span>{produto.minDezenas}-{produto.maxDezenas} Dezenas</span>
                                                        </div>
                                                        <div className="meta-info">
                                                            <Calendar size={14} />
                                                            <span>{produto.horarioFechamento}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Detalhes Genéricos */}
                                                {!config && (
                                                    <div className="text-xs text-text-muted px-2 mb-4">
                                                        Produto físico / Serviço
                                                        {produto.gerenciaEstoque && <span className="badge badge-sm badge-warning ml-2">Estoque</span>}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)', margin: '0 0.5rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {produto.id}</span>
                                                    <span className={`status-badge ${produto.ativo ? 'active' : 'inactive'}`}>
                                                        {contexto === 'global' ?
                                                            (produto.ativo ? 'ATIVO' : 'INATIVO') :
                                                            (produto.ativo ? 'DISPONÍVEL' : 'INDISPONÍVEL')
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <ModalProduto
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    produtoEditar={editingProduto}
                    // Passar categorias pro modal (precisaria atualizar o modal também)
                    categorias={categorias}
                />
            )}

            <style jsx>{`
                .card-produto {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    overflow: hidden;
                    transition: all 0.2s;
                }
                .card-produto:hover {
                    
                    box-shadow: var(--shadow-md);
                }
                .card-header-clean {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    background: var(--surface-subtle);
                    min-height: 72px;
                }
                .card-body {
                    padding: 1.5rem;
                }
                .meta-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    font-weight: 600;
                }
                .actions {
                    display: flex;
                    gap: 0.5rem;
                }
                .actions button {
                    background: var(--bg-dark);
                    border: 1px solid var(--border);
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .actions button:hover {
                    background: var(--surface-subtle);
                    color: var(--primary);
                    border-color: var(--primary);
                }
                .status-badge {
                    font-size: 0.7rem;
                    padding: 0.2rem 0.6rem;
                    border-radius: 12px;
                    font-weight: 700;
                }
                .status-badge.active {
                    background: rgba(34, 197, 94, 0.1);
                    color: var(--success);
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }
                .status-badge.inactive {
                    background: var(--surface-subtle);
                    color: var(--text-muted);
                    border: 1px solid var(--border);
                }
            `}</style>
        </div>
    );
}
