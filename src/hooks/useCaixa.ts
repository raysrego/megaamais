'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface CaixaSessao {
    id: number;
    operador_id: string;
    terminal_id: string | null;
    terminal_id_ref: number | null;
    data_abertura: string;
    data_fechamento: string | null;
    valor_inicial: number;
    valor_final_declarado: number | null;
    valor_final_calculado: number;
    status: 'aberto' | 'fechado' | 'conferido' | 'discrepante';
    observacoes: string | null;
    tem_fundo_caixa?: boolean;
    tfl_vendas?: number;
    tfl_premios?: number;
    tfl_contas?: number;
    tfl_saldo_projetado?: number;
    tfl_comprovante_url?: string;
    status_validacao?: 'pendente' | 'aprovado' | 'rejeitado';
    validado_por_id?: string;
    data_validacao?: string;
    observacoes_gerente?: string;
}

export interface CaixaMovimentacao {
    id: number;
    sessao_id: number;
    tipo: 'venda' | 'sangria' | 'suprimento' | 'pagamento' | 'estorno' | 'pix' | 'trocados' | 'deposito' | 'boleto';
    valor: number;
    descricao: string | null;
    metodo_pagamento: string;
    referencia_id: string | null;
    classificacao_pix: string | null;
    item_financeiro_id?: number | null;
    categoria_operacional_id?: number | null;
    created_at: string;
    deleted_at?: string | null;
    categorias_operacionais?: {
        id: number;
        nome: string;
        cor: string;
    } | null;
}

export function useCaixa() {
    const supabase = useMemo(() => createBrowserSupabaseClient(), []);
    const [sessaoAtiva, setSessaoAtiva] = useState<CaixaSessao | null>(null);
    const [loading, setLoading] = useState(true);
    const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>([]);
    const realtimeChannel = useRef<RealtimeChannel | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchMovimentacoes = useCallback(async (sessaoId: number) => {
        if (!isMounted.current) return;
        try {
            const { data, error } = await supabase
                .from('caixa_movimentacoes')
                .select(`*, categorias_operacionais!categoria_operacional_id(id, nome, cor)`)
                .eq('sessao_id', sessaoId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            if (isMounted.current) setMovimentacoes(data || []);
        } catch (err) {
            console.error('Erro ao buscar movimentações:', err);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [supabase]);

    const fetchSessaoAtiva = useCallback(async () => {
        if (!isMounted.current) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (isMounted.current) setLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('caixa_sessoes')
                .select('*, terminais!terminal_id_ref(codigo, descricao)')
                .eq('operador_id', user.id)
                .eq('status', 'aberto')
                .maybeSingle();
            if (error) throw error;
            if (isMounted.current) {
                setSessaoAtiva(data);
                if (data) {
                    await fetchMovimentacoes(data.id);
                } else {
                    setLoading(false);
                }
            }
        } catch (err) {
            console.error('Erro ao buscar sessão:', err);
            if (isMounted.current) setLoading(false);
        }
    }, [supabase, fetchMovimentacoes]);

    // Configurar Realtime quando a sessão ativa mudar
    useEffect(() => {
        if (!sessaoAtiva) {
            if (realtimeChannel.current) {
                supabase.removeChannel(realtimeChannel.current);
                realtimeChannel.current = null;
            }
            return;
        }

        if (realtimeChannel.current) {
            supabase.removeChannel(realtimeChannel.current);
        }

        const channel = supabase
            .channel(`movimentacoes:sessao_id=eq.${sessaoAtiva.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'caixa_movimentacoes',
                    filter: `sessao_id=eq.${sessaoAtiva.id}`,
                },
                () => {
                    fetchMovimentacoes(sessaoAtiva.id);
                }
            )
            .subscribe();

        realtimeChannel.current = channel;

        return () => {
            if (realtimeChannel.current) {
                supabase.removeChannel(realtimeChannel.current);
                realtimeChannel.current = null;
            }
        };
    }, [sessaoAtiva, supabase, fetchMovimentacoes]);

    const abrirCaixa = async (
        valorInicial: number,
        terminalCodigo?: string,
        terminalId?: number,
        temFundoCaixa: boolean = true
    ) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { data, error } = await supabase
            .from('caixa_sessoes')
            .insert({
                operador_id: user.id,
                terminal_id: terminalCodigo || 'TFL-WEB',
                terminal_id_ref: terminalId || null,
                valor_inicial: valorInicial,
                valor_final_calculado: valorInicial,
                status: 'aberto',
                tem_fundo_caixa: temFundoCaixa
            })
            .select()
            .single();

        if (error) throw error;
        setSessaoAtiva(data);
        return data;
    };

    const registrarMovimentacao = async (
        mov: Omit<CaixaMovimentacao, 'id' | 'sessao_id' | 'created_at'>
    ) => {
        if (!sessaoAtiva) throw new Error('Nenhuma sessão de caixa aberta');

        const { data, error } = await supabase
            .from('caixa_movimentacoes')
            .insert({
                sessao_id: sessaoAtiva.id,
                ...mov
            })
            .select()
            .single();

        if (error) throw error;

        let delta = mov.valor;
        if (mov.tipo === 'trocados') {
            delta = 0; // trocados não altera saldo
        }

        const novoSaldo = (sessaoAtiva.valor_final_calculado || 0) + delta;

        await supabase
            .from('caixa_sessoes')
            .update({ valor_final_calculado: novoSaldo })
            .eq('id', sessaoAtiva.id);

        setSessaoAtiva(prev => prev ? { ...prev, valor_final_calculado: novoSaldo } : null);
        setMovimentacoes(prev => [data, ...prev]);

        return data;
    };

    const fecharCaixa = async (
        observacoes?: string,
        tflData?: {
            tfl_vendas?: number;
            tfl_premios?: number;
            tfl_contas?: number;
            tfl_saldo_projetado?: number;
            tfl_comprovante_url?: string;
        }
    ) => {
        if (!sessaoAtiva) throw new Error('Nenhuma sessão de caixa aberta');

        // O valor declarado é o mesmo que o calculado (operação sem conferência manual)
        const valorDeclarado = sessaoAtiva.valor_final_calculado;
        const status = 'fechado'; // Poderia ser 'discrepante' se houver lógica de divergência

        const { data, error } = await supabase
            .from('caixa_sessoes')
            .update({
                valor_final_declarado: valorDeclarado,
                status,
                data_fechamento: new Date().toISOString(),
                observacoes: observacoes,
                ...tflData
            })
            .eq('id', sessaoAtiva.id)
            .select()
            .single();

        if (error) throw error;

        setSessaoAtiva(null);
        setMovimentacoes([]);
        return data;
    };

    useEffect(() => {
        fetchSessaoAtiva();
    }, [fetchSessaoAtiva]);

    return {
        sessaoAtiva,
        movimentacoes,
        loading,
        abrirCaixa,
        registrarMovimentacao,
        fecharCaixa,
        refresh: fetchSessaoAtiva
    };
}
