'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
    updated_at?: string;
}

export function useItensFinanceiros() {
    const supabase = createBrowserSupabaseClient();
    const [itens, setItens] = useState<ItemFinanceiro[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, setIsPending] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

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
                .eq('arquivado', false)
                .order('ordem', { ascending: true });

            if (lojaId && lojaId.trim() !== '') {
                query = query.or(`loja_id.eq.${lojaId},loja_id.is.null`);
            } else {
                query = query.is('loja_id', null);
            }

            const { data, error } = await query.abortSignal(signal);
            if (error) {
                if (error.code === '20') return; // AbortError
                throw error;
            }

            // Remover possíveis duplicatas (garantia)
            const uniqueItens = data ? Array.from(new Map(data.map(item => [item.id, item])).values()) : [];
            setItens(uniqueItens as ItemFinanceiro[]);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
                return;
            }
            console.error('[useItensFinanceiros] fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    // Carregar inicial (opcional – o componente chama fetchItens explicitamente)
    useEffect(() => {
        // Não carrega automaticamente – o componente controla quando chamar
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const salvarItem = async (item: Omit<ItemFinanceiro, 'id'>) => {
        setIsPending(true);
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
            console.error('[useItensFinanceiros] salvar error:', error);
            throw error;
        } finally {
            setIsPending(false);
        }
    };

    const atualizarItem = async (id: number, updates: Partial<ItemFinanceiro>) => {
        setIsPending(true);
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
            console.error('[useItensFinanceiros] atualizar error:', error);
            throw error;
        } finally {
            setIsPending(false);
        }
    };

    const excluirItem = async (id: number) => {
        setIsPending(true);
        try {
            // 1. Verificar se existem transações financeiras vinculadas
            const { count: transacoesCount, error: countError } = await supabase
                .from('financeiro_contas')
                .select('*', { count: 'exact', head: true })
                .eq('item_financeiro_id', id);

            if (countError) {
                throw new Error(`Erro ao verificar transações: ${countError.message}`);
            }

            if (transacoesCount && transacoesCount > 0) {
                throw new Error(`Existem ${transacoesCount} transação(ões) vinculada(s) a este item. Remova ou reatribua as transações antes de excluir.`);
            }

            // 2. Verificar se existem subcategorias (itens que têm este como parent_id)
            const { count: subCount, error: subError } = await supabase
                .from('financeiro_itens_plano')
                .select('*', { count: 'exact', head: true })
                .eq('parent_id', id);

            if (subError) {
                throw new Error(`Erro ao verificar subcategorias: ${subError.message}`);
            }

            if (subCount && subCount > 0) {
                throw new Error(`Este item possui ${subCount} subcategoria(s). Remova ou reassocie as subcategorias antes de excluir.`);
            }

            // 3. Executar exclusão
            const { error: deleteError } = await supabase
                .from('financeiro_itens_plano')
                .delete()
                .eq('id', id);

            if (deleteError) {
                throw new Error(`Erro ao excluir: ${deleteError.message}`);
            }

            // 4. Atualizar estado local (após sucesso)
            setItens(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('[useItensFinanceiros] excluir error:', error);
            throw error;
        } finally {
            setIsPending(false);
        }
    };

    return {
        itens,
        loading,
        isPending,
        fetchItens,
        salvarItem,
        atualizarItem,
        excluirItem,
    };
}
