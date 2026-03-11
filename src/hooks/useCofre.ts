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
            // Buscar Saldo Atual - usa maybeSingle para evitar erro se não houver registro
            const { data: saldoData, error: saldoError } = await supabase
                .from('cofre_saldo_atual')
                .select('saldo')
                .maybeSingle();

            if (saldoError) {
                // Se o erro for de relação não existente (view não criada), exibe mensagem amigável
                if (saldoError.message?.includes('relation') || saldoError.code === '42P01') {
                    console.warn('View cofre_saldo_atual não encontrada. Execute a migration para criá-la.');
                    setError('Configuração do cofre incompleta. Contacte o administrador.');
                } else {
                    console.warn('Erro ao buscar saldo:', saldoError);
                }
                setSaldo(0);
            } else {
                setSaldo(saldoData?.saldo ?? 0);
            }

            // Buscar Pendências
            const { data: pendenciasData, error: pendenciasError } = await supabase
                .from('cofre_sangrias_pendentes')
                .select('*')
                .order('data_hora', { ascending: false });

            if (pendenciasError) {
                if (pendenciasError.message?.includes('relation') || pendenciasError.code === '42P01') {
                    console.warn('View cofre_sangrias_pendentes não encontrada.');
                } else {
                    console.warn('Erro ao buscar pendências:', pendenciasError);
                }
                setPendencias([]);
            } else {
                setPendencias(pendenciasData || []);
            }

            // Buscar Histórico Recente
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

        // Buscar dados da sangria original
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
                valor: Math.abs(sangriaOriginal.valor), // valor positivo
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

        // Validar saldo suficiente (usa o saldo atual, que pode estar desatualizado, mas é uma verificação inicial)
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

        // Realtime Subscription
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
        error,
        confirmarSangria,
        registrarDeposito,
        refresh: fetchDados
    };
}
