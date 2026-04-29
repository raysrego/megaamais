'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

// ============================================================
// UTILITÁRIOS
// ============================================================

function generateCotaUid(bolaoId: number, index: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const suffix = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `B${bolaoId}-${String(index + 1).padStart(2, '0')}-${suffix}`;
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
        categoriaId: item.categoria_id,
        gerenciaEstoque: item.gerencia_estoque,
        precoPadrao: Number(item.preco_padrao || 0)
    };
}

// ============================================================
// PERMISSÕES
// ============================================================

async function verificarPerfilPermitido(rolesPermitidas: string[]): Promise<{ user: any; perfil: any }> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Não autenticado');

    const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('role, loja_id')
        .eq('id', user.id)
        .single();

    if (perfilError || !perfil) throw new Error('Perfil não encontrado');
    if (!rolesPermitidas.includes(perfil.role)) throw new Error('Permissão negada');
    return { user, perfil };
}

// ============================================================
// PRODUTOS
// ============================================================

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

    if (lojaId) query = query.eq('loja_produtos.loja_id', lojaId);
    const { data: dataComJoin, error: errorJoin } = await query;

    if (errorJoin) {
        console.warn('Fallback para produtos:', errorJoin.message);
        const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true });
        if (error) return [];
        return (data || []).map(mapProduto);
    }
    return (dataComJoin || []).map(mapProduto);
}

// ============================================================
// BOLÕES
// ============================================================

// app/actions/boloes.ts (parte da função getBoloes)

export async function getBoloes(options?: { produtoId?: number; lojaId?: string | null; limit?: number; includeFinalizados?: boolean }) {
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

    if (options?.produtoId) query = query.eq('produto_id', options.produtoId);
    if (options?.lojaId) query = query.eq('loja_id', options.lojaId);
    if (options?.includeFinalizados === false) query = query.eq('status', 'disponivel');
    query = query.limit(options?.limit || 50);

    const { data, error } = await query;
    if (error) return [];
    return (data as any[]).map(item => ({
        id: item.id,
        produtoId: item.produto_id,
        concurso: item.concurso,
        dataSorteio: item.data_sorteio,
        qtdJogos: item.qtd_jogos,
        dezenas: item.dezenas,               // ← ESSENCIAL
        valorCotaBase: Number(item.valor_cota_base),
        taxaAdministrativa: Number(item.taxa_administrativa),
        qtdCotas: item.qtd_cotas,
        precoVendaCota: Number(item.preco_venda_cota),
        cotasVendidas: item.cotas_vendidas,
        status: item.status,
        createdAt: item.created_at,
        jogo: item.produtos?.nome,
        cor: item.produtos?.cor,
        slug: item.produtos?.slug
    }));
}

export async function createBolao(bolao: Bolao & { lojaId: string }) {
    const supabase = await createClient();

    // Removida a verificação de duplicidade para permitir múltiplos bolões com o mesmo concurso
    // (inclusive mesmo produto e loja)

    const { data, error } = await supabase
        .from('boloes')
        .insert({
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
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating bolao:', error);
        return { success: false, error: `Falha ao criar bolão: ${error.message}` };
    }

    const newBolao = data;

    // Gerar cotas individuais
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
        await supabase.from('boloes').delete().eq('id', newBolao.id);
        return { success: false, error: `Falha ao criar cotas: ${errCotas.message}` };
    }

    return { success: true, data: newBolao };
}

