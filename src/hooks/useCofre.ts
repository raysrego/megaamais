'use client';

import { useState, useCallback, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface CofreMovimentacao {
    id: number;
    tipo: 'entrada_sangria' | 'saida_deposito' | 'ajuste_entrada' | 'ajuste_saida';
    valor: number;
    data_movimentacao: string;
    operador_id: string;
    origem_sangria_id: number | null;
    destino_banco: string | null;
    observacoes: string | null;
}

export interface SangriaPendente {
    sangria_id: number;
    valor: number;
    data_hora: string;
    terminal_id: string;
    operador_id: string;
    observacao_caixa: string;
}

export function useCofre() {
    const supabase = createBrowserSupabaseClient();
    const [saldo, setSaldo] = useState<number>(0);
    const [pendencias, setPendencias] = useState<SangriaPendente[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<CofreMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDados = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Saldo atual via view
            const { data: saldoData, error: saldoError } = await supabase
                .from('cofre_saldo_atual')
                .select('saldo')
                .maybeSingle();

            if (saldoError) {
                console.warn('View cofre_saldo_atual pode não existir:', saldoError);
                setSaldo(0);
            } else {
                setSaldo(saldoData?.saldo ?? 0);
            }

            // 2. Pendências via view
            const { data: pendenciasData, error: pendenciasError } = await supabase
                .from('cofre_sangrias_pendentes')
                .select('*')
                .order('data_hora', { ascending: false });

            if (pendenciasError) {
                console.warn('View cofre_sangrias_pendentes pode não existir:', pendenciasError);
                setPendencias([]);
            } else {
                setPendencias(pendenciasData || []);
            }

            // 3. Histórico recente
            const { data: movData, error: movError } = await supabase
                .from('cofre_movimentacoes')
                .select('*')
                .order('data_movimentacao', { ascending: false })
                .limit(20);

            if (movError) {
                console.warn('Erro ao buscar movimentações:', movError);
                setMovimentacoes([]);
            } else {
                setMovimentacoes(movData || []);
            }

        } catch (error) {
            console.error('Erro ao carregar dados do cofre:', error);
            setError('Falha ao carregar dados do cofre');
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    const confirmarSangria = async (sangriaId: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { data: sangriaOriginal, error: erroBusca } = await supabase
            .from('caixa_movimentacoes')
            .select('valor, descricao')
            .eq('id', sangriaId)
            .single();

        if (erroBusca || !sangriaOriginal) throw new Error('Sangria original não encontrada');

        const { data, error } = await supabase
            .from('cofre_movimentacoes')
            .insert({
                tipo: 'entrada_sangria',
                valor: Math.abs(sangriaOriginal.valor),
                operador_id: user.id,
                origem_sangria_id: sangriaId,
                observacoes: `Conferência: ${sangriaOriginal.descricao || 'Sem observações'}`
            })
            .select()
            .single();

        if (error) throw error;

        await fetchDados();
        return data;
    };

    const registrarDeposito = async (valor: number, bancoDestino: string, comprovante?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        if (valor > saldo) {
            throw new Error('Saldo insuficiente no cofre para este depósito');
        }

        const { data, error } = await supabase
            .from('cofre_movimentacoes')
            .insert({
                tipo: 'saida_deposito',
                valor: valor,
                operador_id: user.id,
                destino_banco: bancoDestino,
                comprovante_doc: comprovante,
                observacoes: `Depósito para ${bancoDestino}`
            })
            .select()
            .single();

        if (error) throw error;

        await fetchDados();
        return data;
    };

    useEffect(() => {
        fetchDados();

        const channel = supabase
            .channel('cofre-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cofre_movimentacoes' }, () => fetchDados())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDados, supabase]);

    return {
        saldo,
        pendencias,
        movimentacoes,
        loading,
        error,
        confirmarSangria,
        registrarDeposito,
        refresh: fetchDados
    };
}
