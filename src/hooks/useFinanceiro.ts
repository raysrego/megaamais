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
    // 👇 Remove qualquer campo id que possa ter vindo no objeto
    const { id, ...dadosLimpos } = transacao as any;

    const { data: { user } } = await supabase.auth.getUser();

    const statusFinal = dadosLimpos.status || (dadosLimpos.tipo === 'receita' && dadosLimpos.metodo_pagamento === 'pix' ? 'pago' : 'pendente');
    const dataPagamentoFinal = dadosLimpos.data_pagamento || (statusFinal === 'pago' && !dadosLimpos.data_pagamento ? new Date().toISOString() : null);

    // Construir payload limpo
    const payload: Record<string, any> = {
        tipo: dadosLimpos.tipo,
        descricao: dadosLimpos.descricao,
        valor: dadosLimpos.valor,
        item: dadosLimpos.item,
        data_vencimento: dadosLimpos.data_vencimento,
        recorrente: dadosLimpos.recorrente ?? false,
        frequencia: dadosLimpos.recorrente ? dadosLimpos.frequencia : null,
        loja_id: dadosLimpos.loja_id,
        status: statusFinal,
        data_pagamento: dataPagamentoFinal,
        usuario_id: user?.id
    };

    // Adicionar item_financeiro_id apenas se for um número válido
    if (dadosLimpos.item_financeiro_id && typeof dadosLimpos.item_financeiro_id === 'number') {
        payload.item_financeiro_id = dadosLimpos.item_financeiro_id;
    }

    console.log('[FINANCEIRO] 📤 Payload de INSERT (sem id):', JSON.stringify(payload, null, 2));

    const { data, error } = await supabase
        .from('financeiro_contas')
        .insert(payload)
        .select();

    if (error) {
        console.error('[FINANCEIRO] Erro INSERT:', error);
        throw new Error(error.message || error.details || 'Erro ao salvar.');
    }


        if (!data || data.length === 0) {
            console.warn('[FINANCEIRO] INSERT retornou 0 registros — possível bloqueio de RLS');
            // Não falhar - pode ter sido inserido mas RLS bloqueou SELECT
            return null;
        }

        // Atualizar estado local imediatamente
        const novaTransacao = data[0] as TransacaoFinanceira;
        const novasTransacoes = [novaTransacao, ...transacoes];
        setTransacoes(novasTransacoes);

        // Recalcular resumo imediatamente
        const recs = novasTransacoes.filter(t => t.tipo === 'receita');
        const desps = novasTransacoes.filter(t => t.tipo === 'despesa');
        handleFinanceiroData(novasTransacoes, new Date().getMonth() + 1, new Date().getFullYear());

        return novaTransacao;
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

            // UPDATE sem timeout - deixar Supabase gerenciar
            const { data, error } = await supabase
                .from('financeiro_contas')
                .update(dados)
                .eq('id', id)
                .select();

            if (error) {
                console.error('[FINANCEIRO] Erro UPDATE:', error);
                throw new Error(error.message || 'Erro ao atualizar registro');
            }

            if (!data || data.length === 0) {
                console.warn('[FINANCEIRO] UPDATE retornou 0 registros — possível bloqueio de RLS');
                // Não falhar - pode ter sido atualizado mas RLS bloqueou SELECT
                // Atualizar estado local otimisticamente
                setTransacoes(prev => prev.map(t => t.id === id ? { ...t, ...dados } : t));
                return null;
            }

            // Atualizar estado local com dados do banco
            const transacaoAtualizada = data[0] as TransacaoFinanceira;
            const novasTransacoes = transacoes.map(t => t.id === id ? transacaoAtualizada : t);
            setTransacoes(novasTransacoes);

            // Recalcular resumo
            handleFinanceiroData(novasTransacoes, new Date().getMonth() + 1, new Date().getFullYear());

            return transacaoAtualizada;
        },
        excluirTransacao: async (id: number) => {
            // Optimistic Update: Remove imediatamente da lista visual
            const previousTransacoes = [...transacoes];
            const novasTransacoes = transacoes.filter(t => t.id !== id);
            setTransacoes(novasTransacoes);

            // Recalcular resumo imediatamente
            handleFinanceiroData(novasTransacoes, new Date().getMonth() + 1, new Date().getFullYear());

            try {
                const { data: { user } } = await supabase.auth.getUser();

                // Soft Delete: Marcar como excluído ao invés de deletar
                const { error } = await supabase
                    .from('financeiro_contas')
                    .update({
                        deleted_at: new Date().toISOString(),
                        deleted_by: user?.id || null
                    })
                    .eq('id', id)
                    .is('deleted_at', null); // Apenas se não foi excluído antes

                if (error) {
                    console.error('[FINANCEIRO] Erro ao excluir (soft delete):', error);
                    // Revert se falhar
                    setTransacoes(previousTransacoes);
                    handleFinanceiroData(previousTransacoes, new Date().getMonth() + 1, new Date().getFullYear());
                    throw error;
                }

                // Sucesso - estado já está atualizado pelo optimistic update
                console.log('[FINANCEIRO] ✅ Registro excluído com sucesso (soft delete)');
                return true;
            } catch (error) {
                console.error('[FINANCEIRO] Erro ao excluir:', error);
                throw error;
            }
        }
    };
}

