// hooks/usePerfil.tsx (ou onde estiver definido)
'use client';

import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { User } from '@supabase/supabase-js';
import { getPerfilAction } from './actions';

type UserRole = 'admin' | 'gerente' | 'op_admin' | 'operador';

interface Perfil {
    id: string;
    role: UserRole;
    nome: string;
    avatar_url?: string;
    loja_id?: string | null;
}

interface PerfilContextType {
    user: User | null;
    perfil: Perfil | null;
    loading: boolean;
    isAdmin: boolean;
    isGerente: boolean;
    isOpAdmin: boolean;
    isOperador: boolean;
    isGestorBolao: boolean;          // <-- NOVO
    podeGerenciarCaixaBolao: boolean;
    podeValidarFechamentos: boolean;
}

const PerfilContext = createContext<PerfilContextType>({
    user: null,
    perfil: null,
    loading: true,
    isAdmin: false,
    isGerente: false,
    isOpAdmin: false,
    isOperador: false,
    isGestorBolao: false,             // <-- NOVO
    podeGerenciarCaixaBolao: false,
    podeValidarFechamentos: false
});

export function PerfilProvider({ children }: { children: React.ReactNode }) {
    // ... (restante do código do provider, igual ao que você já tem)

    const currentRole = perfil?.role || 'operador';
    const value = useMemo(() => ({
        user,
        perfil,
        loading,
        isAdmin: currentRole === 'admin',
        isGerente: currentRole === 'gerente',
        isOpAdmin: currentRole === 'op_admin',
        isOperador: currentRole === 'operador',
        isGestorBolao: currentRole === 'op_admin',   // <-- NOVO: op_admin = gestor de bolão
        podeGerenciarCaixaBolao: ['admin', 'op_admin', 'gerente'].includes(currentRole),
        podeValidarFechamentos: currentRole === 'gerente'
    }), [user, perfil, loading, currentRole]);

    return (
        <PerfilContext.Provider value={value}>
            {children}
        </PerfilContext.Provider>
    );
}

export const usePerfil = () => useContext(PerfilContext);
