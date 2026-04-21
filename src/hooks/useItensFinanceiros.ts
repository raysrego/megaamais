'use client';

import { useState, useCallback, useEffect, useOptimistic, useTransition, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface ItemFinanceiro {
    id: number;
    item: string;
    tipo: 'receita' | 'despesa';
    fixo: boolean;
    tipo_recorrencia?: 'FIXO_MENSAL' | 'FIXO_VARIAVEL' | 'VARIAVEL';
    ordem: number;
    valor_padrao?: number;
    dia_vencimento?: number;
    loja_id?: string | null;
    parent_id?: number | null;
    created_at?: string;
}

export const getCategoriasPai = (itens: ItemFinanceiro[]): ItemFinanceiro[] => 
    itens.filter(item => !item.parent_id);

export const getSubcategorias = (itens: ItemFinanceiro[], parentId: number): ItemFinanceiro[] => 
    itens.filter(item => item.parent_id === parentId);

export function useItensFinanceiros() {
    const supabase = createBrowserSupabaseClient();
    const [itens, setItens] = useState<ItemFinanceiro[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const abortControllerRef = useRef<AbortController | null>(null);

    const [optimisticItens, addOptimisticItem] = useOptimistic(
        itens,
        (state, action: { type: 'add' | 'update' | 'delete'; payload: any }) => {
            switch (action.type) {
                case 'add':
                    return [...state, { ...action.payload, id: Math.random() }].sort((a, b) => a.ordem - b.ordem);
                case 'update':
                    return state.map(item =>
                        item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
                    ).sort((a, b) => a.ordem - b.ordem);
                case 'delete':
                    return state.filter(item => item.id !== action.payload);
                default:
                    return state;
            }
        }
    );

    const fetchItens = useCallback(async (lojaId?: string | null) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        setLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;

        try {
            let query = supabase
                .from('financeiro_itens_plano')
                .select('*')
                .eq('arquivado', false)
                .order('ordem', { ascending: true });

            if (lojaId && lojaId.trim() !== '') {
                query = query.or(`loja_id.eq.${lojaId},loja_id.is.null`);
            } else {
                query = query.is('loja_id', null);
            }

            const { data, error } = await query.abortSignal(signal);

            if (error) {
                if (error.code === '20') return;
                throw error;
            }

            const uniqueItens = data ? Array.from(new Map(data.map(item => [item.id, item])).values()) : [];
            setItens(uniqueItens as ItemFinanceiro[]);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
                return;
            }
            console.error('Erro ao buscar itens:', error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    const salvarItem = async (item: Omit<ItemFinanceiro, 'id'>) => {
        try {
            const { data, error } = await supabase
                .from('financeiro_itens_plano')
                .insert([item])
                .select()
                .single();

            if (error) throw error;
            setItens(prev => [...prev, data].sort((a, b) => a.ordem - b.ordem));
            return data;
        } catch (error) {
            console.error('Erro ao salvar item:', error);
            throw error;
        }
    };

    const atualizarItem = async (id: number, updates: Partial<ItemFinanceiro>) => {
        try {
            const { data, error } = await supabase
                .from('financeiro_itens_plano')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            setItens(prev => prev.map(c => (c.id === id ? data : c)).sort((a, b) => a.ordem - b.ordem));
            return data;
        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            throw error;
        }
    };

    const excluirItem = async (id: number) => {
        try {
            // 1. Verificar se existem transações vinculadas
            const { count: transacoesCount, error: countError } = await supabase
                .from('financeiro_contas')
                .select('*', { count: 'exact', head: true })
                .eq('item_financeiro_id', id);

            if (countError) throw countError;

            if (transacoesCount && transacoesCount > 0) {
                throw new Error(`Existem ${transacoesCount} transações vinculadas a este item. Remova ou reatribua as transações antes de excluir.`);
            }

            // 2. Verificar se existem subcategorias
            const { count: subCount, error: subError } = await supabase
                .from('financeiro_itens_plano')
                .select('*', { count: 'exact', head: true })
                .eq('parent_id', id);

            if (subError) throw subError;

            if (subCount && subCount > 0) {
                throw new Error(`Este item possui ${subCount} subcategoria(s). Remova ou reassocie as subcategorias antes de excluir.`);
            }

            // 3. Realizar a exclusão
            const { error: deleteError } = await supabase
                .from('financeiro_itens_plano')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            // 4. Atualizar estado local
            setItens(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('Erro ao excluir item:', error);
            throw error;
        }
    };

    return {
        itens: optimisticItens,
        realItens: itens,
        loading,
        isPending,
        fetchItens,
        salvarItem,
        atualizarItem,
        excluirItem,
        addOptimisticItem,
        startTransition,
        getCategoriasPai: () => getCategoriasPai(itens),
        getSubcategorias: (parentId: number) => getSubcategorias(itens, parentId),
    };
}
