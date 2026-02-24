'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Info } from 'lucide-react';

export function NotificationDropdown({ isCollapsed }: { isCollapsed?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fechar ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Ícone do Sino na Sidebar */}
            <div
                className={`nav-item ${isOpen ? 'active' : ''} cursor-pointer relative`}
                onClick={() => setIsOpen(!isOpen)}
                title={isCollapsed ? "Notificações" : ""}
            >
                <div className="relative">
                    <Bell size={20} />
                </div>
                {!isCollapsed && <span className="truncate">Notificações</span>}
            </div>

            {/* Janela Pop-up (Dropdown) - Posicionada FIXA para não ser cortada pelo overflow */}
            {isOpen && (
                <div
                    className="fixed w-80 bg-bg-card border border-border rounded-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-2 duration-200 shadow-2xl"
                    style={{
                        bottom: isCollapsed ? '135px' : '175px',
                        left: isCollapsed ? '74px' : '230px'
                    }}
                >
                    {/* Header do Pop-up */}
                    <div className="p-4 border-b border-border flex items-center justify-between bg-surface-subtle/30">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-text-primary">Notificações</h3>
                            <span className="bg-primary-blue-light text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">New</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Conteúdo Em Breve */}
                    <div className="p-8 text-center flex flex-col items-center gap-4 bg-bg-card">
                        <div className="p-3 rounded-full bg-primary-blue-light/10 text-primary-blue-light">
                            <Info size={32} />
                        </div>
                        <div>
                            <h4 className="font-bold text-text-primary text-sm mb-1">Central de Avisos</h4>
                            <p className="text-xs text-text-muted leading-relaxed">
                                Estamos finalizando um novo sistema inteligente de notificações para você.
                            </p>
                        </div>
                        <div className="badge badge-neutral text-[10px] font-bold uppercase tracking-wider opacity-70">
                            Em Breve
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
