'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface FechamentoPendente {
    id: number;
    tipo: 'tfl' | 'bolao';
    operador_nome: string;
    data_fechamento: string;
    status_validacao: 'pendente' | 'aprovado' | 'rejeitado';
    // Campos TFL
    saldo_liquido_final?: number;
    total_sangrias?: number;
    total_depositos_filial?: number;
    // Campos Bolão
    total_vendido?: number;
    dinheiro_informado?: number;
    pix_informado?: number;
    total_dinheiro?: number;
    total_pix?: number;
    observacoes?: string;
}

export interface AcaoValidacao {
    fechamentoId: number;
    tipo: 'tfl' | 'bolao';
    acao: 'aprovar' | 'rejeitar';
    observacoes?: string;
}

export function useValidacaoGerencial() {
    const supabase = createBrowserSupabaseClient();
    const [fechamentosPendentes, setFechamentosPendentes] = useState<FechamentoPendente[]>([]);
    const [loading, setLoading] = useState(true);

    // Buscar fechamentos pendentes (TFL + Bolão)
    const buscarFechamentosPendentes = async () => {
        setLoading(true);
        try {
            // 1. Buscar Fechamentos TFL Pendentes
            const { data: tflData, error: tflError } = await supabase
                .from('fechamentos_caixa')
                .select(`
                    id,
                    data_fechamento,
                    saldo_liquido_final,
                    total_sangrias,
                    total_depositos_filial,
                    status_validacao,
                    observacoes,
                    caixa_sessoes (
                        usuario:usuarios (nome)
                    )
                `)
                .eq('status_validacao', 'pendente')
                .order('data_fechamento', { ascending: false });

            if (tflError) throw tflError;

            // 2. Buscar Fechamentos Bolão Pendentes
            const { data: bolaoData, error: bolaoError } = await supabase
                .from('caixa_bolao_sessoes')
                .select(`
                    id,
                    data_fechamento,
                    total_vendido,
                    total_dinheiro,
                    total_pix,
                    dinheiro_informado,
                    pix_informado,
                    status_validacao,
                    observacoes,
                    responsavel:usuarios!responsavel_id (nome)
                `)
                .eq('status_validacao', 'pendente')
                .order('data_fechamento', { ascending: false });

            if (bolaoError) throw bolaoError;

            // 3. Combinar e Normalizar
            const fechamentosTFL: FechamentoPendente[] = (tflData || []).map(f => ({
                id: f.id,
                tipo: 'tfl' as const,
                operador_nome: (f.caixa_sessoes as any)?.usuario?.nome || 'Desconhecido',
                data_fechamento: f.data_fechamento || new Date().toISOString(),
                status_validacao: f.status_validacao as any,
                saldo_liquido_final: f.saldo_liquido_final,
                total_sangrias: f.total_sangrias,
                total_depositos_filial: f.total_depositos_filial,
                observacoes: f.observacoes
            }));

            const fechamentosBolao: FechamentoPendente[] = (bolaoData || []).map(f => ({
                id: f.id,
                tipo: 'bolao' as const,
                operador_nome: (Array.isArray(f.responsavel) ? f.responsavel[0]?.nome : (f.responsavel as any)?.nome) || 'Desconhecido',
                data_fechamento: f.data_fechamento || new Date().toISOString(),
                status_validacao: f.status_validacao as any,
                total_vendido: f.total_vendido,
                dinheiro_informado: f.dinheiro_informado,
                pix_informado: f.pix_informado,
                total_dinheiro: f.total_dinheiro,
                total_pix: f.total_pix,
                observacoes: f.observacoes
            }));

            // 4. Ordenar por data (mais recentes primeiro)
            const todosOsFechamentos = [...fechamentosTFL, ...fechamentosBolao]
                .sort((a, b) => new Date(b.data_fechamento).getTime() - new Date(a.data_fechamento).getTime());

            setFechamentosPendentes(todosOsFechamentos);
        } catch (error) {
            console.error('Erro ao buscar fechamentos pendentes:', error);
            setFechamentosPendentes([]);
        } finally {
            setLoading(false);
        }
    };

    // Validar Fechamento (Aprovar ou Rejeitar)
    const validarFechamento = async ({ fechamentoId, tipo, acao, observacoes }: AcaoValidacao) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const tabela = tipo === 'tfl' ? 'fechamentos_caixa' : 'caixa_bolao_sessoes';
            const novoStatus = acao === 'aprovar' ? 'aprovado' : 'rejeitado';

            const { error } = await supabase
                .from(tabela)
                .update({
                    status_validacao: novoStatus,
                    validado_por_id: user.id,
                    data_validacao: new Date().toISOString(),
                    observacoes_gerente: observacoes || null
                })
                .eq('id', fechamentoId);

            if (error) throw error;

            // Atualizar lista local
            await buscarFechamentosPendentes();

            return { success: true };
        } catch (error: any) {
            console.error('Erro ao validar fechamento:', error);
            throw new Error(error.message || 'Erro ao validar fechamento');
        }
    };

    useEffect(() => {
        buscarFechamentosPendentes();
    }, []);

    return {
        fechamentosPendentes,
        loading,
        validarFechamento,
        refresh: buscarFechamentosPendentes
    };
}
