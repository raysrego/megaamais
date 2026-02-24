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
    loja_id?: string | null; // Opcional: Se null, é Global (visível para todas)
    created_at?: string;
}

export function useItensFinanceiros() {
    const supabase = createBrowserSupabaseClient();
    const [itens, setItens] = useState<ItemFinanceiro[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const abortControllerRef = useRef<AbortController | null>(null);

    const [optimisticItens, addOptimisticItem] = useOptimistic(
        itens,
        (state, action: { type: 'add' | 'update' | 'delete', payload: any }) => {
            switch (action.type) {
                case 'add':
                    return [...state, { ...action.payload, id: Math.random() }].sort((a, b) => a.ordem - b.ordem);
                case 'update':
                    return state.map(item => item.id === action.payload.id ? { ...item, ...action.payload.updates } : item).sort((a, b) => a.ordem - b.ordem);
                case 'delete':
                    return state.filter(item => item.id !== action.payload);
                default:
                    return state;
            }
        }
    );

    const fetchItens = useCallback(async (lojaId?: string | null) => {
        // Cancelar requisição anterior se houver
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
                .eq('arquivado', false) // ✅ Filtra apenas ativos
                .order('ordem', { ascending: true });

            if (lojaId && lojaId.trim() !== '') {
                // ✅ Query Otimizada para usar o índice composto (loja_id, arquivado, ordem)
                // O OR é suportado, mas precisamos garantir que não anule o uso do índice.
                query = query.or(`loja_id.eq.${lojaId},loja_id.is.null`);
            } else {
                // Se não tiver loja, traz apenas os globais (loja_id IS NULL)
                query = query.is('loja_id', null);
            }

            const { data, error } = await query.abortSignal(signal);

            if (error) {
                if (error.code === '20') return; // Abort error
                throw error;
            }

            // Garantia extra de unicidade no Frontend
            const uniqueItens = data ? Array.from(new Map(data.map(item => [item.id, item])).values()) : [];

            setItens(uniqueItens as any[]);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
                return; // Ignore aborts silently
            }
            console.error('Erro ao buscar itens:', JSON.stringify(error, null, 2));
        } finally {
            setLoading(false);
        }

        // Cleanup function (cancel previous request if new one starts)
        // Note: fetchItens is called imperatively, so we can't easily return cleanup here.
        // But preventing the state update on unmount or race condition is handled by logic/optimistic.
        // For true cancellation, we'd need to store the controller ref.
    }, [supabase]);

    // O fetch será controlado pelo componente via useEffect lá, 
    // ou podemos adicionar um useEffect aqui que dependa explicitamente de um parâmetro.
    // Removendo a chamada automática sem argumentos para evitar erros de inicialização.

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

            // ✅ FIX v2.5.14: Forçar atualização IMEDIATA do estado local
            // Isso garante que mudanças de tipo_recorrencia reflitam nos badges sem refresh
            setItens(prev => prev.map(c => c.id === id ? data : c).sort((a, b) => a.ordem - b.ordem));

            return data;
        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            throw error;
        }
    };

    const excluirItem = async (id: number) => {
        try {
            // Primeiro, desvincula lançamentos que referenciam este item (evita FK constraint)
            await supabase
                .from('financeiro_contas')
                .update({ item_financeiro_id: null })
                .eq('item_financeiro_id', id);

            const { error } = await supabase
                .from('financeiro_itens_plano')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setItens(prev => prev.filter(c => c.id !== id));
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
        startTransition
    };
}
