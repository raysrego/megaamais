'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { CaixaSessao, CaixaMovimentacao } from './useCaixa';

import { useLoja } from '@/contexts/LojaContext';

export function useGestorCaixa() {
    const supabase = useMemo(() => createBrowserSupabaseClient(), []);
    const { lojaAtual } = useLoja();
    const [sessoesAtivas, setSessoesAtivas] = useState<CaixaSessao[]>([]);
    const [movimentacoesRecentas, setMovimentacoesRecentes] = useState<any[]>([]);
    const [stats, setStats] = useState({
        saldoConsolidado: 0,
        saldoFisico: 0,
        saldoDigital: 0,
        totalSangriasHoje: 0,
        terminaisAtivos: 0,
        volumeEntradas: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!lojaAtual) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Executa as queries em paralelo para maior performance
            const [sessoesResult, movsResult] = await Promise.all([
                // 1. Buscar sessões abertas
                supabase
                    .from('caixa_sessoes')
                    .select('*, terminais!terminal_id_ref!inner(codigo, descricao, loja_id)')
                    .eq('status', 'aberto')
                    .eq('terminais.loja_id', lojaAtual.id),

                // 2. Buscar movimentações de hoje
                (async () => {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    return supabase
                        .from('caixa_movimentacoes')
                        .select('*, caixa_sessoes!inner(terminal_id, operador_id, terminais!terminal_id_ref!inner(loja_id))')
                        .gte('created_at', hoje.toISOString())
                        .eq('caixa_sessoes.terminais.loja_id', lojaAtual.id)
                        .order('created_at', { ascending: false });
                })()
            ]);

            if (sessoesResult.error) throw sessoesResult.error;
            if (movsResult.error) throw movsResult.error;

            const sessoes = sessoesResult.data || [];
            const movs = movsResult.data || [];

            setSessoesAtivas(sessoes);
            setMovimentacoesRecentes(movs);

            // 3. Calcular Estatísticas
            const todasMovs = movs;

            const digitalEntradas = todasMovs.filter(m => ['pix'].includes(m.tipo)).reduce((acc: number, m: any) => acc + m.valor, 0);
            const digitalSaidas = todasMovs.filter(m => ['pagamento', 'deposito', 'boleto'].includes(m.tipo) && m.metodo_pagamento !== 'dinheiro').reduce((acc: number, m: any) => acc + m.valor, 0);

            const fisicoEntradas = todasMovs.filter(m => ['venda', 'suprimento'].includes(m.tipo)).reduce((acc: number, m: any) => acc + m.valor, 0);
            const fisicoSaidas = todasMovs.filter(m => ['sangria', 'estorno'].includes(m.tipo)).reduce((acc: number, m: any) => acc + m.valor, 0);

            const saldoDigital = digitalEntradas - digitalSaidas;
            const saldoFisico = fisicoEntradas - fisicoSaidas + sessoes.reduce((acc, s) => acc + s.valor_inicial, 0);
            const saldoTotal = sessoes.reduce((acc: number, s: CaixaSessao) => acc + s.valor_final_calculado, 0);

            setStats({
                saldoConsolidado: saldoTotal,
                saldoFisico: saldoFisico,
                saldoDigital: saldoDigital,
                totalSangriasHoje: todasMovs.filter(m => m.tipo === 'sangria').reduce((acc: number, m: any) => acc + m.valor, 0),
                terminaisAtivos: sessoes.length,
                volumeEntradas: fisicoEntradas + digitalEntradas
            });

        } catch (error) {
            console.error('Erro ao buscar dados do gestor:', error);
        } finally {
            setLoading(false);
        }
    }, [supabase, lojaAtual]);

    useEffect(() => {
        fetchData();

        // Subscription para tempo real
        const channel = supabase
            .channel('caixa_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'caixa_movimentacoes' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'caixa_sessoes' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, supabase]);

    return {
        sessoesAtivas,
        movimentacoesRecentas,
        stats,
        loading,
        refresh: fetchData
    };
}
