'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export function useEdgeFunctions() {
    const supabase = createBrowserSupabaseClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Invoca uma Edge Function do Supabase
     */
    const invocar = async <T = any>(
        functionName: string,
        params: any
    ): Promise<T | null> => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: invokeError } = await supabase.functions.invoke(
                functionName,
                {
                    body: params
                }
            );

            if (invokeError) throw invokeError;

            return data as T;
        } catch (err: any) {
            console.error(`Erro ao invocar ${functionName}:`, err);
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Gera relatório financeiro (DRE)
     */
    const gerarRelatorioFinanceiro = async (params: {
        ano: number;
        mes?: number;
        loja_id?: string | null;
    }) => {
        return invocar('gerar-relatorio-financeiro', params);
    };

    /**
     * Gera relatório de bolões (CMV + Lucratividade)
     */
    const gerarRelatorioBoloes = async (params: {
        periodo_inicio?: string;
        periodo_fim?: string;
        loja_id?: string | null;
        status?: 'ativo' | 'encerrado' | 'cancelado' | null;
    }) => {
        return invocar('gerar-relatorio-boloes', params);
    };

    /**
     * Exporta relatório como PDF
     */
    const exportarPDF = async (params: {
        html: string;
        titulo: string;
        orientacao?: 'portrait' | 'landscape';
    }) => {
        return invocar('exportar-pdf', params);
    };

    return {
        loading,
        error,
        invocar,
        gerarRelatorioFinanceiro,
        gerarRelatorioBoloes,
        exportarPDF
    };
}
