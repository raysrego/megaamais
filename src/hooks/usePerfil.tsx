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
    podeGerenciarCaixaBolao: false,
    podeValidarFechamentos: false
});

export function PerfilProvider({ children }: { children: React.ReactNode }) {
    const supabaseRef = useRef(createBrowserSupabaseClient());
    const supabase = supabaseRef.current;

    const [user, setUser] = useState<User | null>(null);
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [loading, setLoading] = useState(true);

    const lastUserIdRef = useRef<string | null>(null);
    const isLoadingRef = useRef(true);

    const handlePerfilData = useCallback((data: any) => {
        let mappedRole = data.role as UserRole;
        if (data.role === 'master') mappedRole = 'admin';
        if (data.role === 'op_master') mappedRole = 'op_admin';
        setPerfil({ ...data, role: mappedRole });
    }, []);

    const loadPerfil = useCallback(async () => {
        const watchdogId = setTimeout(() => {
            if (isLoadingRef.current) {
                console.warn('[USE_PERFIL] Watchdog: forçando fim do loading');
                setLoading(false);
                isLoadingRef.current = false;
            }
        }, 12000);

        try {
            const result = await getPerfilAction();
            if (result.error) {
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_profile');
                if (rpcError) throw rpcError;
                if (rpcData) handlePerfilData(rpcData);
            } else if (result.data) {
                handlePerfilData(result.data);
            }
        } catch (err: any) {
            console.error('[USE_PERFIL] Falha:', err.message);
        } finally {
            clearTimeout(watchdogId);
            setLoading(false);
            isLoadingRef.current = false;
        }
    }, [supabase, handlePerfilData]);

    useEffect(() => {
        const initAuth = async () => {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
                setUser(currentUser);
                lastUserIdRef.current = currentUser.id;
                await loadPerfil();
            } else {
                setLoading(false);
                isLoadingRef.current = false;
            }
        };
        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const currentUser = session?.user ?? null;
            const currentId = currentUser?.id ?? null;
            const lastId = lastUserIdRef.current;

            if (event === 'TOKEN_REFRESHED' && currentId === lastId) return;
            if (currentId !== lastId) {
                if (!currentId) {
                    setUser(null);
                    setPerfil(null);
                    setLoading(false);
                    lastUserIdRef.current = null;
                    return;
                }
                setUser(currentUser);
                lastUserIdRef.current = currentId;
                setPerfil(null);
                setLoading(true);
                isLoadingRef.current = true;
                await loadPerfil();
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, loadPerfil]);

    const currentRole = perfil?.role || 'operador';
    const value = useMemo(() => ({
        user,
        perfil,
        loading,
        isAdmin: currentRole === 'admin',
        isGerente: currentRole === 'gerente',
        isOpAdmin: currentRole === 'op_admin',
        isOperador: currentRole === 'operador',
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
