'use client';

import { useState, useCallback, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { getFinanceiroAction } from './actions';
import { somaSegura, agruparPorCategoria } from '@/lib/financial-utils';

export interface TransacaoFinanceira {
    id: number;
    tipo: 'receita' | 'despesa';
    descricao: string;
    valor: number;
    item: string;
    data_vencimento: string;
    data_pagamento: string | null;
    status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
    recorrente: boolean;
    frequencia: string | null;
    loja_id?: string | null;
    metodo_pagamento?: 'pix' | 'dinheiro' | 'boleto' | 'cartao' | 'outros';
    comprovante_url?: string | null;
    item_financeiro_id?: number | null;
}

export interface ResumoFinanceiro {
    mes: string;
    receitas: number;
    despesas: number;
    detalheReceitas: { item: string; total: number }[];
    detalheDespesas: { item: string; total: number }[];
}

export function useFinanceiro() {
    const supabase = createBrowserSupabaseClient();
    const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>([]);
    const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
    const [loading, setLoading] = useState(true);

    const handleFinanceiroData = useCallback((items: TransacaoFinanceira[], mes: number, ano: number) => {
        // Calcular Resumo Localmente com soma segura
        const recs = items.filter(t => t.tipo === 'receita');
        const desps = items.filter(t => t.tipo === 'despesa');

        // Usar soma segura para evitar erros de ponto flutuante
        const totalReceitas = somaSegura(recs.map(t => t.valor));
        const totalDespesas = somaSegura(desps.map(t => t.valor));

        // Agrupar usando função utilitária
        const detalheReceitas = agruparPorCategoria(recs).map(item => ({
            item: item.item,
            total: item.total
        }));

        const detalheDespesas = agruparPorCategoria(desps).map(item => ({
            item: item.item,
            total: item.total
        }));

        setResumo({
            mes: mes === 0 ? `Ano ${ano}` : `${mes}/${ano}`,
            receitas: totalReceitas,
            despesas: totalDespesas,
            detalheReceitas,
            detalheDespesas
        });
    }, []);

    const fetchTransacoes = useCallback(async (ano: number, mes: number | 0, lojaId: string | null) => {
        setLoading(true);

        try {
            // PRIORIDADE: Server Action (Mais estável e foge do lock de RLS)
            const result = await getFinanceiroAction(ano, mes, lojaId);

            if (result.error) {
                console.warn('[FINANCEIRO] Server Action falhou, tentando fallback direto');

                // FALLBACK: Query Direta (Caso a action falhe)
                let query = supabase
                    .from('financeiro_contas')
                    .select('*')
                    .is('deleted_at', null) // ✅ Filtrar soft deletes
                    .order('data_vencimento', { ascending: true });

                // Filtro de Mês/Ano
                if (mes === 0) {
                    const startDate = `${ano}-01-01`;
                    const endDate = `${ano}-12-31`;
                    query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
                } else {
                    const startDate = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
                    const endDate = new Date(ano, mes, 0).toISOString().split('T')[0];
                    query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
                }

                if (lojaId) query = query.eq('loja_id', lojaId);

                const { data, error: fbError } = await query;

                if (fbError) {
                    console.error('[FINANCEIRO] Erro no fallback:', fbError);
                    throw fbError;
                }

                const items = (data as TransacaoFinanceira[]) || [];
                setTransacoes(items);
                handleFinanceiroData(items, mes, ano);
            } else if (result.data) {
                const items = (result.data as TransacaoFinanceira[]) || [];
                setTransacoes(items);
                handleFinanceiroData(items, mes, ano);
            } else {
                // Sem erro mas sem dados - inicializar vazio
                setTransacoes([]);
                handleFinanceiroData([], mes, ano);
            }
        } catch (error) {
            console.error('[FINANCEIRO] Erro ao buscar financeiro:', error);
            // Em caso de erro, limpar estado para evitar dados inconsistentes
            setTransacoes([]);
            setResumo(null);
        } finally {
            // Sempre garantir que loading seja false
            setLoading(false);
        }
    }, [supabase, handleFinanceiroData]);

    const salvarTransacao = async (transacao: Omit<TransacaoFinanceira, 'id' | 'status' | 'data_pagamento' | 'recorrente' | 'frequencia'> & {
        status?: TransacaoFinanceira['status'];
        data_pagamento?: TransacaoFinanceira['data_pagamento'];
        recorrente?: boolean;
        frequencia?: string | null;
        loja_id?: string | null;
    }) => {
        const { data: { user } } = await supabase.auth.getUser();

        const statusFinal = transacao.status || (transacao.tipo === 'receita' && transacao.metodo_pagamento === 'pix' ? 'pago' : 'pendente');
        const dataPagamentoFinal = transacao.data_pagamento || (statusFinal === 'pago' && !transacao.data_pagamento ? new Date().toISOString() : null);

        // Construir payload limpo (sem campos undefined/extras)
        const payload: Record<string, any> = {
            tipo: transacao.tipo,
            descricao: transacao.descricao,
            valor: transacao.valor,
            item: transacao.item,
            data_vencimento: transacao.data_vencimento,
            recorrente: transacao.recorrente ?? false,
            frequencia: transacao.recorrente ? transacao.frequencia : null,
            loja_id: transacao.loja_id,
            status: statusFinal,
            data_pagamento: dataPagamentoFinal,
            usuario_id: user?.id
        };

        // Adicionar item_financeiro_id apenas se for um número válido
        if (transacao.item_financeiro_id && typeof transacao.item_financeiro_id === 'number') {
            payload.item_financeiro_id = transacao.item_financeiro_id;
        }

        console.log('[FINANCEIRO] 📤 Payload de INSERT:', JSON.stringify(payload, null, 2));

        // Timeout de 15s para evitar hang infinito
        const timeoutMs = 15000;
        const insertPromise = supabase
            .from('financeiro_contas')
            .insert(payload)
            .select();  // Sem .single() — evita 406 se RLS bloquear o SELECT pós-insert

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: O servidor não respondeu em ${timeoutMs / 1000}s. Verifique sua conexão.`)), timeoutMs)
        );

        const { data, error } = await Promise.race([insertPromise, timeoutPromise]) as any;

        if (error) {
            console.error('[FINANCEIRO] Erro INSERT:', error);
            throw new Error(error.message || error.details || 'Erro ao salvar. Verifique permissões e dados.');
        }

        if (!data || data.length === 0) {
            console.error('[FINANCEIRO] INSERT retornou 0 registros — possível bloqueio de RLS');
            throw new Error('Registro não pôde ser criado. Verifique permissões (RLS).');
        }

        return data[0];
    };

    const darBaixa = async (id: number, dados: { dataPagamento: string; metodo: string; arquivo: File | null }) => {
        let comprovanteUrl = null;

        if (dados.arquivo) {
            const fileExt = dados.arquivo.name.split('.').pop();
            const fileName = `${id}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('comprovantes')
                .upload(filePath, dados.arquivo);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('comprovantes')
                .getPublicUrl(filePath);

            comprovanteUrl = publicUrl;
        }

        const { data, error } = await supabase
            .from('financeiro_contas')
            .update({
                status: 'pago',
                data_pagamento: dados.dataPagamento,
                metodo_pagamento: dados.metodo,
                comprovante_url: comprovanteUrl
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        setTransacoes(prev => prev.map(t =>
            t.id === id ? {
                ...t,
                status: 'pago',
                data_pagamento: dados.dataPagamento,
                metodo_pagamento: dados.metodo as any,
                comprovante_url: comprovanteUrl
            } : t
        ));

        return data;
    };

    const fetchAnosDisponiveis = useCallback(async (lojaId: string | null) => {
        try {
            const p_id = lojaId && lojaId.length > 10 ? lojaId : null;
            const { data, error } = await supabase.rpc('get_anos_financeiros_disponiveis', {
                p_loja_id: p_id
            });

            if (error) {
                console.warn('[FINANCEIRO] RPC get_anos_financeiros_disponiveis falhou.', error.message);
                throw error;
            }
            return (data as { ano: number }[]).map(d => d.ano);
        } catch (error: any) {
            console.error('Erro ao buscar anos disponíveis:', error?.message || error);
            return [new Date().getFullYear()];
        }
    }, [supabase]);

    return {
        transacoes,
        resumo,
        loading,
        fetchTransacoes,
        fetchAnosDisponiveis,
        salvarTransacao,
        darBaixa,
        atualizarTransacao: async (id: number, dados: any) => {
            // Se tiver status 'pago', força definição da data_pagamento
            if (dados.status === 'pago' && !dados.data_pagamento) {
                dados.data_pagamento = new Date().toISOString();
            }
            if (dados.status === 'pendente') {
                dados.data_pagamento = null;
            }

            // Timeout de 15s para evitar hang infinito
            const timeoutMs = 15000;
            const updatePromise = supabase
                .from('financeiro_contas')
                .update(dados)
                .eq('id', id)
                .select();  // Sem .single() — evita 406 se RLS bloquear o SELECT pós-update

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout: O servidor não respondeu em ${timeoutMs / 1000}s. Verifique sua conexão.`)), timeoutMs)
            );

            const { data, error } = await Promise.race([updatePromise, timeoutPromise]) as any;

            if (error) {
                console.error('[FINANCEIRO] Erro UPDATE:', error);
                throw new Error(error.message || 'Erro ao atualizar registro');
            }

            if (!data || data.length === 0) {
                console.error('[FINANCEIRO] UPDATE retornou 0 registros — possível bloqueio de RLS');
                throw new Error('Registro não pôde ser atualizado. Verifique permissões (RLS).');
            }

            return data[0];
        },
        excluirTransacao: async (id: number) => {
            // Optimistic Update: Remove imediatamente da lista visual
            const previousTransacoes = [...transacoes];
            setTransacoes(prev => prev.filter(t => t.id !== id));

            try {
                const { error } = await supabase
                    .from('financeiro_contas')
                    .delete()
                    .eq('id', id);

                if (error) {
                    // Revert se falhar
                    setTransacoes(previousTransacoes);
                    throw error;
                }

                // ✅ FIX P6: Recalcular resumo com a lista atualizada
                const updated = previousTransacoes.filter(t => t.id !== id);
                setTransacoes(updated);
                // O useMemo em VisaoGestor recalculará automaticamente os KPIs

                return true;
            } catch (error) {
                console.error('Erro ao excluir:', error);
                throw error;
            }
        }
    };
}

