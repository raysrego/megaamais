'use client';

import { useState, useCallback, useEffect, useOptimistic, useTransition, useMemo } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface Terminal {
    id: number;
    codigo: string;
    descricao: string;
    modelo: string;
    status: 'ativo' | 'manutencao' | 'inativo';
    created_at: string;
}

export function useTerminais() {
    const supabase = useMemo(() => createBrowserSupabaseClient(), []);
    const [terminais, setTerminais] = useState<Terminal[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const [optimisticTerminais, addOptimisticTerminal] = useOptimistic(
        terminais,
        (state, action: { type: 'add' | 'update' | 'delete', payload: any }) => {
            switch (action.type) {
                case 'add':
                    return [...state, { ...action.payload, id: Math.random(), created_at: new Date().toISOString() }];
                case 'update':
                    return state.map(t => t.id === action.payload.id ? { ...t, ...action.payload.updates } : t);
                case 'delete':
                    return state.filter(t => t.id !== action.payload);
                default:
                    return state;
            }
        }
    );

    const fetchTerminais = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('terminais')
                .select('*')
                .order('codigo', { ascending: true });

            if (error) throw error;
            setTerminais(data || []);
        } catch (error) {
            console.error('Erro ao buscar terminais:', error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    const addTerminal = async (terminal: Omit<Terminal, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await supabase
                .from('terminais')
                .insert([terminal])
                .select();

            if (error) throw error;
            setTerminais(prev => [...prev, data[0]]);
            return data[0];
        } catch (error) {
            console.error('Erro ao adicionar terminal:', error);
            throw error;
        }
    };

    const updateTerminal = async (id: number, updates: Partial<Terminal>) => {
        try {
            const { data, error } = await supabase
                .from('terminais')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            setTerminais(prev => prev.map(t => t.id === id ? { ...t, ...data[0] } : t));
            return data[0];
        } catch (error) {
            console.error('Erro ao atualizar terminal:', error);
            throw error;
        }
    };

    const deleteTerminal = async (id: number) => {
        try {
            const { error } = await supabase
                .from('terminais')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setTerminais(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Erro ao excluir terminal:', error);
            throw error;
        }
    };

    useEffect(() => {
        fetchTerminais();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        terminais: optimisticTerminais,
        realTerminais: terminais,
        loading,
        isPending,
        fetchTerminais,
        addTerminal,
        updateTerminal,
        deleteTerminal,
        addOptimisticTerminal,
        startTransition
    };
}
