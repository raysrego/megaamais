'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Filter,
    ArrowUpCircle,
    ArrowDownCircle,
    X,
    Save,
    AlertTriangle,
    Loader2,
    Archive,
    Zap,
    Lock,
    Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useItensFinanceiros, ItemFinanceiro } from '@/hooks/useItensFinanceiros';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil';
import { EmptyState } from '@/components/ui/EmptyState';

export function CategoriaFinanceira() {
    const { lojaAtual, lojasDisponiveis } = useLoja();
    const { isAdmin } = usePerfil();

    // Loja de contexto para filtro/criação
    const [filialFiltro, setFilialFiltro] = useState<string>(lojaAtual?.id || '');

    const {
        itens: categorias,
        loading,
        isPending,
        fetchItens,
        salvarItem: salvarCategoria,
        atualizarItem: atualizarCategoria,
        excluirItem: excluirCategoria,
        addOptimisticItem,
        startTransition
    } = useItensFinanceiros();

    // Sincronizar filtro quando loja de contexto mudar
    useEffect(() => {
        if (lojaAtual) {
            setFilialFiltro(lojaAtual.id);
            fetchItens(lojaAtual.id);
        }
    }, [lojaAtual, fetchItens]);

    const [busca, setBusca] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editando, setEditando] = useState<ItemFinanceiro | null>(null);
    const [processing, setProcessing] = useState(false);
    const [processandoRecorrencias, setProcessandoRecorrencias] = useState(false);

    // Permitir alternar entre visualização Global ou Específica
    const canSeeGlobal = isAdmin; // Apenas admin vê/edita globais por enquanto

    const { toast } = useToast();
    const confirm = useConfirm();

    // Form State
    const [formData, setFormData] = useState<Omit<ItemFinanceiro, 'id'>>({
        item: '',
        tipo: 'despesa',
        fixo: false,
        tipo_recorrencia: 'VARIAVEL',
        ordem: 0,
        valor_padrao: 0,
        dia_vencimento: 5,
        loja_id: lojaAtual?.id || ''
    });

    const handleOpenModal = (cat?: ItemFinanceiro) => {
        if (cat) {
            setEditando(cat);
            setFormData({
                item: cat.item,
                tipo: cat.tipo,
                fixo: cat.fixo,
                tipo_recorrencia: cat.tipo_recorrencia || (cat.fixo ? 'FIXO_MENSAL' : 'VARIAVEL'),
                ordem: cat.ordem,
                valor_padrao: cat.valor_padrao || 0,
                dia_vencimento: cat.dia_vencimento || 5,
                loja_id: cat.loja_id
            });
        } else {
            setEditando(null);
            setFormData({
                item: '',
                tipo: 'despesa',
                fixo: false,
                tipo_recorrencia: 'VARIAVEL',
                ordem: categorias.length > 0 ? Math.max(...categorias.map(c => c.ordem)) + 1 : 1,
                valor_padrao: 0,
                dia_vencimento: 5,
                loja_id: filialFiltro || lojaAtual?.id || ''
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.item) {
            toast({ message: 'O item é obrigatório', type: 'warning' });
            return;
        }

        if (formData.item === '') {
            toast({ message: 'O item é obrigatório', type: 'warning' });
            return;
        }

        try {
            setProcessing(true);

            // Optimistic Update (visual apenas)
            if (editando) {
                addOptimisticItem({ type: 'update', payload: { id: editando.id, updates: formData } });
            } else {
                addOptimisticItem({ type: 'add', payload: formData });
            }

            // ✅ Salvar no banco ANTES de fechar modal
            if (editando) {
                await atualizarCategoria(editando.id, formData);
            } else {
                await salvarCategoria(formData);
            }

            toast({ message: `Item financeiro ${editando ? 'atualizado' : 'salvo'} com sucesso!`, type: 'success' });

            // ✅ FIX v2.5.14: Aguardar refresh antes de fechar
            await fetchItens(filialFiltro);

            // Fechar modal apenas após sucesso
            setShowModal(false);
        } catch (error: any) {
            toast({ message: 'Erro ao salvar: ' + error.message, type: 'error' });
            // Se der erro, recarrega para desfazer optimistic updates incorretos
            await fetchItens(filialFiltro);
        } finally {
            // ✅ FIX CRÍTICO: Sempre desbloquear botão
            setProcessing(false);
        }
    };

    const handleDelete = async (cat: ItemFinanceiro) => {
        const itensProtegidos = ['Ágio Bolão (35%)', 'Jogos (8,61%)', 'Encalhe de Jogos'];
        if (itensProtegidos.includes(cat.item)) {
            toast({ message: 'Este item é vital para o sistema e não pode ser excluído.', type: 'error' });
            return;
        }

        const confirmed = await confirm({
            title: 'Excluir Item',
            description: `Deseja realmente excluir o item "${cat.item}"?`,
            variant: 'danger',
            confirmLabel: 'Excluir'
        });

        if (!confirmed) return;

        startTransition(async () => {
            addOptimisticItem({ type: 'delete', payload: cat.id });
            try {
                await excluirCategoria(cat.id);
                toast({ message: 'Item excluído com sucesso!', type: 'success' });
            } catch (error: any) {
                toast({ message: 'Erro ao excluir: ' + error.message, type: 'error' });
            }
        });
    };

    const filtradas = categorias.filter(c =>
        c.item.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        Itens Financeiros
                        <span className="badge success text-[10px] py-0.5">Catálogo</span>
                    </h2>
                </div>
                <div className="flex gap-3">
                    {isAdmin && (
                        <div className="flex items-center gap-2 mr-4">
                            <Filter size={14} className="text-muted" />
                            <select
                                className="input input-sm py-1 font-bold border-blue-500/20 bg-blue-500/5"
                                value={filialFiltro}
                                onChange={(e) => {
                                    setFilialFiltro(e.target.value);
                                    fetchItens(e.target.value);
                                }}
                            >
                                {lojasDisponiveis.map(loja => (
                                    <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn btn-primary"
                        onClick={() => handleOpenModal()} // Keep existing handleOpenModal logic
                    >
                        <Plus size={18} /> Novo Item
                    </motion.button>
                </div>
            </div>

            {/* Filtros e Busca */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        className="input w-full pl-10"
                        placeholder="Buscar item por descrição..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                    />
                </div>
                <button className="btn btn-ghost px-3">
                    <Filter size={16} />
                </button>
            </div>

            {/* Listagem */}
            <div className="table-container" style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="w-12 text-center">#</th>
                            <th>Item</th>
                            {isAdmin && <th>Filial</th>}
                            <th>Fluxo</th>
                            <th className="text-center">Modalidade</th>
                            <th className="w-24 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={isAdmin ? 6 : 5} className="py-20 text-center">
                                    <Loader2 className="animate-spin mx-auto text-blue-500 opacity-50" size={32} />
                                    <p className="text-xs text-muted mt-2">Carregando catálogo...</p>
                                </td>
                            </tr>
                        ) : filtradas.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 6 : 5} className="py-12">
                                    <EmptyState
                                        icon={Archive}
                                        title={busca ? `Nenhum item encontrado para "${busca}"` : "Nenhum item financeiro"}
                                        description={busca ? "Tente ajustar sua busca ou adicione um novo item." : "Não encontramos categorias cadastradas. Comece adicionando seu primeiro item financeiro."}
                                        actionLabel="Cadastrar Novo Item"
                                        onAction={() => handleOpenModal()} // Use existing handleOpenModal
                                    />
                                </td>
                            </tr>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {filtradas.map((cat, index) => (
                                    <motion.tr
                                        key={cat.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="hover:bg-white/2 transition-colors"
                                    >
                                        <td className="text-center text-xs font-bold text-muted">{cat.ordem}</td>
                                        <td>
                                            <div className="font-bold text-white">{cat.item}</div>
                                            {cat.fixo && cat.valor_padrao != null && (
                                                <div className="text-[10px] text-muted-foreground">Valor Estimado: R$ {cat.valor_padrao.toLocaleString('pt-BR')}</div>
                                            )}
                                        </td>
                                        {isAdmin && (
                                            <td>
                                                {cat.loja_id ? (
                                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                                        {lojasDisponiveis.find(l => l.id === cat.loja_id)?.nome_fantasia || 'Desconhecida'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 flex items-center gap-1 w-fit">
                                                        <Shield size={10} /> GLOBAL
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                        <td>
                                            <div className={`flex items-center gap-2 text-xs font-bold uppercase ${cat.tipo === 'receita' ? 'text-success' : 'text-danger'}`}>
                                                {cat.tipo === 'receita' ? (
                                                    <><ArrowUpCircle size={14} /> Entrada</>
                                                ) : (
                                                    <><ArrowDownCircle size={14} /> Saída</>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            {cat.tipo_recorrencia === 'FIXO_MENSAL' && (
                                                <span className="text-[10px] font-black px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                    FIXO MENSAL
                                                </span>
                                            )}
                                            {cat.tipo_recorrencia === 'FIXO_VARIAVEL' && (
                                                <span className="text-[10px] font-black px-2 py-1 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                                    FIXO VARIÁVEL
                                                </span>
                                            )}
                                            {(!cat.tipo_recorrencia || cat.tipo_recorrencia === 'VARIAVEL') && (
                                                <span className="text-[10px] font-black px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                    VARIÁVEL
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    className="btn btn-ghost btn-xs p-1.5"
                                                    onClick={() => handleOpenModal(cat)}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                {['Ágio Bolão (35%)', 'Jogos (8,61%)', 'Encalhe de Jogos'].includes(cat.item) ? (
                                                    <div className="p-1.5 text-muted/30" title="Item Vital (Bloqueado)">
                                                        <Lock size={14} />
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-ghost btn-xs p-1.5 text-danger hover:bg-danger/10"
                                                        onClick={() => handleDelete(cat)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Alerta Informativo */}
            <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex gap-3 items-start">
                <AlertTriangle size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200/60 leading-relaxed">
                    <strong>Dica de Gestão:</strong> O plano de contas é a espinha dorsal do seu DRE. Categorias marcadas como <strong>Fixo Mensal</strong> (ex: Aluguel, Internet) serão automatizadas pelo motor de recorrência na virada do mês, reduzindo o trabalho manual do seu gerente.
                </div>
            </div>

            {/* Modal CRUD */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div className="card w-full max-w-md animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-white">
                                    {editando ? 'Editar Item' : 'Novo Item'}
                                </h3>
                                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Catálogo Financeiro</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-muted hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Seleção de Filial (Admin-only ou Múltiplas lojas) */}
                            {(isAdmin || lojasDisponiveis.length > 1) && (
                                <div className="form-group pb-2 border-b border-white/5">
                                    <label className="label text-blue-400">Filial de Destino</label>
                                    <select
                                        className="input w-full border-blue-500/30 bg-blue-500/5 font-bold"
                                        value={formData.loja_id || ''}
                                        onChange={e => setFormData({ ...formData, loja_id: e.target.value || null })}
                                        disabled={!!editando && !!formData.loja_id} // Evita mover item local -> global na edição para não confundir histórico
                                    >
                                        <option value="">🌐 GLOBAL (Todas as Filiais)</option>
                                        <option disabled>────── Filiais ──────</option>
                                        {lojasDisponiveis.map(loja => (
                                            <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                        ))}
                                    </select>
                                    {!formData.loja_id ? (
                                        <p className="text-[9px] text-purple-400 mt-1 font-bold flex items-center gap-1">
                                            <Shield size={10} />
                                            Visível para todas as lojas do grupo
                                        </p>
                                    ) : (
                                        <p className="text-[9px] text-blue-400/60 mt-1 font-medium">
                                            Visível apenas para {lojasDisponiveis.find(l => l.id === formData.loja_id)?.nome_fantasia}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="label">Item</label>
                                <input
                                    className="input w-full"
                                    placeholder="Ex: Aluguel da Loja"
                                    value={formData.item}
                                    onChange={e => setFormData({ ...formData, item: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="label">Fluxo de Caixa</label>
                                    <select
                                        className="input w-full"
                                        value={formData.tipo}
                                        onChange={e => setFormData({ ...formData, tipo: e.target.value as 'receita' | 'despesa' })}
                                    >
                                        <option value="receita">Entrada (+)</option>
                                        <option value="despesa">Saída (-)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Ordem</label>
                                    <input
                                        type="number"
                                        className="input w-full"
                                        value={formData.ordem}
                                        onChange={e => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="form-group mt-4">
                                <label className="label mb-2">Tipo de Recorrência</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        className={`p-3 rounded-xl border text-left transition-all ${formData.tipo_recorrencia === 'FIXO_MENSAL'
                                            ? 'bg-indigo-500/20 border-indigo-500 text-white'
                                            : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'
                                            }`}
                                        onClick={() => setFormData(prev => ({ ...prev, tipo_recorrencia: 'FIXO_MENSAL', fixo: true }))}
                                    >
                                        <div className="font-bold text-xs mb-1">Fixo Mensal</div>
                                        <div className="text-[10px] opacity-70">Automático todo mês (ex: Aluguel)</div>
                                    </button>

                                    <button
                                        type="button"
                                        className={`p-3 rounded-xl border text-left transition-all ${formData.tipo_recorrencia === 'FIXO_VARIAVEL'
                                            ? 'bg-pink-500/20 border-pink-500 text-white'
                                            : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'
                                            }`}
                                        onClick={() => setFormData(prev => ({ ...prev, tipo_recorrencia: 'FIXO_VARIAVEL', fixo: true }))}
                                    >
                                        <div className="font-bold text-xs mb-1">Fixo Variável</div>
                                        <div className="text-[10px] opacity-70">Todo mês tem, mas valor varia. Lançamento Manual.</div>
                                    </button>

                                    <button
                                        type="button"
                                        className={`p-3 rounded-xl border text-left transition-all ${formData.tipo_recorrencia === 'VARIAVEL'
                                            ? 'bg-orange-500/20 border-orange-500 text-white'
                                            : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'
                                            }`}
                                        onClick={() => setFormData(prev => ({ ...prev, tipo_recorrencia: 'VARIAVEL', fixo: false }))}
                                    >
                                        <div className="font-bold text-xs mb-1">Variável</div>
                                        <div className="text-[10px] opacity-70">Eventual / Não ocorre todo mês</div>
                                    </button>
                                </div>
                            </div>

                            {(formData.tipo_recorrencia === 'FIXO_MENSAL' || formData.tipo_recorrencia === 'FIXO_VARIAVEL') && (
                                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/10 animate-in slide-in-from-top-2 mt-2">
                                    <div className="form-group">
                                        <label className={`label ${formData.tipo_recorrencia === 'FIXO_MENSAL' ? 'text-indigo-300' : 'text-pink-300'}`}>
                                            {formData.tipo_recorrencia === 'FIXO_MENSAL' ? 'Valor Padrão (R$)' : 'Valor Estimado (Opcional)'}
                                        </label>
                                        <input
                                            type="number"
                                            className="input w-full border-white/10 focus:border-indigo-500/50"
                                            value={formData.valor_padrao}
                                            onChange={e => setFormData({ ...formData, valor_padrao: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label text-white">Dia Vencimento</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            className="input w-full border-white/10"
                                            value={formData.dia_vencimento}
                                            onChange={e => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 5 })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/5">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowModal(false)}
                                disabled={isPending}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary px-8"
                                onClick={handleSave}
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                                ) : (
                                    <><Save size={16} /> Salvar Parâmetros</>
                                )}
                            </button>
                        </div>
                    </div>
                </div >
            )
            }
        </div >
    );
}
