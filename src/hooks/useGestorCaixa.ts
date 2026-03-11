'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { CaixaSessao, CaixaMovimentacao } from './useCaixa';
import { useLoja } from '@/contexts/LojaContext';

// Tipos refinados
export interface MovimentacaoRecente {
    id: number;
    tipo: string;
    valor: number;
    descricao: string | null;
    created_at: string;
    caixa_sessoes: {
        terminal_id: string;
    };
}

interface SessaoAtiva extends CaixaSessao {
    terminais?: {
        codigo: string;
        descricao: string;
        loja_id: string;
    };
}

interface StatsGestor {
    saldoConsolidado: number;
    saldoFisico: number;
    saldoDigital: number;
    totalSangriasHoje: number;
    terminaisAtivos: number;
    volumeEntradas: number;
}

export function useGestorCaixa() {
    const supabase = useMemo(() => createBrowserSupabaseClient(), []);
    const { lojaAtual } = useLoja();
    const [sessoesAtivas, setSessoesAtivas] = useState<SessaoAtiva[]>([]);
    const [movimentacoesRecentas, setMovimentacoesRecentes] = useState<MovimentacaoRecente[]>([]);
    const [stats, setStats] = useState<StatsGestor>({
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
            // Executa as queries em paralelo
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
                    const { data, error } = await supabase
                        .from('caixa_movimentacoes')
                        .select('id, tipo, valor, descricao, created_at, caixa_sessoes!inner(terminal_id)')
                        .gte('created_at', hoje.toISOString())
                        .eq('caixa_sessoes.terminais.loja_id', lojaAtual.id)
                        .order('created_at', { ascending: false });
                    return { data, error };
                })()
            ]);

            if (sessoesResult.error) throw sessoesResult.error;
            if (movsResult.error) throw movsResult.error;

            const sessoes = sessoesResult.data || [];
            const movsRaw = movsResult.data || [];

            // Mapear movimentações para o formato esperado (caixa_sessoes como objeto, não array)
            const movs: MovimentacaoRecente[] = movsRaw.map((mov: any) => ({
                id: mov.id,
                tipo: mov.tipo,
                valor: mov.valor,
                descricao: mov.descricao,
                created_at: mov.created_at,
                caixa_sessoes: {
                    terminal_id: mov.caixa_sessoes.terminal_id
                }
            }));

            setSessoesAtivas(sessoes);
            setMovimentacoesRecentes(movs);

            // 3. Calcular Estatísticas
            const digitalEntradas = movs
                .filter(m => m.tipo === 'pix' && m.valor > 0)
                .reduce((acc, m) => acc + m.valor, 0);

            const digitalSaidas = movs
                .filter(m => ['pagamento', 'deposito', 'boleto'].includes(m.tipo) && m.valor < 0)
                .reduce((acc, m) => acc + Math.abs(m.valor), 0);

            const fisicoEntradas = movs
                .filter(m => ['venda', 'suprimento'].includes(m.tipo) && m.valor > 0)
                .reduce((acc, m) => acc + m.valor, 0);

            const fisicoSaidas = movs
                .filter(m => ['sangria', 'estorno'].includes(m.tipo) && m.valor < 0)
                .reduce((acc, m) => acc + Math.abs(m.valor), 0);

            const saldoDigital = digitalEntradas - digitalSaidas;
            const saldoFisico = fisicoEntradas - fisicoSaidas + sessoes.reduce((acc, s) => acc + s.valor_inicial, 0);
            const saldoTotal = sessoes.reduce((acc, s) => acc + s.valor_final_calculado, 0);

            const totalSangriasHoje = movs
                .filter(m => m.tipo === 'sangria')
                .reduce((acc, m) => acc + Math.abs(m.valor), 0);

            setStats({
                saldoConsolidado: saldoTotal,
                saldoFisico,
                saldoDigital,
                totalSangriasHoje,
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
