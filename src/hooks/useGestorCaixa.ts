'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useLoja } from '@/contexts/LojaContext';

// Interface para as movimentações com os dados relacionados
interface MovimentacaoRecente {
    id: number;
    tipo: string;
    valor: number;
    descricao: string | null;
    created_at: string;
    caixa_sessoes: {
        terminal_id: string;
        operador_id: string;
        terminais: {
            loja_id: string;
        };
    };
}

// Interface para as sessões ativas (usando os dados do banco)
interface SessaoAtiva {
    id: number;
    terminal_id: string;
    valor_inicial: number;
    valor_final_calculado: number;
    // outros campos se necessário, mas vamos usar apenas esses
}

interface Stats {
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
    const [stats, setStats] = useState<Stats>({
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
                    .select('id, terminal_id, valor_inicial, valor_final_calculado')
                    .eq('status', 'aberto')
                    .eq('loja_id', lojaAtual.id),

                // 2. Buscar movimentações de hoje com join para terminal
                (async () => {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    return supabase
                        .from('caixa_movimentacoes')
                        .select(`
                            id,
                            tipo,
                            valor,
                            descricao,
                            created_at,
                            caixa_sessoes!inner (
                                terminal_id,
                                operador_id,
                                terminais!terminal_id_ref!inner (
                                    loja_id
                                )
                            )
                        `)
                        .gte('created_at', hoje.toISOString())
                        .eq('caixa_sessoes.terminais.loja_id', lojaAtual.id)
                        .order('created_at', { ascending: false })
                        .limit(50);
                })()
            ]);

            if (sessoesResult.error) throw sessoesResult.error;
            if (movsResult.error) throw movsResult.error;

            const sessoes = sessoesResult.data || [];
            const movs = movsResult.data || [];

            setSessoesAtivas(sessoes);
            setMovimentacoesRecentes(movs as MovimentacaoRecente[]); // Type assertion, mas já está correto

            // Calcular estatísticas
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

            const volumeEntradas = fisicoEntradas + digitalEntradas;

            setStats({
                saldoConsolidado: saldoTotal,
                saldoFisico,
                saldoDigital,
                totalSangriasHoje,
                terminaisAtivos: sessoes.length,
                volumeEntradas
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
