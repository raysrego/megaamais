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
    tfl_pix_total?: number;
    total_pix_manual?: number;
    total_sangrias?: number;
    total_depositos_filial?: number;
    saldo_liquido_final?: number;
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
        
        console.time('fetchMovimentacoes');
        
        // Filtrar apenas os últimos 30 dias para evitar escanear toda a tabela
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        const dataLimite = trintaDiasAtras.toISOString();

        try {
            const { data, error } = await supabase
                .from('caixa_movimentacoes')
                .select(`*, categorias_operacionais!categoria_operacional_id(id, nome, cor)`)
                .eq('sessao_id', sessaoId)
                .is('deleted_at', null)
                .gte('created_at', dataLimite) // 🔥 filtra por data
                .order('created_at', { ascending: false })
                .limit(100); // limite de segurança

            if (error) throw error;
            console.timeEnd('fetchMovimentacoes');
            
            if (isMounted.current) {
                setMovimentacoes(data || []);
            }
        } catch (err) {
            console.error('Erro ao buscar movimentações:', err);
            console.timeEnd('fetchMovimentacoes');
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [supabase]);

    const fetchSessaoAtiva = useCallback(async () => {
        if (!isMounted.current) return;
        
        console.time('fetchSessaoAtiva');
        
        // Timeout de 8 segundos para evitar loading infinito
        const timeoutId = setTimeout(() => {
            if (isMounted.current) {
                console.error('[Caixa] Timeout ao carregar dados');
                setLoading(false);
            }
        }, 8000);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (isMounted.current) setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            const { data, error } = await supabase
                .from('caixa_sessoes')
                .select('*, terminais!terminal_id_ref(codigo, descricao)')
                .eq('operador_id', user.id)
                .eq('status', 'aberto')
                .maybeSingle();

            if (error) throw error;
            console.timeEnd('fetchSessaoAtiva');
            
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
            console.timeEnd('fetchSessaoAtiva');
            if (isMounted.current) setLoading(false);
        } finally {
            clearTimeout(timeoutId);
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

    const abrirCaixa = async (valorInicial: number, terminalCodigo?: string, terminalId?: number, temFundoCaixa: boolean = true) => {
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

    const registrarMovimentacao = async (mov: Omit<CaixaMovimentacao, 'id' | 'sessao_id' | 'created_at'>) => {
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
            delta = 0;
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

    const fecharCaixa = async (valorDeclarado: number, observacoes?: string, tflData?: any) => {
        if (!sessaoAtiva) throw new Error('Nenhuma sessão de caixa aberta');

        const isDiscrepante = valorDeclarado !== (tflData?.tfl_saldo_projetado || sessaoAtiva.valor_final_calculado);

        const { data, error } = await supabase
            .from('caixa_sessoes')
            .update({
                valor_final_declarado: valorDeclarado,
                status: isDiscrepante ? 'discrepante' : 'fechado',
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
