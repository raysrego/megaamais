import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export interface MovimentacaoOperador {
    id: number;
    sessao_id: number;
    tipo: 'entrada' | 'saida';
    categoria: string;
    descricao: string | null;
    valor: number;
    created_at: string;
    comprovante_url: string | null;
    loja_nome?: string;
    sessao_numero?: number;
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
                return;
            }

            // Buscar sessões do operador
            let sessoesQuery = supabase
                .from('caixa_sessoes')
                .select('id, numero, lojas(nome_fantasia)')
                .eq('operador_id', user.id);

            if (dataFiltro) {
                sessoesQuery = sessoesQuery
                    .gte('abertura_em', `${dataFiltro}T00:00:00`)
                    .lte('abertura_em', `${dataFiltro}T23:59:59`);
            }

            const { data: sessoes, error: sessoesError } = await sessoesQuery;

            if (sessoesError) throw sessoesError;

            if (!sessoes || sessoes.length === 0) {
                setMovimentacoes([]);
                return;
            }

            const sessoesIds = sessoes.map(s => s.id);

            // Buscar movimentações dessas sessões
            let movQuery = supabase
                .from('caixa_movimentacoes')
                .select('*')
                .in('sessao_id', sessoesIds)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (!dataFiltro) {
                movQuery = movQuery.limit(limit);
            }

            const { data: movs, error: movsError } = await movQuery;

            if (movsError) throw movsError;

            // Enriquecer com dados da sessão
            const enrichedMovs = (movs || []).map(mov => {
                const sessao = sessoes.find(s => s.id === mov.sessao_id);
                const lojas = sessao?.lojas as any;
                return {
                    ...mov,
                    loja_nome: lojas?.nome_fantasia || 'N/A',
                    sessao_numero: sessao?.numero || 0
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
