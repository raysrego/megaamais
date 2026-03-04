'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { usePerfil } from '@/hooks/usePerfil';
import { getLojasAction } from '@/hooks/actions';

interface Empresa {
    id: string;
    nome_fantasia: string;
    grupo_id: string;
}

interface LojaContextType {
    lojaAtual: Empresa | null;
    lojasDisponiveis: Empresa[];
    setLojaAtual: (loja: Empresa | null) => void;
    loading: boolean;
}

const LojaContext = createContext<LojaContextType | undefined>(undefined);

export const LojaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { perfil, loading: loadingPerfil } = usePerfil();
    const supabaseRef = useRef(createBrowserSupabaseClient());
    const supabase = supabaseRef.current;

    const [lojaAtual, setLojaAtual] = useState<Empresa | null>(null);
    const [lojasDisponiveis, setLojasDisponiveis] = useState<Empresa[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isActive = true;
        let timeoutId: NodeJS.Timeout | null = null;

        async function fetchLojas() {
            // Aguarda o perfil carregar antes de prosseguir
            if (loadingPerfil) return;

            if (!perfil) {
                if (isActive) {
                    setLojasDisponiveis([]);
                    setLojaAtual(null);
                    setLoading(false);
                }
                return;
            }

            if (isActive) setLoading(true);

            // Inicia o watchdog apenas para a busca de lojas
            timeoutId = setTimeout(() => {
                if (isActive && loading) {
                    console.warn('[LOJA_CONTEXT] Watchdog: timeout 10s na busca de lojas');
                    setLoading(false);
                }
            }, 10000);

            try {
                const result = await getLojasAction();

                if (!isActive) return;

                if (result.error) {
                    console.warn('[LOJA_CONTEXT] Server Action falhou, tentando fallback direto');

                    let query = supabase
                        .from('empresas')
                        .select('id, nome_fantasia, grupo_id')
                        .eq('ativo', true)
                        .order('nome_fantasia');

                    if (perfil.loja_id) {
                        query = query.eq('id', perfil.loja_id);
                    }

                    const { data, error } = await query;
                    if (error) {
                        console.error('[LOJA_CONTEXT] ❌ Erro total no fetch:', error.message);
                    } else {
                        handleLojasData(data || []);
                    }
                } else if (result.data) {
                    handleLojasData(result.data);
                }
            } catch (err: any) {
                console.error('[LOJA_CONTEXT] 💥 Falha crítica:', err.message);
            } finally {
                if (isActive) {
                    setLoading(false);
                    if (timeoutId) clearTimeout(timeoutId);
                }
            }
        }

        const handleLojasData = (lojas: Empresa[]) => {
            if (!isActive) return;
            setLojasDisponiveis(lojas);

            if (lojas.length > 0) {
                if (perfil?.loja_id) {
                    const lojaFixa = lojas.find(l => l.id === perfil.loja_id) || lojas[0];
                    setLojaAtual(lojaFixa);
                    localStorage.setItem('@megamais/loja_id', lojaFixa.id);
                } else {
                    const savedId = localStorage.getItem('@megamais/loja_id');
                    if (savedId === 'all') {
                        setLojaAtual(null);
                    } else {
                        const savedLoja = lojas.find(l => l.id === savedId);
                        setLojaAtual(savedLoja || lojas[0]);
                    }
                }
            } else {
                setLojaAtual(null);
            }
        };

        fetchLojas();

        return () => {
            isActive = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [perfil, loadingPerfil, supabase]);

    const mudarLoja = (loja: Empresa | null) => {
        setLojaAtual(loja);
        if (loja) {
            localStorage.setItem('@megamais/loja_id', loja.id);
        } else {
            localStorage.setItem('@megamais/loja_id', 'all');
        }
    };

    return (
        <LojaContext.Provider value={{ lojaAtual, lojasDisponiveis, setLojaAtual: mudarLoja, loading }}>
            {children}
        </LojaContext.Provider>
    );
};

export const useLoja = () => {
    const context = useContext(LojaContext);
    if (context === undefined) {
        throw new Error('useLoja must be used within a LojaProvider');
    }
    return context;
};
