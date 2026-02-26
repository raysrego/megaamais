'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export function useVendasBolao() {
    const supabase = createBrowserSupabaseClient();
    const [loading, setLoading] = useState(false);

    /**
     * Gera um nome único para arquivo usando crypto.randomUUID()
     * Fallback para timestamp caso o método não esteja disponível.
     */
    const generateUniqueFileName = (originalName: string) => {
        const ext = originalName.split('.').pop();
        const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).substring(2);
        return `comprovantes/${uniqueId}.${ext}`;
    };

    /**
     * Faz upload do comprovante (se existir) para o storage do Supabase.
     * Retorna a URL pública ou null.
     */
    const uploadComprovante = async (file: File | null): Promise<string | null> => {
        if (!file) return null;

        const fileName = generateUniqueFileName(file.name);
        const { error: uploadError } = await supabase.storage
            .from('comprovantes') // Nome do bucket – ajuste conforme seu projeto
            .upload(fileName, file);

        if (uploadError) {
            console.error('Erro ao fazer upload do comprovante:', uploadError);
            throw new Error('Falha ao enviar comprovante.');
        }

        const { data: urlData } = supabase.storage
            .from('comprovantes')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    };

    /**
     * Obtém a loja do usuário logado (campo loja_id no perfil).
     * Idealmente você pode armazenar esse dado em um contexto para evitar repetição.
     */
    const getUserLojaId = async (userId: string): Promise<string | null> => {
        const { data, error } = await supabase
            .from('usuarios')
            .select('loja_id')
            .eq('id', userId)
            .maybeSingle();

        if (error || !data) {
            console.warn('Não foi possível obter loja_id do usuário:', error);
            return null;
        }
        return data.loja_id;
    };

    /**
     * Realiza a venda de uma ou mais cotas.
     * @param bolaoId ID do bolão
     * @param quantidade Número de cotas
     * @param valorTotal Valor total da venda
     * @param metodo 'dinheiro' | 'pix'
     * @param comprovante Arquivo opcional (obrigatório apenas se for Pix e a regra de negócio exigir)
     */
    const venderCota = async (
        bolaoId: number,
        quantidade: number,
        valorTotal: number,
        metodo: 'dinheiro' | 'pix',
        comprovante?: File | null
    ) => {
        setLoading(true);
        try {
            // 1. Verificar usuário autenticado
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // 2. Obter loja_id do usuário
            const lojaId = await getUserLojaId(user.id);
            if (!lojaId) throw new Error('Usuário não vinculado a uma loja.');

            // 3. Verificar se há sessão de caixa aberta (opcional)
            const { data: sessao } = await supabase
                .from('caixa_sessoes')
                .select('id')
                .eq('operador_id', user.id)
                .eq('status', 'aberto')
                .maybeSingle();

            // 4. Fazer upload do comprovante, se fornecido
            let comprovanteUrl: string | null = null;
            if (comprovante) {
                comprovanteUrl = await uploadComprovante(comprovante);
            }

            // 5. Chamar a função RPC (transação atômica)
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('vender_cotas_bolao', {
                    p_bolao_id: bolaoId,
                    p_quantidade: quantidade,
                    p_valor_total: valorTotal,
                    p_metodo_pagamento: metodo,
                    p_usuario_id: user.id,
                    p_loja_id: lojaId,
                    p_sessao_caixa_id: sessao?.id || null,
                    p_comprovante_url: comprovanteUrl
                });

            if (rpcError) throw new Error(`Erro na RPC: ${rpcError.message}`);
            if (!rpcResult.success) throw new Error(rpcResult.error || 'Falha na venda.');

            // Sucesso!
            return { success: true, vendaId: rpcResult.venda_id };

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
