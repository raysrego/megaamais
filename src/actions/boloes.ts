'use server';

import { createClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { Bolao, BolaoRow } from '@/types/bolao';

/**
 * Gera um UID único para a cota incorporando bolaoId + índice sequencial.
 * Formato: B{bolaoId}-{índice}-{random4} (ex: B11-01-A7K2)
 * Isso garante unicidade global já que bolaoId+índice nunca repetem.
 */
function generateCotaUid(bolaoId: number, index: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const suffix = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `B${bolaoId}-${String(index + 1).padStart(2, '0')}-${suffix}`;
}

export async function getProdutos(lojaId?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('produtos')
        .select(`
            *,
            loja_produtos!inner (
                ativo,
                config
            )
        `)
        .eq('ativo', true)
        .eq('loja_produtos.ativo', true)
        .order('nome', { ascending: true });

    if (lojaId) {
        query = query.eq('loja_produtos.loja_id', lojaId);
    }

    const { data: dataComJoin, error: errorJoin } = await query;

    // Fallback: Se não tiver lojaId ou a query com join falhar (tabela não existe ainda em prod?), tenta query simples
    // Isso evita quebrar o app enquanto a migration não roda
    if (errorJoin) {
        console.warn('Erro ao buscar produtos com filtro de loja (tabela nova?), tentando fallback global:', errorJoin.message);
        const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true });

        if (error) {
            console.error('Error fetching produtos (fallback):', error);
            return [];
        }

        return (data || []).map(item => mapProduto(item));
    }

    return (dataComJoin || []).map(item => mapProduto(item));
}

function mapProduto(item: any) {
    return {
        id: item.id,
        nome: item.nome,
        slug: item.slug,
        cor: item.cor,
        corDestaque: item.cor_destaque,
        icone: item.icone,
        diasSorteio: item.dias_sorteio,
        minDezenas: item.min_dezenas,
        maxDezenas: item.max_dezenas,
        horarioFechamento: item.horario_fechamento,
        ativo: item.ativo,
        // Novos campos 2.0
        categoriaId: item.categoria_id,
        gerenciaEstoque: item.gerencia_estoque,
        precoPadrao: Number(item.preco_padrao || 0)
    };
}

export async function getBoloes(options?: { produtoId?: number, lojaId?: string | null, limit?: number, includeFinalizados?: boolean }) {
    const supabase = await createClient();
    let query = supabase
        .from('boloes')
        .select(`
            id,
            produto_id,
            loja_id,
            concurso,
            data_sorteio,
            qtd_jogos,
            dezenas,
            valor_cota_base,
            taxa_administrativa,
            qtd_cotas,
            preco_venda_cota,
            cotas_vendidas,
            status,
            created_at,
            produtos (
                nome,
                cor,
                slug
            )
        `)
        .order('created_at', { ascending: false });

    if (options?.produtoId) {
        query = query.eq('produto_id', options.produtoId);
    }

    if (options?.lojaId) {
        query = query.eq('loja_id', options.lojaId);
    }

    if (options?.includeFinalizados === false) {
        query = query.eq('status', 'disponivel');
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    } else {
        query = query.limit(50); // Limite padrão saudável para performance
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching boloes:', error);
        return [];
    }

    return (data as any[]).map(item => ({
        id: item.id,
        produtoId: item.produto_id,
        concurso: item.concurso,
        dataSorteio: item.data_sorteio,
        qtdJogos: item.qtd_jogos,
        dezenas: item.dezenas,
        valorCotaBase: Number(item.valor_cota_base),
        taxaAdministrativa: Number(item.taxa_administrativa),
        qtdCotas: item.qtd_cotas,
        precoVendaCota: Number(item.preco_venda_cota),
        cotasVendidas: item.cotas_vendidas,
        status: item.status,
        createdAt: item.created_at,
        // Dados estendidos do join
        jogo: item.produtos?.nome,
        cor: item.produtos?.cor,
        slug: item.produtos?.slug
    }));
}