export async function getBolaoById(id: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boloes')
        .select(`
            *,
            produtos ( nome, cor, slug, icone, horario_fechamento ),
            cotas_boloes ( id, uid, status, data_venda )
        `)
        .eq('id', id)
        .single();
    if (error) return null;
    return {
        ...data,
        precoVendaCota: Number(data.preco_venda_cota),
        valorCotaBase: Number(data.valor_cota_base),
        taxaAdministrativa: Number(data.taxa_administrativa),
        cotas: data.cotas_boloes.map((c: any) => ({ ...c, valorVenda: Number(data.preco_venda_cota) }))
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
        if (error) return { data: [], error: error.message };
        return { data: data.map(c => ({ ...c, valorVenda: 0 })), error: null };
    } catch (e: any) {
        return { data: [], error: e.message };
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
    if (error) throw error;
    return data;
}

export async function updateBolao(id: number, data: any) {
    const supabase = await createClient();
    const { data: bolaoAtual, error: fetchError } = await supabase
        .from('boloes')
        .select('cotas_vendidas')
        .eq('id', id)
        .single();
    if (fetchError) throw fetchError;

    if (bolaoAtual.cotas_vendidas > 0) {
        const { data: updated, error } = await supabase
            .from('boloes')
            .update({ status: data.status })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return updated;
    }

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
    if (error) throw error;
    return updated;
}

export async function deleteBolao(id: number) {
    const supabase = await createClient();
    const { data: bolao, error: fetchError } = await supabase
        .from('boloes')
        .select('cotas_vendidas')
        .eq('id', id)
        .single();
    if (fetchError) throw fetchError;
    if (bolao.cotas_vendidas > 0) throw new Error('Não é possível excluir um bolão com vendas.');
    const { error } = await supabase.from('boloes').delete().eq('id', id);
    if (error) throw error;
    return true;
}

// ============================================================
// ENCALHE
// ============================================================

export async function getBoloesVencidos() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boloes')
        .select('*, produtos(nome, cor, slug, horario_fechamento)')
        .eq('status', 'disponivel')
        .lt('data_sorteio', new Date().toISOString().split('T')[0]);
    if (error) return [];
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

export async function processarEncalheBolao(bolaoId: number) {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase.rpc('processar_encalhe_bolao', { p_bolao_id: bolaoId });
        if (error) throw new Error(error.message);
        return {
            success: data.success,
            already_processed: data.already_processed || false,
            encalhe: data.encalhe || 0,
            valorDespesa: data.valor_despesa || 0
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ============================================================
// VENDAS COM SESSÃO BOLÃO
// ============================================================

export async function registrarVendaBolao(params: {
    bolaoId: number;
    sessaoBolaoId?: number | null;   // agora aceita null ou undefined
    quantidadeCotas: number;
    valorTotal: number;
    metodoPagamento: 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito';
    comprovanteUrl?: string | null;
    cotaId?: number | null;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Usuário não autenticado' };

    try {
        // Envia null se não houver sessão
        const { data, error } = await supabase.rpc('vender_cotas_bolao', {
            p_bolao_id: params.bolaoId,
            p_sessao_bolao_id: params.sessaoBolaoId ?? null,  // converte undefined/null para null
            p_usuario_id: user.id,
            p_quantidade: params.quantidadeCotas,
            p_valor_total: params.valorTotal,
            p_metodo_pagamento: params.metodoPagamento,
            p_comprovante_url: params.comprovanteUrl || null,
            p_cota_id: params.cotaId || null
        });
        if (error) throw new Error(error.message);
        revalidatePath('/(dashboard)/boloes');
        return { success: true, vendaId: data.venda_id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ============================================================
// AUDITORIA
// ============================================================

export async function getAuditoriaCompleta(lojaId?: string) {
    const supabase = await createClient();
    let query = supabase.from('vw_auditoria_completa').select('*');
    if (lojaId) query = query.eq('loja_id', lojaId);
    const { data, error } = await query.order('data_registro', { ascending: false });
    if (error) return [];
    return (data || []).map(item => ({
        tipo: item.tipo_registro,
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

// ============================================================
// PRESTAÇÃO DE CONTAS E LIQUIDAÇÃO
// ============================================================

export async function getPrestacaoContasOperadores(lojaId?: string) {
    const supabase = await createClient();
    try {
        await verificarPerfilPermitido(['gerente', 'admin']);
    } catch {
        return [];
    }
    let query = supabase.from('vw_prestacao_contas_operadores').select('*');
    if (lojaId) query = query.eq('loja_id', lojaId);
    const { data, error } = await query.order('operador_nome', { ascending: true });
    if (error) return [];
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
    let user, perfil;
    try {
        const result = await verificarPerfilPermitido(['gerente', 'admin']);
        user = result.user;
        perfil = result.perfil;
    } catch (err: any) {
        return { success: false, error: err.message };
    }

    const { error } = await supabase.rpc('confirmar_liquidacao_operador', {
        p_operador_id: operadorId,
        p_master_id: user.id,
        p_loja_id: perfil.loja_id,
        p_valor_especie: valorEspecie,
        p_valor_pix: valorPix
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/(dashboard)/financeiro');
    return { success: true };
}

export async function getResumoCaixaMaster() {
    const supabase = await createClient();
    let user;
    try {
        const result = await verificarPerfilPermitido(['gerente', 'admin']);
        user = result.user;
    } catch {
        return { totalColetado: 0, qtdLiquidacoes: 0 };
    }
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('cofre_movimentacoes')
        .select('valor')
        .eq('operador_id', user.id)
        .eq('tipo', 'entrada_sangria')
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');
    if (error) return { totalColetado: 0, qtdLiquidacoes: 0 };
    const totalColetado = (data || []).reduce((acc, curr) => acc + Number(curr.valor), 0);
    return { totalColetado, qtdLiquidacoes: (data || []).length };
}
