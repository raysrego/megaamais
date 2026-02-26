'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { v4 as uuidv4 } from 'uuid'; // para gerar nome único de arquivo

export function useVendasBolao() {
    const supabase = createBrowserSupabaseClient();
    const [loading, setLoading] = useState(false);

    /**
     * Realiza a venda de cotas de bolão.
     * @param bolaoId ID do bolão
     * @param qtd Quantidade de cotas
     * @param valorTotal Valor total da venda
     * @param metodo Forma de pagamento
     * @param comprovante Arquivo de comprovante (opcional, apenas para Pix)
     */
    const venderCota = async (
        bolaoId: number,
        qtd: number,
        valorTotal: number,
        metodo: 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito',
        comprovante?: File | null
    ) => {
        setLoading(true);
        // Para possível rollback manual
        let vendaId: number | null = null;
        let uploadedUrl: string | null = null;

        try {
            // 1. Verificar usuário autenticado
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // 2. Obter loja do usuário (empresa_id)
            const { data: usuario, error: errUsuario } = await supabase
                .from('usuarios')
                .select('empresa_id')
                .eq('id', user.id)
                .single();

            if (errUsuario || !usuario?.empresa_id) {
                throw new Error('Loja do usuário não encontrada');
            }
            const lojaId = usuario.empresa_id;

            // 3. Verificar se há sessão de caixa aberta para este usuário (opcional)
            const { data: sessao } = await supabase
                .from('caixa_sessoes')
                .select('id, valor_final_calculado')
                .eq('operador_id', user.id) // no schema, caixa_sessoes.operador_id é o user id
                .eq('status', 'aberto')
                .maybeSingle();

            // 4. Se for Pix e tiver comprovante, fazer upload
            if (metodo === 'pix' && comprovante) {
                const fileExt = comprovante.name.split('.').pop();
                const fileName = `comprovantes/${uuidv4()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('comprovantes-pix') // bucket name, ajuste conforme necessário
                    .upload(fileName, comprovante);

                if (uploadError) throw new Error('Erro ao fazer upload do comprovante');

                const { data: urlData } = supabase.storage
                    .from('comprovantes-pix')
                    .getPublicUrl(fileName);

                uploadedUrl = urlData.publicUrl;
            }

            // 5. Inserir venda em vendas_boloes
            const { data: venda, error: errVenda } = await supabase
                .from('vendas_boloes')
                .insert({
                    bolao_id: bolaoId,
                    sessao_caixa_id: sessao?.id || null,
                    usuario_id: user.id,
                    loja_id: lojaId,
                    quantidade_cotas: qtd,
                    valor_total: valorTotal,
                    metodo_pagamento: metodo,
                    status_prestacao: 'pendente',
                    // se tiver comprovante, podemos guardar em algum lugar? Não há campo na tabela, então talvez criar uma coluna ou usar caixa_movimentacoes.
                    // Por enquanto, não salvamos na venda, mas na movimentação se houver sessão.
                })
                .select('id')
                .single();

            if (errVenda) throw new Error(`Erro ao registrar venda: ${errVenda.message}`);
            vendaId = venda.id;

            // 6. Alocar cotas (marcar como vendidas)
            // Primeiro, obter as primeiras 'qtd' cotas disponíveis
            const { data: cotas, error: errCotasSelect } = await supabase
                .from('cotas_boloes')
                .select('id')
                .eq('bolao_id', bolaoId)
                .eq('status', 'disponivel')
                .limit(qtd);

            if (errCotasSelect) throw new Error('Erro ao buscar cotas disponíveis');
            if (!cotas || cotas.length < qtd) {
                throw new Error('Quantidade de cotas disponíveis insuficiente');
            }

            const cotaIds = cotas.map(c => c.id);
            const { error: errCotasUpdate } = await supabase
                .from('cotas_boloes')
                .update({
                    status: 'vendida',
                    data_venda: new Date().toISOString(),
                    venda_id: vendaId // vincular à venda
                })
                .in('id', cotaIds);

            if (errCotasUpdate) throw new Error('Erro ao marcar cotas como vendidas');

            // 7. Atualizar cotas_vendidas no bolão de forma atômica
            const { error: errIncrement } = await supabase.rpc('increment_cotas_vendidas', {
                row_id: bolaoId,
                qtd: qtd
            });

            if (errIncrement) {
                // Fallback: tentar update direto (menos seguro)
                const { data: bolaoAtual } = await supabase
                    .from('boloes')
                    .select('cotas_vendidas')
                    .eq('id', bolaoId)
                    .single();

                if (bolaoAtual) {
                    const { error: errUpdateBolao } = await supabase
                        .from('boloes')
                        .update({ cotas_vendidas: bolaoAtual.cotas_vendidas + qtd })
                        .eq('id', bolaoId);

                    if (errUpdateBolao) throw new Error('Erro ao atualizar estoque do bolão');
                } else {
                    throw new Error('Bolão não encontrado para atualizar estoque');
                }
            }

            // 8. Se for PIX e houver sessão de caixa, registrar movimentação
            if (metodo === 'pix' && sessao?.id) {
                const movInsert: any = {
                    sessao_id: sessao.id,
                    tipo: 'pix',
                    valor: valorTotal,
                    metodo_pagamento: 'pix',
                    descricao: `Venda Bolão #${bolaoId} (${qtd} cotas)`,
                    classificacao_pix: 'bolao',
                    referencia_id: vendaId.toString(), // armazenar ID da venda como referência
                };

                if (uploadedUrl) {
                    movInsert.comprovante_url = uploadedUrl;
                }

                const { error: errMov } = await supabase
                    .from('caixa_movimentacoes')
                    .insert(movInsert);

                if (!errMov) {
                    // Atualizar saldo calculado da sessão
                    const novoSaldo = (sessao.valor_final_calculado || 0) + valorTotal;
                    await supabase
                        .from('caixa_sessoes')
                        .update({ valor_final_calculado: novoSaldo })
                        .eq('id', sessao.id);
                } else {
                    console.warn('Movimentação de caixa não registrada, mas venda concluída:', errMov);
                }
            }

            return true;

        } catch (error: any) {
            // Tentar reverter alterações parciais se possível
            // Isso é complexo; o ideal seria usar uma transação no banco.
            // Por simplicidade, apenas logamos e lançamos o erro.
            console.error('Erro na venda:', error);

            // Se houve upload de comprovante, podemos tentar remover (opcional)
            if (uploadedUrl) {
                // extrair path da URL e deletar
                // ...
            }

            throw new Error(error.message || 'Falha ao processar venda');
        } finally {
            setLoading(false);
        }
    };

    return {
        venderCota,
        loading
    };
}
