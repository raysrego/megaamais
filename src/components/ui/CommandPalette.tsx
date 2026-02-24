'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Home,
    Ticket,
    Calendar,
    Monitor,
    Scale,
    Wallet,
    FileText,
    UserCog,
    DollarSign,
    ShieldCheck,
    Tag,
    Building2,
    Package,
    Settings,
    LogOut,
    PlusCircle,
    ArrowDownCircle,
    Command as CommandIcon,
    Moon,
    Sun
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

interface Command {
    id: string;
    label: string;
    icon: React.ReactNode;
    category: string;
    action: () => void;
    shortcut?: string;
}

export function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const { toggleTheme, isDarkMode } = useTheme();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const commands: Command[] = [
        // Navegação
        { id: 'nav-home', label: 'Início / Dashboard', icon: <Home size={18} />, category: 'Navegação', action: () => router.push('/inicio') },
        { id: 'nav-caixa', label: 'Gestão de Caixa', icon: <Wallet size={18} />, category: 'Navegação', action: () => router.push('/caixa') },
        { id: 'nav-boloes', label: 'Bolões & Loterias', icon: <Ticket size={18} />, category: 'Navegação', action: () => router.push('/boloes') },
        { id: 'nav-financeiro', label: 'Financeiro', icon: <DollarSign size={18} />, category: 'Navegação', action: () => router.push('/financeiro') },
        { id: 'nav-cofre', label: 'Gestão de Cofre', icon: <ShieldCheck size={18} />, category: 'Navegação', action: () => router.push('/cofre') },
        { id: 'nav-conciliacao', label: 'Conciliação Bancária', icon: <Scale size={18} />, category: 'Navegação', action: () => router.push('/conciliacao') },

        // Cadastros
        { id: 'cad-produtos', label: 'Gerenciar Produtos', icon: <Package size={18} />, category: 'Cadastros', action: () => router.push('/cadastros/produtos') },
        { id: 'cad-terminais', label: 'Gerenciar Terminais', icon: <Monitor size={18} />, category: 'Cadastros', action: () => router.push('/cadastros/terminais') },
        { id: 'cad-categorias', label: 'Gerenciar Categorias', icon: <Tag size={18} />, category: 'Cadastros', action: () => router.push('/cadastros/categorias') },
        { id: 'cad-contas', label: 'Contas Bancárias', icon: <Building2 size={18} />, category: 'Cadastros', action: () => router.push('/cadastros/contas') },

        // Ações Rápidas
        { id: 'act-novo-bolao', label: 'Criar Novo Bolão', icon: <PlusCircle size={18} />, category: 'Ações Rápidas', action: () => { /* Emitting event or using context would be better if we want to trigger specific modal */ router.push('/boloes'); } },
        { id: 'act-sangria', label: 'Realizar Sangria', icon: <ArrowDownCircle size={18} />, category: 'Ações Rápidas', action: () => router.push('/caixa') },

        // Sistema
        { id: 'sys-theme', label: `Trocar para Modo ${isDarkMode ? 'Claro' : 'Escuro'}`, icon: isDarkMode ? <Sun size={18} /> : <Moon size={18} />, category: 'Sistema', action: toggleTheme },
        { id: 'sys-settings', label: 'Configurações', icon: <Settings size={18} />, category: 'Sistema', action: () => router.push('/configuracoes') },
        { id: 'sys-logout', label: 'Sair do Sistema', icon: <LogOut size={18} />, category: 'Sistema', action: () => { document.querySelector<HTMLButtonElement>('button[title="Sair"]')?.click(); } },
    ];

    const filteredCommands = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
    );

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            setIsOpen(prev => !prev);
        }

        if (e.key === 'Escape') {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    const runCommand = (cmd: Command) => {
        cmd.action();
        setIsOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            if (filteredCommands[selectedIndex]) {
                runCommand(filteredCommands[selectedIndex]);
            }
        }
    };

    // Render logic with Portals
    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="command-palette-root">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/40 z-99999"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-[640px] z-999999 overflow-hidden rounded-2xl border border-white/10 bg-[#12141c]/95 flex flex-col"
                    >
                        {/* Search Input */}
                        <div className="relative flex items-center px-5 py-4 border-b border-white/5 bg-white/2">
                            <Search className="text-white/30 mr-3" size={20} />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Pressione para navegar ou pesquisar..."
                                className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-white/20 font-medium"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                            />
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                                <span className="text-[10px] font-black text-white/40 uppercase">Esc</span>
                            </div>
                        </div>

                        {/* Results List */}
                        <div
                            ref={listRef}
                            className="max-h-[400px] overflow-y-auto custom-scrollbar py-2"
                        >
                            {filteredCommands.length === 0 ? (
                                <div className="px-5 py-10 text-center text-white/20">
                                    <p className="text-sm">Nenhum comando encontrado para "{query}"</p>
                                </div>
                            ) : (
                                Object.entries(
                                    filteredCommands.reduce((acc, cmd) => {
                                        if (!acc[cmd.category]) acc[cmd.category] = [];
                                        acc[cmd.category].push(cmd);
                                        return acc;
                                    }, {} as Record<string, Command[]>)
                                ).map(([category, cmds]) => (
                                    <div key={category} className="mb-2 last:mb-0">
                                        <div className="px-5 py-2 text-[10px] font-black text-white/20 uppercase tracking-widest">{category}</div>
                                        {cmds.map((cmd) => {
                                            const flatIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                                            const isSelected = flatIndex === selectedIndex;

                                            return (
                                                <button
                                                    key={cmd.id}
                                                    onClick={() => runCommand(cmd)}
                                                    onMouseMove={() => setSelectedIndex(flatIndex)}
                                                    className={`w-full flex items-center justify-between px-5 py-3 transition-all duration-200 outline-none
                                                        ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/60 hover:bg-white/2'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5'}`}>
                                                            {cmd.icon}
                                                        </div>
                                                        <span className={`text-[0.9rem] font-medium ${isSelected ? 'text-white' : ''}`}>
                                                            {cmd.label}
                                                        </span>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="flex items-center gap-1 text-[10px] font-black opacity-40">
                                                            <span>ENTER</span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-white/5 bg-white/1 flex items-center justify-between text-[11px] text-white/20 font-bold uppercase tracking-wider">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1"><span className="p-1 px-1.5 rounded bg-white/5 border border-white/5">↑↓</span> Navegar</span>
                                <span className="flex items-center gap-1"><span className="p-1 px-1.5 rounded bg-white/5 border border-white/5">↵</span> Selecionar</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CommandIcon size={12} />
                                <span>Centrale de Comandos</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
