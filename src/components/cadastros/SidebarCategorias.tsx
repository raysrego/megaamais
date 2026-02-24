'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Folder, Package, Ticket, Box, LayoutGrid } from 'lucide-react';
import { CategoriaProduto } from '@/types/produto';
import { createCategoria } from '@/actions/produtos';
import { useToast } from '@/contexts/ToastContext';

interface SidebarCategoriasProps {
    categorias: CategoriaProduto[];
    selecionadaId: number | null;
    onSelect: (id: number | null) => void;
    onRefresh: () => void;
    readOnly?: boolean;
}

// Mapa de ícones
const ICON_MAP: Record<string, any> = {
    'box': Box,
    'clover': LayoutGrid,
    'ticket': Ticket,
    'users': Folder, // Bolões
    'award': Folder,
    'zap': Box
};

export function SidebarCategorias({ categorias, selecionadaId, onSelect, onRefresh, readOnly }: SidebarCategoriasProps) {
    const { toast } = useToast();
    const [isAdding, setIsAdding] = useState(false);
    const [novoNome, setNovoNome] = useState('');

    const handleAdd = async () => {
        if (!novoNome.trim()) return;

        try {
            await createCategoria({ nome: novoNome, icone: 'box' } as any);
            toast({ message: 'Categoria criada!', type: 'success' });
            setNovoNome('');
            setIsAdding(false);
            onRefresh();
        } catch (error) {
            toast({ message: 'Erro ao criar categoria', type: 'error' });
        }
    };

    return (
        <div className="w-64 shrink-0 flex flex-col gap-4 pr-6 border-r border-border min-h-[400px]">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Categorias</h3>
                {!readOnly && (
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="btn btn-ghost btn-sm btn-square text-text-muted hover:text-primary"
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>

            {isAdding && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 mb-2"
                >
                    <input
                        className="input input-sm flex-1"
                        placeholder="Nova categoria..."
                        value={novoNome}
                        onChange={e => setNovoNome(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                </motion.div>
            )}

            <div className="flex flex-col gap-1">
                <button
                    onClick={() => onSelect(null)}
                    className={`nav-item ${selecionadaId === null ? 'active' : ''}`}
                >
                    <LayoutGrid size={18} />
                    <span>Todos os Produtos</span>
                </button>

                {categorias.map(cat => {
                    const Icon = ICON_MAP[cat.icone] || Box;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => onSelect(cat.id!)}
                            className={`nav-item ${selecionadaId === cat.id ? 'active' : ''}`}
                            style={selecionadaId === cat.id ? { borderColor: cat.cor, background: `${cat.cor}1a` } : {}}
                        >
                            <Icon size={18} style={{ color: cat.cor }} />
                            <span>{cat.nome}</span>
                        </button>
                    );
                })}
            </div>

            <style jsx>{`
                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    text-align: left;
                    border: 1px solid transparent;
                }
                .nav-item:hover {
                    background: var(--surface-hover);
                    color: var(--text-primary);
                }
                .nav-item.active {
                    background: var(--surface-selected);
                    color: var(--primary);
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
}
