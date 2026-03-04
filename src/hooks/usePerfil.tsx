'use client';

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
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
    // 🔧 Usar useRef para garantir a mesma instância durante todo o ciclo de vida
    const supabaseRef = useRef(createBrowserSupabaseClient());
    const supabase = supabaseRef.current;

    const [user, setUser] = useState<User | null>(null);
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [loading, setLoading] = useState(true);

    // useRef para controlar o último userId evitando chamadas duplicadas
    const lastUserIdRef = useRef<string | null>(null);
    const isLoadingRef = useRef(true);

    // Função auxiliar para mapear e setar o perfil
    const handlePerfilData = (data: any) => {
        let mappedRole = data.role as UserRole;
        if (data.role === 'master') mappedRole = 'admin';
        if (data.role === 'op_master') mappedRole = 'op_admin';

        const finalPerfil: Perfil = {
            ...data,
            role: mappedRole
        };
        setPerfil(finalPerfil);
    };

    // Função que carrega o perfil (chamada apenas quando necessário)
    const loadPerfil = async () => {
        // Se já estiver carregando, não faz nada (evita corrida)
        if (isLoadingRef.current) return;

        isLoadingRef.current = true;
        setLoading(true);

        try {
            // Tenta primeiro via server action
            const result = await getPerfilAction();

            if (result.error) {
                console.warn('[USE_PERFIL] Action falhou, tentando RPC');
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_profile');

                if (rpcError) {
                    console.error('[USE_PERFIL] ❌ Falha total:', rpcError.message);
                    return;
                }

                if (rpcData) {
                    handlePerfilData(rpcData);
                    return;
                }
            }

            if (result.data) {
                handlePerfilData(result.data);
            }
        } catch (err: any) {
            console.error('[USE_PERFIL] Falha crítica:', err.message);
        } finally {
            setLoading(false);
            isLoadingRef.current = false;
        }
    };

    useEffect(() => {
        // Inicializa a autenticação
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

        // Escuta mudanças de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const currentUser = session?.user ?? null;
            const currentId = currentUser?.id ?? null;
            const lastId = lastUserIdRef.current;

            // Se for apenas refresh de token e o usuário é o mesmo, ignora
            if (event === 'TOKEN_REFRESHED' && currentId === lastId) return;

            if (currentId !== lastId) {
                if (!currentId) {
                    // Usuário deslogou
                    setUser(null);
                    setPerfil(null);
                    setLoading(false);
                    lastUserIdRef.current = null;
                    isLoadingRef.current = false;
                    return;
                }

                // Novo usuário logado
                setUser(currentUser);
                lastUserIdRef.current = currentId;
                setPerfil(null);
                setLoading(true);
                isLoadingRef.current = true;
                await loadPerfil();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase]); // Dependência estável graças ao useRef

    // Determina a role atual
    const currentRole = perfil?.role || 'operador';

    // Memoiza o objeto de contexto para evitar re-renderizações desnecessárias
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
