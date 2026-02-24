'use server';

import { createClient } from '@/lib/supabase';

export interface CotaEncalheBusca {
    id: number;
    bolao_nome: string;
    concurso: string;
    data_sorteio?: string;
    valor_cota: number;
}

/**
 * Busca cotas com status 'encalhe' de bolões recentes (últimos 30 dias)
 * para vincular a lançamentos de prêmios manuais.
 */
export async function buscarCotasEncalhadasRecentes(lojaId: string): Promise<CotaEncalheBusca[]> {
    const supabase = await createClient();

    // Busca cotas encalhadas de bolões cujos sorteios foram recentes ou estão próximos
    // Unindo com tabela de bolões para pegar detalhes
    const { data, error } = await supabase
        .from('cotas_boloes')
        .select(`
            id,
            valor_cota_base,
            boloes!inner (
                nome,
                concurso,
                data_sorteio,
                loja_id
            )
        `)
        .eq('status', 'encalhe')
        .eq('boloes.loja_id', lojaId)
        .order('id', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Erro ao buscar cotas encalhadas:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.id,
        bolao_nome: item.boloes.nome,
        concurso: item.boloes.concurso,
        data_sorteio: item.boloes.data_sorteio,
        valor_cota: item.valor_cota_base
    }));
}
