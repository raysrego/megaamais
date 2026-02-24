'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface ParametroFinanceiro {
    chave: string;
    valor: number;
    descricao: string;
    unidade: string;
    updated_at: string;
}

export function useParametros() {
    const supabase = createBrowserSupabaseClient();
    const [parametros, setParametros] = useState<ParametroFinanceiro[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchParametros = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('financeiro_parametros')
                .select('*')
                .order('chave');

            if (error) throw error;
            setParametros(data || []);
        } catch (error) {
            console.error('Erro ao buscar parâmetros:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const atualizarParametro = async (chave: string, valor: number) => {
        try {
            const { error } = await supabase
                .from('financeiro_parametros')
                .update({ valor })
                .eq('chave', chave);

            if (error) throw error;

            // Atualizar localmente
            setParametros(prev => prev.map(p => p.chave === chave ? { ...p, valor } : p));
            return { success: true };
        } catch (error: any) {
            console.error('Erro ao atualizar parâmetro:', error);
            return { success: false, error: error.message };
        }
    };

    const getParametro = useCallback((chave: string, fallback: number = 0): number => {
        const param = parametros.find(p => p.chave === chave);
        return param ? Number(param.valor) : fallback;
    }, [parametros]);

    useEffect(() => {
        fetchParametros();
    }, [fetchParametros]);

    return {
        parametros,
        loading,
        fetchParametros,
        atualizarParametro,
        getParametro
    };
}
