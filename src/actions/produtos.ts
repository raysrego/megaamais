'use server';

import { createClient } from '@/lib/supabase';
import { Jogo, CategoriaProduto } from '@/types/produto';

// --- CATEGORIAS ---

export async function getCategorias() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('categorias_produtos')
        .select('*')
        .eq('ativo', true)
        .order('id');

    if (error) {
        console.error('Error fetching categorias:', error);
        return [];
    }

    return data as CategoriaProduto[];
}

export async function createCategoria(cat: CategoriaProduto) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('categorias_produtos')
        .insert([{ nome: cat.nome, icone: cat.icone, cor: cat.cor }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateCategoria(id: number, cat: CategoriaProduto) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('categorias_produtos')
        .update({ nome: cat.nome, icone: cat.icone, cor: cat.cor })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteCategoria(id: number) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('categorias_produtos')
        .update({ ativo: false })
        .eq('id', id);

    if (error) throw error;
    return true;
}

// --- PRODUTOS ---

export async function getProdutos(lojaId?: string, categoriaId?: number) {
    const supabase = await createClient();

    let query = supabase
        .from('produtos')
        .select(`
            *,
            loja_produtos!inner (
                ativo,
                config,
                saldo_estoque
            )
        `)
        .eq('ativo', true)
        .eq('loja_produtos.ativo', true)
        .order('nome', { ascending: true });

    if (lojaId) {
        query = query.eq('loja_produtos.loja_id', lojaId);
    }

    if (categoriaId) {
        query = query.eq('categoria_id', categoriaId);
    }

    const { data, error } = await query;

    if (error) {
        console.warn('Erro ao buscar produtos com join completo, tentando fallback:', error.message);

        // Fallback simplificado
        let simpleQuery = supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('nome');

        if (categoriaId) simpleQuery = simpleQuery.eq('categoria_id', categoriaId);

        const { data: simpleData } = await simpleQuery;
        return (simpleData || []).map(mapProduto);
    }

    return (data || []).map(mapProduto);
}

export async function getProdutosAdmin(categoriaId?: number) {
    const supabase = await createClient();
    let query = supabase
        .from('produtos')
        .select('*')
        .order('nome');

    // Se categoria não for passada ou nula, traz tudo? 
    // O ideal é filtrar se for passado.
    if (categoriaId) {
        query = query.eq('categoria_id', categoriaId);
    }

    const { data, error } = await query;
    if (error) return [];

    return (data || []).map(mapProduto);
}

export async function toggleProdutoLoja(lojaId: string, produtoId: number, ativo: boolean) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('loja_produtos')
        .upsert({
            loja_id: lojaId,
            produto_id: produtoId,
            ativo: ativo,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'loja_id, produto_id'
        })
        .select()
        .single();

    if (error) {
        console.error('Error toggling produto loja:', error);
        throw error;
    }
    return data;
}


function mapProduto(item: any): Jogo {
    return {
        id: item.id,
        nome: item.nome,
        slug: item.slug,
        cor: item.cor,
        corDestaque: item.cor_destaque,
        icone: item.icone,
        diasSorteio: item.dias_sorteio || [],
        minDezenas: item.min_dezenas || 0,
        maxDezenas: item.max_dezenas || 0,
        horarioFechamento: item.horario_fechamento,
        ativo: item.ativo,
        categoriaId: item.categoria_id,
        gerenciaEstoque: item.gerencia_estoque,
        precoPadrao: Number(item.preco_padrao || 0)
    };
}

export async function createProduto(produto: Jogo) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('produtos')
        .insert([{
            nome: produto.nome,
            slug: produto.slug,
            cor: produto.cor,
            cor_destaque: produto.corDestaque,
            icone: produto.icone,
            dias_sorteio: produto.diasSorteio,
            min_dezenas: produto.minDezenas,
            max_dezenas: produto.maxDezenas,
            horario_fechamento: produto.horarioFechamento,
            ativo: produto.ativo,
            categoria_id: produto.categoriaId,
            gerencia_estoque: produto.gerenciaEstoque,
            preco_padrao: produto.precoPadrao
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateProduto(id: number, produto: Jogo) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('produtos')
        .update({
            nome: produto.nome,
            slug: produto.slug,
            cor: produto.cor,
            cor_destaque: produto.corDestaque,
            icone: produto.icone,
            dias_sorteio: produto.diasSorteio,
            min_dezenas: produto.minDezenas,
            max_dezenas: produto.maxDezenas,
            horario_fechamento: produto.horarioFechamento,
            ativo: produto.ativo,
            categoria_id: produto.categoriaId,
            gerencia_estoque: produto.gerenciaEstoque,
            preco_padrao: produto.precoPadrao
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteProduto(id: number) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return true;
}
