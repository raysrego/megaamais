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

    const fetchDados = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Buscar Saldo Atual (via View)
            const { data: saldoData, error: saldoError } = await supabase
                .from('cofre_saldo_atual')
                .select('saldo')
                .single();

            if (!saldoError && saldoData) {
                setSaldo(saldoData.saldo);
            }

            // 2. Buscar Pendências (via View)
            const { data: pendenciasData, error: pendenciasError } = await supabase
                .from('cofre_sangrias_pendentes')
                .select('*')
                .order('data_hora', { ascending: false });

            if (!pendenciasError) {
                setPendencias(pendenciasData || []);
            }

            // 3. Buscar Histórico Recente
            const { data: movData, error: movError } = await supabase
                .from('cofre_movimentacoes')
                .select('*')
                .order('data_movimentacao', { ascending: false })
                .limit(20);

            if (!movError) {
                setMovimentacoes(movData || []);
            }

        } catch (error) {
            console.error('Erro ao carregar dados do cofre:', error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    const confirmarSangria = async (sangriaId: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Buscar dados da sangria original para garantir valor correto
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
                valor: sangriaOriginal.valor,
                operador_id: user.id,
                origem_sangria_id: sangriaId,
                observacoes: `Conferência: ${sangriaOriginal.descricao || 'Sem observações'}`
            })
            .select()
            .single();

        if (error) throw error;

        // Atualizar estado local
        await fetchDados();
        return data;
    };

    const registrarDeposito = async (valor: number, bancoDestino: string, comprovante?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Validar saldo suficiente
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

        // Realtime Subscription (Opcional por enquanto, mas recomendado)
        const channel = supabase
            .channel('cofre-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cofre_movimentacoes' }, () => {
                fetchDados();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        saldo,
        pendencias,
        movimentacoes,
        loading,
        confirmarSangria,
        registrarDeposito,
        refresh: fetchDados
    };
}