export async function createBolao(bolao: Bolao & { lojaId: string }) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boloes')
        .insert([{
            produto_id: bolao.produtoId,
            loja_id: bolao.lojaId,
            concurso: bolao.concurso,
            data_sorteio: bolao.dataSorteio,
            qtd_jogos: bolao.qtdJogos,
            dezenas: bolao.dezenas,
            valor_cota_base: bolao.valorCotaBase,
            taxa_administrativa: bolao.taxaAdministrativa,
            qtd_cotas: bolao.qtdCotas,
            preco_venda_cota: bolao.precoVendaCota,
            cotas_vendidas: bolao.cotasVendidas,
            status: bolao.status
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating bolao:', error);
        return { success: false, error: `Falha ao criar bolão: ${error.message} (Code: ${error.code})` };
    }

    const newBolao = data;

    // GERAR COTAS INDIVIDUAIS (UID agora inclui bolaoId para unicidade garantida)
    const cotasToInsert = Array.from({ length: bolao.qtdCotas }, (_, i) => ({
        bolao_id: newBolao.id,
        uid: generateCotaUid(newBolao.id, i),
        status: 'disponivel'
    }));

    const { error: errCotas } = await supabase
        .from('cotas_boloes')
        .insert(cotasToInsert);

    if (errCotas) {
        console.error('Error creating individual cotas:', errCotas);
        // ROLLBACK: Deletar o bolão órfão para não deixar registro sem cotas
        await supabase.from('boloes').delete().eq('id', newBolao.id);
        return { success: false, error: `Falha ao criar cotas individuais: ${errCotas.message} (Code: ${errCotas.code})` };
    }

    return { success: true, data: newBolao };
}

/**
 * Busca um bolão específico com todos os detalhes necessários para venda
 * Otimizado para evitar N+1 queries no frontend
 */
export async function getBolaoById(id: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boloes')
        .select(`
            *,
            produtos (
                nome,
                cor,
                slug,
                icone,
                horario_fechamento
            ),
            cotas_boloes (
                id,
                uid,
                status,
                data_venda
            )
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching bolao detail:', error);
        return null;
    }

    return {
        ...data,
        id: data.id,
        precoVendaCota: Number(data.preco_venda_cota),
        valorCotaBase: Number(data.valor_cota_base),
        taxaAdministrativa: Number(data.taxa_administrativa),
        cotas: data.cotas_boloes.map((c: any) => ({
            id: c.id,
            uid: c.uid,
            status: c.status,
            dataVenda: c.data_venda,
            valorVenda: Number(data.preco_venda_cota)
        }))
    };
}

export async function getCotasBolao(bolaoId: number) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('cotas_boloes')
            .select('id, uid, bolao_id, status, data_venda')
            .eq('bolao_id', bolaoId)
            .order('id', { ascending: true });

        if (error) {
            return { data: [] as any[], error: `Supabase: ${error.message} (Code: ${error.code})` };
        }

        if (!data || data.length === 0) {
            return { data: [] as any[], error: null };
        }

        const mapped = data.map(item => ({
            id: item.id,
            uid: item.uid || '',
            bolaoId: item.bolao_id,
            status: item.status || 'disponivel',
            dataVenda: item.data_venda,
            valorVenda: 0
        }));

        return { data: mapped, error: null };
    } catch (e: any) {
        return { data: [] as any[], error: `Exception: ${String(e?.message || e)}` };
    }
}


export async function updateBolaoCotas(id: number, cotasVendidas: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boloes')
        .update({ cotas_vendidas: cotasVendidas })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating bolao cotas:', error);
        throw error;
    }

    return data;
}
export async function updateBolao(id: number, data: any) {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
        .from('boloes')
        .update({
            concurso: data.concurso,
            data_sorteio: data.dataSorteio,
            qtd_jogos: data.qtdJogos,
            dezenas: data.dezenas,
            valor_cota_base: data.valorCotaBase,
            taxa_administrativa: data.taxaAdministrativa,
            qtd_cotas: data.qtdCotas,
            preco_venda_cota: data.precoVendaCota,
            status: data.status
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating bolao:', error);
        throw error;
    }

    return updated;
}

export async function deleteBolao(id: number) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('boloes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting bolao:', error);
        throw error;
    }

    return true;
}

export async function getBoloesVencidos() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boloes')
        .select(`
            *,
            produtos (
                nome,
                cor,
                slug,
                horario_fechamento
            )
        `)
        .eq('status', 'disponivel')
        .lt('data_sorteio', new Date().toISOString().split('T')[0]);

    if (error) {
        console.error('Error fetching vencidos:', error);
        return [];
    }

    return (data || []).map(item => ({
        id: item.id,
        produtoId: item.produto_id,
        concurso: item.concurso,
        dataSorteio: item.data_sorteio,
        precoVendaCota: Number(item.preco_venda_cota),
        qtdCotas: item.qtd_cotas,
        cotasVendidas: item.cotas_vendidas,
        status: item.status,
        jogo: item.produtos?.nome
    }));
}

/**
 * ATUALIZADA - Processa encalhe usando RPC atômica
 * Garante consistência transacional completa
 */
export async function processarEncalheBolao(bolaoId: number) {
    const supabase = await createClient();

    try {
        // Chamar a função RPC atômica
        const { data, error } = await supabase.rpc('processar_encalhe_bolao', {
            p_bolao_id: bolaoId
        });

        if (error) {
            console.error('Erro ao processar encalhe:', error);
            throw new Error(error.message);
        }

        return {
            success: data.success,
            already_processed: data.already_processed || false,
            encalhe: data.encalhe || 0,
            valorDespesa: data.valor_despesa || 0
        };

    } catch (err: any) {
        console.error('Erro inesperado ao processar encalhe:', err);
        return {
            success: false,
            error: err.message || 'Erro ao processar encalhe'
        };
    }
}

/**
 * NOVA FUNÇÃO - Registrar venda de bolão usando RPC atômica
 * Esta função substitui o fluxo anterior que não era transacional
 */
export async function registrarVendaBolao(params: {
    bolaoId: number;
    sessaoCaixaId: number;
    quantidadeCotas: number;
    valorTotal: number;
    metodoPagamento: 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito';
}) {
    const supabase = await createClient();

    // Obter o usuário atual (vendedor)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Usuário não autenticado' };
    }

    try {
        // Chamar a função RPC atômica
        const { data, error } = await supabase.rpc('registrar_venda_bolao', {
            p_bolao_id: params.bolaoId,
            p_sessao_caixa_id: params.sessaoCaixaId,
            p_usuario_id: user.id,
            p_quantidade_cotas: params.quantidadeCotas,
            p_valor_total: params.valorTotal,
            p_metodo_pagamento: params.metodoPagamento
        });

        if (error) {
            console.error('Erro ao registrar venda de bolão:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/(dashboard)/boloes');
        return { success: true, vendaId: data };

    } catch (err: any) {
        console.error('Erro inesperado ao registrar venda:', err);
        return { success: false, error: err.message || 'Erro inesperado' };
    }
}

/**
 * ATUALIZADA - Busca auditoria completa (vendas + encalhes)
 * Usa a view unificada vw_auditoria_completa
 */
export async function getAuditoriaCompleta(lojaId?: string) {
    const supabase = await createClient();
    let query = supabase
        .from('vw_auditoria_completa')
        .select('*');

    if (lojaId) {
        query = query.eq('loja_id', lojaId);
    }

    const { data, error } = await query.order('data_registro', { ascending: false });

    if (error) {
        console.error('Error fetching complete audit:', error);
        return [];
    }

    return (data || []).map(item => ({
        tipo: item.tipo_registro as 'venda' | 'encalhe',
        id: item.registro_id,
        dataRegistro: item.data_registro,
        responsavel: item.responsavel,
        loteria: item.loteria,
        loteriaCor: item.loteria_cor,
        concurso: item.concurso,
        dataSorteio: item.data_sorteio,
        quantidadeCotas: item.quantidade_cotas,
        valorTotal: Number(item.valor_total),
        valorUnitario: Number(item.valor_unitario),
        metodoPagamento: item.metodo_pagamento,
        filial: item.filial,
        statusFinal: item.status_final
    }));
}

// Manter compatibilidade com código existente
export async function getVendasAuditoria() {
    const todas = await getAuditoriaCompleta();
    // Retornar apenas vendas para não quebrar código legado
    return todas.filter(item => item.tipo === 'venda').map(item => ({
        id: item.id,
        dataVenda: item.dataRegistro,
        vendedor: item.responsavel,
        loteria: item.loteria,
        concurso: item.concurso,
        quantidadeCotas: item.quantidadeCotas,
        valorTotal: item.valorTotal,
        metodoPagamento: item.metodoPagamento,
        filial: item.filial
    }));
}

export async function getPrestacaoContasOperadores(lojaId?: string) {
    const supabase = await createClient();
    let query = supabase
        .from('vw_prestacao_contas_operadores')
        .select('*');

    if (lojaId) {
        query = query.eq('loja_id', lojaId);
    }

    const { data, error } = await query.order('operador_nome', { ascending: true });

    if (error) {
        console.error('Error fetching operator settlement:', error);
        return [];
    }

    return (data || []).map(item => ({
        operadorId: item.operador_id,
        operadorNome: item.operador_nome,
        filial: item.filial,
        totalEspecie: Number(item.total_especie),
        totalPix: Number(item.total_pix),
        totalCartao: Number(item.total_cartao),
        totalGeral: Number(item.total_geral),
        qtdVendas: item.qtd_vendas,
        ultimaVenda: item.ultima_venda
    }));
}

export async function liquidarOperador(operadorId: string, valorEspecie: number, valorPix: number) {
    const supabase = await createClient();

    // 1. Obter o usuário atual (Master/Gerente que está liquidando)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autorizado');

    // 2. Obter o perfil do Master para saber a loja
    const { data: perfilMaster } = await supabase
        .from('perfis')
        .select('loja_id')
        .eq('id', user.id)
        .single();

    // 3. Chamar a função RPC transacional que criamos na migration
    const { error } = await supabase.rpc('confirmar_liquidacao_operador', {
        p_operador_id: operadorId,
        p_master_id: user.id,
        p_loja_id: perfilMaster?.loja_id,
        p_valor_especie: valorEspecie,
        p_valor_pix: valorPix
    });

    if (error) {
        console.error('Erro ao liquidar operador:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/(dashboard)/boloes');
    return { success: true };
}

/**
 * NOVA - Busca resumo do caixa do Master (dinheiro coletado hoje)
 * Consulta cofre_movimentacoes para saber quanto o usuário atual recebeu dos operadores
 */
export async function getResumoCaixaMaster() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { totalColetado: 0, qtdLiquidacoes: 0 };
    }

    // Buscar movimentações de hoje onde o usuário atual foi o operador (quem fez a sangria)
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('cofre_movimentacoes')
        .select('valor')
        .eq('operador_id', user.id)
        .eq('tipo', 'entrada_sangria')
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');

    if (error) {
        console.error('Erro ao buscar resumo do Master:', error);
        return { totalColetado: 0, qtdLiquidacoes: 0 };
    }

    const totalColetado = (data || []).reduce((acc, curr) => acc + Number(curr.valor), 0);
    const qtdLiquidacoes = (data || []).length;

    return { totalColetado, qtdLiquidacoes };
}
