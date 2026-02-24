'use client';

import { useCaixa } from '@/hooks/useCaixa';
import { Loader2, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { usePerfil } from '@/hooks/usePerfil';

export function SessionStatusBadge({ collapsed }: { collapsed: boolean }) {
    const { sessaoAtiva, loading } = useCaixa();
    const { perfil } = usePerfil();

    // Apenas operadores e gerentes que operam caixa precisam ver isso
    const shouldShow = perfil?.role !== 'admin'; // Admins geralmente não operam caixa, mas se quiserem, podem acessar o menu

    if (loading) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle animate-pulse ${collapsed ? 'justify-center' : ''}`}>
                <div className="w-2 h-2 rounded-full bg-border" />
                {!collapsed && <div className="h-3 w-16 bg-border rounded" />}
            </div>
        );
    }

    const isOpen = !!sessaoAtiva;

    return (
        <Link
            href="/caixa"
            className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                ${isOpen
                    ? 'bg-success/10 hover:bg-success/20 text-success border border-success/20'
                    : 'bg-surface-subtle hover:bg-surface-hover text-muted border border-border'
                }
                ${collapsed ? 'justify-center p-2' : ''}
            `}
            title={isOpen ? "Caixa Aberto" : "Caixa Fechado"}
        >
            <div className={`relative flex items-center justify-center ${collapsed ? '' : 'w-5'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-success animate-pulse' : 'bg-muted'}`} />
                {isOpen && <div className="absolute w-2.5 h-2.5 rounded-full bg-success opacity-50 animate-ping" />}
            </div>

            {!collapsed && (
                <div className="flex flex-col">
                    <span className="text-[0.65rem] font-black uppercase tracking-wider leading-none mb-0.5 opacity-70">
                        STATUS CAIXA
                    </span>
                    <span className="text-xs font-bold leading-none flex items-center gap-1.5">
                        {isOpen ? (
                            <>ABERTO <Unlock size={10} strokeWidth={3} /></>
                        ) : (
                            <>FECHADO <Lock size={10} strokeWidth={3} /></>
                        )}
                    </span>
                </div>
            )}
        </Link>
    );
}
