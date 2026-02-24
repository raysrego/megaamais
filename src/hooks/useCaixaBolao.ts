'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface CaixaBolaoSessao {
    id: number;
    responsavel_id: string;
    tipo_responsavel: 'op_admin' | 'gerente';
    data_abertura: string;
    data_fechamento: string | null;
    total_vendido: number;
    total_dinheiro: number;
    total_pix: number;
    dinheiro_informado: number | null;
    pix_informado: number | null;
    status: 'aberto' | 'fechado';
    status_validacao: 'pendente' | 'aprovado' | 'rejeitado';
    validado_por_id: string | null;
    data_validacao: string | null;
    observacoes: string | null;
    observacoes_gerente: string | null;
}

export interface VendaBolao {
    id: number;
    vendedor_id: string;
    vendedor_nome: string;
    valor_total: number;
    metodo_pagamento: 'dinheiro' | 'pix';
    data_venda: string;
}

export function useCaixaBolao() {
    const supabase = createBrowserSupabaseClient();
    const [sessaoAtiva, setSessaoAtiva] = useState<CaixaBolaoSessao | null>(null);
    const [loading, setLoading] = useState(true);

    // Buscar sessão ativa do usuário atual
    const buscarSessaoAtiva = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('caixa_bolao_sessoes')
                .select('*')
                .eq('responsavel_id', user.id)
                .eq('status', 'aberto')
                .order('data_abertura', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            setSessaoAtiva(data);
        } catch (error) {
            console.error('Erro ao buscar sessão ativa:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        buscarSessaoAtiva();
    }, []);

    // Abrir Caixa Bolão
    const abrirCaixaBolao = async (tipoResponsavel: 'op_admin' | 'gerente') => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { data, error } = await supabase
            .from('caixa_bolao_sessoes')
            .insert({
                responsavel_id: user.id,
                tipo_responsavel: tipoResponsavel,
                status: 'aberto',
                total_vendido: 0,
                total_dinheiro: 0,
                total_pix: 0
            })
            .select()
            .single();

        if (error) throw error;
        setSessaoAtiva(data);
        return data;
    };

    // Buscar vendas da sessão (de TODOS operadores)
    const buscarVendasSessao = async (sessaoId: number): Promise<VendaBolao[]> => {
        const { data, error } = await supabase
            .from('vendas_boloes')
            .select(`
                id,
                vendedor_id,
                vendedor:usuarios(nome_completo),
                valor_total,
                metodo_pagamento,
                data_venda
            `)
            .eq('caixa_bolao_sessao_id', sessaoId)
            .order('data_venda', { ascending: false });

        if (error) throw error;

        return data.map((v: any) => ({
            id: v.id,
            vendedor_id: v.vendedor_id,
            vendedor_nome: v.vendedor?.nome_completo || 'Desconhecido',
            valor_total: v.valor_total,
            metodo_pagamento: v.metodo_pagamento,
            data_venda: v.data_venda
        }));
    };

    // Calcular totais da sessão
    const calcularTotaisSessao = async (sessaoId: number) => {
        const vendas = await buscarVendasSessao(sessaoId);

        const totais = vendas.reduce((acc, venda) => {
            acc.total_vendido += venda.valor_total;
            if (venda.metodo_pagamento === 'dinheiro') {
                acc.total_dinheiro += venda.valor_total;
            } else if (venda.metodo_pagamento === 'pix') {
                acc.total_pix += venda.valor_total;
            }
            return acc;
        }, {
            total_vendido: 0,
            total_dinheiro: 0,
            total_pix: 0
        });

        return totais;
    };

    // Fechar Caixa Bolão
    const fecharCaixaBolao = async (params: {
        sessaoId: number;
        dinheiroInformado: number;
        pixInformado: number;
        observacoes?: string;
    }) => {
        // Calcular totais
        const totais = await calcularTotaisSessao(params.sessaoId);

        const { data, error } = await supabase
            .from('caixa_bolao_sessoes')
            .update({
                ...totais,
                dinheiro_informado: params.dinheiroInformado,
                pix_informado: params.pixInformado,
                observacoes: params.observacoes,
                status: 'fechado',
                status_validacao: 'pendente',
                data_fechamento: new Date().toISOString()
            })
            .eq('id', params.sessaoId)
            .select()
            .single();

        if (error) throw error;
        setSessaoAtiva(null);
        return data;
    };

    // Buscar vendas do operador atual (para "Caixa Virtual")
    const buscarMinhasVendas = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('vendas_boloes')
            .select('*')
            .eq('vendedor_id', user.id)
            .gte('data_venda', new Date().toISOString().split('T')[0]) // Vendas de hoje
            .order('data_venda', { ascending: false });

        if (error) throw error;
        return data;
    };

    return {
        sessaoAtiva,
        loading,
        abrirCaixaBolao,
        buscarVendasSessao,
        calcularTotaisSessao,
        fecharCaixaBolao,
        buscarMinhasVendas,
        refresh: buscarSessaoAtiva
    };
}
