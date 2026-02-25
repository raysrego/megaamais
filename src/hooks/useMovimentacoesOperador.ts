import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface MovimentacaoOperador {
    id: number;
    sessao_id: number;
    tipo: string;
    categoria: string;
    descricao: string | null;
    valor: number;
    created_at: string;
    comprovante_url: string | null;
    loja_nome?: string;
    metodo_pagamento?: string;
    categoria_cor?: string;
}

export function useMovimentacoesOperador(dataFiltro?: string, limit: number = 50) {
    const [movimentacoes, setMovimentacoes] = useState<MovimentacaoOperador[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadMovimentacoes = async () => {
        setLoading(true);
        setError(null);

        try {
            const supabase = createBrowserSupabaseClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Usuario nao autenticado');
                setLoading(false);
                return;
            }

            // Buscar sessões do operador com loja
            let sessoesQuery = supabase
                .from('caixa_sessoes')
                .select('id, loja_id, empresas!loja_id(nome_fantasia)')
                .eq('operador_id', user.id);

            if (dataFiltro) {
                sessoesQuery = sessoesQuery
                    .gte('data_abertura', `${dataFiltro}T00:00:00`)
                    .lte('data_abertura', `${dataFiltro}T23:59:59`);
            }

            const { data: sessoes, error: sessoesError } = await sessoesQuery;

            if (sessoesError) {
                console.error('[useMovimentacoesOperador] Erro ao buscar sessões:', sessoesError);
                throw sessoesError;
            }

            if (!sessoes || sessoes.length === 0) {
                setMovimentacoes([]);
                setLoading(false);
                return;
            }

            const sessoesIds = sessoes.map(s => s.id);

            // Buscar movimentações com categorias
            let movQuery = supabase
                .from('caixa_movimentacoes')
                .select(`
                    *,
                    categorias_operacionais!categoria_operacional_id(nome, cor)
                `)
                .in('sessao_id', sessoesIds)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (!dataFiltro) {
                movQuery = movQuery.limit(limit);
            }

            const { data: movs, error: movsError } = await movQuery;

            if (movsError) {
                console.error('[useMovimentacoesOperador] Erro ao buscar movimentações:', movsError);
                throw movsError;
            }

            // Enriquecer com dados da sessão e categoria
            const enrichedMovs = (movs || []).map(mov => {
                const sessao = sessoes.find(s => s.id === mov.sessao_id);
                const empresa = sessao?.empresas as any;
                const categoria = mov.categorias_operacionais as any;

                return {
                    id: mov.id,
                    sessao_id: mov.sessao_id,
                    tipo: mov.tipo,
                    categoria: categoria?.nome || mov.descricao || 'Sem categoria',
                    descricao: mov.descricao,
                    valor: mov.valor,
                    created_at: mov.created_at,
                    comprovante_url: mov.comprovante_url,
                    loja_nome: empresa?.nome_fantasia || 'N/A',
                    metodo_pagamento: mov.metodo_pagamento,
                    categoria_cor: categoria?.cor || '#6b7280'
                };
            });

            setMovimentacoes(enrichedMovs);
        } catch (err: any) {
            console.error('[useMovimentacoesOperador] Erro:', err);
            setError(err.message || 'Erro ao carregar movimentacoes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMovimentacoes();
    }, [dataFiltro, limit]);

    return {
        movimentacoes,
        loading,
        error,
        reload: loadMovimentacoes
    };
}
