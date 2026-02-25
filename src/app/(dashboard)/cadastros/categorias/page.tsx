'use client';

import { useState } from 'react';
import {
    FolderCog,
    DollarSign,
    Zap,
    ShoppingBag,
    ChevronRight,
    Search,
    Plus,
    Filter
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CategoriaFinanceira } from './CategoriaFinanceira';
import { ParametrosFinanceiros } from './ParametrosFinanceiros';
import { CategoriasOperacionais } from './CategoriasOperacionais';
import { Settings } from 'lucide-react';
import { LoadingState } from '@/components/ui/LoadingState';

type CategoriaModulo = 'financeiro' | 'operacional' | 'produtos' | 'parametros';

export default function CategoriasPage() {
    const [loading] = useState(false);
    const [moduloAtivo, setModuloAtivo] = useState<CategoriaModulo>('financeiro');
    const [busca, setBusca] = useState('');

    const modulos = [
        { id: 'financeiro', label: 'Financeiro', icon: DollarSign, desc: 'Plano de contas, receitas e despesas', color: '#3b82f6' },
        { id: 'operacional', label: 'Operacional', icon: Zap, desc: 'Tipos de caixa e movimentações', color: '#f59e0b' },
        { id: 'produtos', label: 'Produtos', icon: ShoppingBag, desc: 'Categorias de estoque e vendas', color: '#8b5cf6' },
        { id: 'parametros', label: 'Configuração', icon: Settings, desc: 'Taxas, comissões e regras de negócio', color: '#ec4899' },
    ];

    if (loading) return <LoadingState type="list" />;

    return (
        <div className="dashboard-content">
            <PageHeader
                title="Central de Categorias"
            />

            <div style={{
                display: 'grid',
                gridTemplateColumns: '300px 1fr',
                gap: '1.5rem',
                alignItems: 'start'
            }}>
                {/* Sidebar de Navegação Interna */}
                <aside style={{
                    background: 'var(--bg-card)',
                    borderRadius: '20px',
                    padding: '1.25rem',
                    border: '1px solid var(--border)',
                    height: 'fit-content',
                    position: 'sticky',
                    top: '1rem'
                }}>
                    <div className="mb-6 px-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                className="input w-full pl-9 py-2 text-xs"
                                placeholder="Buscar módulo..."
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                            />
                        </div>
                    </div>

                    <nav className="flex flex-col gap-1.5">
                        {modulos.filter(m => m.label.toLowerCase().includes(busca.toLowerCase())).map((modulo) => {
                            const isAtivo = moduloAtivo === modulo.id;
                            const Icon = modulo.icon;
                            // Cor dinâmica baseada no módulo
                            const activeColorClass = isAtivo
                                ? modulo.id === 'financeiro' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                                    : modulo.id === 'operacional' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                                        : modulo.id === 'produtos' ? 'text-purple-500 bg-purple-500/10 border-purple-500/20'
                                            : 'text-pink-500 bg-pink-500/10 border-pink-500/20'
                                : 'text-muted-foreground hover:bg-muted/50 border-transparent';

                            return (
                                <button
                                    key={modulo.id}
                                    onClick={() => setModuloAtivo(modulo.id as CategoriaModulo)}
                                    className={`
                                        flex items-center gap-3 p-3.5 rounded-xl w-full text-left transition-all border
                                        ${activeColorClass}
                                    `}
                                >
                                    <div className={`
                                        w-8 h-8 rounded-lg flex items-center justify-center transition-all
                                        ${isAtivo ? 'bg-current text-white shadow-sm' : 'bg-muted/50 text-muted-foreground'}
                                    `}>
                                        <Icon size={18} className={isAtivo ? 'text-white' : 'text-inherit'} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className={`text-sm font-bold ${isAtivo ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {modulo.label}
                                        </div>
                                        {isAtivo && (
                                            <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                                                {modulo.desc}
                                            </div>
                                        )}
                                    </div>
                                    <ChevronRight
                                        size={14}
                                        className={`transition-transform ${isAtivo ? 'translate-x-1 opacity-100' : 'opacity-0'}`}
                                    />
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Ãrea de ConteÃºdo / CRUD */}
                <main style={{
                    background: 'var(--bg-card)',
                    borderRadius: '24px',
                    padding: '2rem',
                    border: '1px solid var(--border)',
                    minHeight: '600px'
                }}>
                    {moduloAtivo === 'financeiro' && <CategoriaFinanceira />}

                    {moduloAtivo === 'parametros' && <ParametrosFinanceiros />}

                    {moduloAtivo === 'operacional' && <CategoriasOperacionais />}

                    {moduloAtivo === 'produtos' && (
                        <div className="flex flex-col items-center justify-center h-[500px] text-center opacity-40 grayscale">
                            <ShoppingBag size={48} className="mb-4 text-purple-500" />
                            <h3 className="text-xl font-bold">MÃ³dulo de Produtos</h3>
                            <p className="text-sm max-w-[300px] mx-auto">Em breve: Ãrvore de Categorias, Marcas e Grupos de Mercadoria.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}


