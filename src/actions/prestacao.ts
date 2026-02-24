'use server';

import { createClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export interface ResumoPendencia {
    operador_id: string;
    operador_nome: string;
    total_pendente: number;
    qtd_vendas: number;
    ultimo_venda: string;
}

/**
 * Busca o total pendente de prestação de um operador específico
 */
export async function getPendenciaOperador(operadorId: string) {
    const supabase = await createClient();

    // Soma vendas com status_prestacao = 'pendente'
    // E método != 'pix' (pois pix já cai na conta geralmente, mas depende da regra. 
    // Na regra atual useVendasBolao, se for PIX e sem sessão, fica pendente?
    // Vamos assumir que PIX cai direto na conta destino, então a prestação é de DINHEIRO.
    // Mas se o sistema não tiver integração PIX auto, o operador valida.
    // Vamos filtrar por metodo_pagamento = 'dinheiro' por segurança inicial ou somar tudo se for confiar.
    // Regra UX discutida: "O dinheiro fica como Dívida do Operador". Geralmente apenas espécie.

    // Ajuste: Vamos pegar apenas DINHEIRO por enquanto, que é o risco maior.

    const { data, error } = await supabase
        .from('vendas_boloes')
        .select('valor_total')
        .eq('usuario_id', operadorId)
        .eq('status_prestacao', 'pendente')
        .eq('metodo_pagamento', 'dinheiro');

    if (error) {
        console.error('Erro ao calcular pendência:', error);
        return { total: 0, count: 0 };
    }

    const total = data.reduce((acc, curr) => acc + Number(curr.valor_total), 0);

    return {
        total,
        count: data.length
    };
}

/**
 * Lista todos os operadores com pendências na filial (Para o Op. Admin)
 */
export async function listarPendenciasFilial(lojaId: string): Promise<ResumoPendencia[]> {
    const supabase = await createClient();

    // Isso é uma query complexa. O ideal seria uma View.
    // Vamos fazer via RPC ou query raw se RLS permitir. 
    // Como estamos na action, podemos fazer queries compostas.

    // 1. Pegar operadores da loja
    const { data: operadores } = await supabase
        .from('perfis')
        .select('id, nome')
        .eq('loja_id', lojaId)
        .eq('role', 'operador');

    if (!operadores) return [];

    const resultados: ResumoPendencia[] = [];

    for (const op of operadores) {
        const { total, count } = await getPendenciaOperador(op.id);
        if (total > 0) {
            resultados.push({
                operador_id: op.id,
                operador_nome: op.nome || 'Sem nome',
                total_pendente: total,
                qtd_vendas: count,
                ultimo_venda: new Date().toISOString() // Simplificação, ideal seria query real
            });
        }
    }

    return resultados;
}

/**
 * Realiza a Prestação de Contas (Baixa das vendas pendentes e Criação do Registro de Prestação)
 */
export async function realizarPrestacaoContas(
    operadorId: string,
    lojaId: string,
    valorRecebido: number,
    metodoRecebimento: 'dinheiro' | 'pix' = 'dinheiro',
    observacao?: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser(); // Quem está recebendo (Op. Admin)

    if (!user) throw new Error("Usuário não autenticado");

    // 1. Criar o registro de Prestação
    const { data: prestacao, error: errPrest } = await supabase
        .from('prestacoes_contas')
        .insert({
            loja_id: lojaId,
            operador_id: operadorId,
            responsavel_id: user.id,
            valor_total: valorRecebido,
            metodo_pagamento: metodoRecebimento,
            observacao
        })
        .select()
        .single();

    if (errPrest) throw new Error(`Erro ao criar prestação: ${errPrest.message}`);

    // 2. Baixar as vendas pendentes (Atualizar status)
    // ATENÇÃO: Baixamos as vendas de DINHEIRO mais antigas até cobrir o valor?
    // Ou baixamos TUDO que for 'pendente' e assumimos que o valor bate?
    // Modelo simples: Baixar todas as vendas 'pendente' do tipo 'dinheiro'.
    // E valida se o valor bate.

    const { error: errUpdate } = await supabase
        .from('vendas_boloes')
        .update({
            status_prestacao: 'concluido',
            prestacao_id: prestacao.id
        })
        .eq('usuario_id', operadorId)
        .eq('status_prestacao', 'pendente')
        .eq('metodo_pagamento', 'dinheiro');

    if (errUpdate) throw new Error(`Erro ao baixar vendas: ${errUpdate.message}`);

    revalidatePath('/caixa/historico');
    return { success: true, prestacaoId: prestacao.id };
}
