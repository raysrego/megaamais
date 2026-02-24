'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export function useVendasBolao() {
    const supabase = createBrowserSupabaseClient();
    const [loading, setLoading] = useState(false);

    /**
     * Realiza a venda de uma cota de bolão.
     * 1. Verifica caixa aberto (para validar que o terminal está operando)
     * 2. Registra na tabela vendas_boloes
     * 3. Atualiza cotas_vendidas na tabela boloes
     */
    const venderCota = async (
        bolaoId: number,
        qtd: number,
        valorTotal: number,
        metodo: 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito',
        cotaId?: number
    ) => {
        setLoading(true);
        try {
            // 1. Verificar usuário e caixa aberto (Critical Check)
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Tentar identificar sessão aberta (Opcional, para vínculo se existir)
            const { data: sessao } = await supabase
                .from('caixa_sessoes')
                .select('id, valor_final_calculado')
                .eq('usuario_id', user.id)
                .eq('status', 'aberto')
                .maybeSingle();

            // NOTA: Não bloqueamos mais a venda se não houver caixa aberto.
            // O valor entra como "pendente de prestação de contas".

            // 2. Registrar Venda (Auditoria)
            const { error: errVenda } = await supabase
                .from('vendas_boloes')
                .insert({
                    bolao_id: bolaoId,
                    sessao_caixa_id: sessao?.id || null, // Pode ser nulo agora
                    usuario_id: user.id,
                    quantidade_cotas: qtd,
                    valor_total: valorTotal,
                    metodo_pagamento: metodo,
                    status_prestacao: 'pendente' // Padrão
                });

            if (errVenda) throw new Error(`Erro ao registrar venda: ${errVenda.message}`);

            // 3. Atualizar Estoque do Bolão
            const { error: errBolao } = await supabase.rpc('increment_cotas_vendidas', {
                row_id: bolaoId,
                qtd: qtd
            });

            if (errBolao) {
                const { data: bolaoAtual } = await supabase.from('boloes').select('cotas_vendidas').eq('id', bolaoId).single();
                if (bolaoAtual) {
                    await supabase
                        .from('boloes')
                        .update({ cotas_vendidas: bolaoAtual.cotas_vendidas + qtd })
                        .eq('id', bolaoId);
                }
            }

            // 3.1 Atualizar status das cotas individuais
            if (cotaId) {
                // Venda de uma cota específica
                const { error: errCotaStatus } = await supabase
                    .from('cotas_boloes')
                    .update({
                        status: 'vendida',
                        data_venda: new Date().toISOString()
                    })
                    .eq('id', cotaId);

                if (errCotaStatus) console.warn('Falha ao atualizar status da cota.', errCotaStatus);
            } else if (qtd > 0) {
                // Venda em lote: Pegar as primeiras 'qtd' disponíveis e marcar como vendidas
                const { data: cotasDisponiveis } = await supabase
                    .from('cotas_boloes')
                    .select('id')
                    .eq('bolao_id', bolaoId)
                    .eq('status', 'disponivel')
                    .limit(qtd);

                if (cotasDisponiveis && cotasDisponiveis.length > 0) {
                    const idsToUpdate = cotasDisponiveis.map(c => c.id);
                    await supabase
                        .from('cotas_boloes')
                        .update({
                            status: 'vendida',
                            data_venda: new Date().toISOString()
                        })
                        .in('id', idsToUpdate);
                }
            }

            // 4. Se for PIX, lança no fluxo do operador para conferência do Gerente
            // Se for DINHEIRO, NÃO lança (fica retido p/ prestação de contas com Admin Bolão)
            // 4. Se for PIX e houver sessão aberta, lança no fluxo do operador
            // Se não houver sessão, o controle é via Prestação de Contas (status_prestacao)
            if (metodo === 'pix' && sessao?.id) {
                const { error: errMov } = await supabase
                    .from('caixa_movimentacoes')
                    .insert({
                        sessao_id: sessao.id,
                        tipo: 'pix',
                        valor: valorTotal,
                        metodo_pagamento: 'pix',
                        descricao: `Venda Bolão #${bolaoId} (PIX)`,
                        classificacao_pix: 'bolao' // Tag para filtro na auditoria
                    });

                if (!errMov) {
                    // Atualiza o saldo calculado da sessão para o Pix bater no final
                    const novoSaldoCalculado = (sessao.valor_final_calculado || 0) + valorTotal;
                    await supabase
                        .from('caixa_sessoes')
                        .update({ valor_final_calculado: novoSaldoCalculado })
                        .eq('id', sessao.id);
                }
            }

            return true;

        } catch (error: any) {
            console.error('Erro na venda:', error);
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
