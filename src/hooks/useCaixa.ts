'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface CaixaSessao {
    id: number;
    operador_id: string;
    terminal_id: string | null; // Manter legatário por enquanto
    terminal_id_ref: number | null; // Referência formal
    data_abertura: string;
    data_fechamento: string | null;
    valor_inicial: number;
    valor_final_declarado: number | null;
    valor_final_calculado: number;
    status: 'aberto' | 'fechado' | 'conferido' | 'discrepante';
    observacoes: string | null;
    tem_fundo_caixa?: boolean; // Indica se o fundo de R$100 estava presente

    // Dados TFL
    tfl_vendas?: number;
    tfl_premios?: number;
    tfl_contas?: number;
    tfl_saldo_projetado?: number;
    tfl_comprovante_url?: string;
    tfl_pix_total?: number; // NOVO: PIX do relatório TFL (QR Code maquininha)

    // Totalizadores de Fechamento (NOVOS)
    total_pix_manual?: number; // PIX lançados manualmente (outras chaves)
    total_sangrias?: number; // Sangrias informadas no fechamento
    total_depositos_filial?: number; // Depósitos em outras filiais
    saldo_liquido_final?: number; // Saldo TFL - PIX TFL - PIX Manual - Sangrias - Depósitos

    // Validação Gerencial (NOVOS)
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

    const fetchSessaoAtiva = useCallback(async () => {
        try {
            // [OTIMIZAÇÃO] Evitar waterfall - Verificar sessão apenas se usuário existe
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('caixa_sessoes')
                .select('*, terminais!terminal_id_ref(codigo, descricao)')
                .eq('operador_id', user.id)
                .eq('status', 'aberto')
                .maybeSingle();

            if (error) {
                console.error('Erro ao buscar sessão (PostgrestError):', error);
                setSessaoAtiva(null);
                setLoading(false);
            } else {
                setSessaoAtiva(data || null);
                // [OTIMIZAÇÃO] Fetch de movimentações independente e sem travar o loading principal
                if (data) {
                    fetchMovimentacoes(data.id);
                } else {
                    setLoading(false); // Se não tem sessão, libera o loading
                }
            }
        } catch (err) {
            console.error('Erro inesperado em fetchSessaoAtiva:', err);
            setLoading(false);
        }
        // Nota: O setLoading(false) final do fetchMovimentacoes irá liberar a UI se houver sessão
    }, [supabase]);

    const fetchMovimentacoes = async (sessaoId: number) => {
        try {
            const { data, error } = await supabase
                .from('caixa_movimentacoes')
                .select(`
                    *,
                    categorias_operacionais!categoria_operacional_id(id, nome, cor)
                `)
                .eq('sessao_id', sessaoId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao buscar movimentações:', error);
            } else {
                setMovimentacoes(data || []);
            }
        } finally {
            setLoading(false);
        }
    };

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

    // Cálculo correto: respeita o sinal do valor
    let delta = mov.valor;
    if (mov.tipo === 'trocados') {
        delta = 0; // trocados não altera o saldo
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
