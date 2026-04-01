'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Tipos ───
export interface ContaBancaria {
    id: string;
    nome: string;
    tipo: string;
    banco_id: number;
    banco: string;
    banco_codigo?: string;
    agencia: string;
    conta_numero: string;
    is_padrao_pix: boolean;
    loja_id: string;
    saldo_inicial: number;
    saldo_atual: number;
}

export interface MovimentacaoCofre {
    id: number;
    tipo: string;
    valor: number;
    data_movimentacao: string;
    observacoes: string;
    operador_id: string;
    operador_nome?: string;
    conta_bancaria_id?: string;
    conta_nome?: string;
}

// ─── Buscar contas bancárias ───
export async function getContasBancarias(lojaId?: string): Promise<ContaBancaria[]> {
    const supabase = await createClient();
    
    try {
        let query = supabase
            .from('financeiro_contas_bancarias')
            .select(`
                id,
                nome,
                tipo,
                banco_id,
                agencia,
                conta_numero,
                is_padrao_pix,
                loja_id,
                saldo_inicial,
                saldo_atual
            `)
            .order('nome', { ascending: true });
        
        if (lojaId) {
            query = query.eq('loja_id', lojaId);
        }
        
        const { data: contas, error } = await query;
        
        if (error) {
            console.error('[getContasBancarias] Erro na consulta:', error);
            return [];
        }
        
        if (!contas || contas.length === 0) {
            return [];
        }
        
        // Buscar dados dos bancos separadamente
        const bancosIds = [...new Set(contas.map(c => c.banco_id).filter(id => id))];
        
        let bancosMap = new Map();
        if (bancosIds.length > 0) {
            const { data: bancos, error: bancosError } = await supabase
                .from('financeiro_bancos')
                .select('id, nome, codigo')
                .in('id', bancosIds);
            
            if (!bancosError && bancos) {
                bancos.forEach((banco: any) => {
                    bancosMap.set(banco.id, banco);
                });
            }
        }
        
        // Mapear resultado
        const resultado: ContaBancaria[] = contas.map((conta: any) => {
            const banco = bancosMap.get(conta.banco_id);
            return {
                id: conta.id,
                nome: conta.nome,
                tipo: conta.tipo,
                banco_id: conta.banco_id,
                banco: banco?.nome || 'Banco não informado',
                banco_codigo: banco?.codigo,
                agencia: conta.agencia || '',
                conta_numero: conta.conta_numero || '',
                is_padrao_pix: conta.is_padrao_pix || false,
                loja_id: conta.loja_id,
                saldo_inicial: conta.saldo_inicial || 0,
                saldo_atual: conta.saldo_atual || 0
            };
        });
        
        return resultado;
    } catch (err) {
        console.error('[getContasBancarias] Erro inesperado:', err);
        return [];
    }
}

// ─── Buscar saldo do cofre ───
export async function getSaldoCofre(contaBancariaId?: string): Promise<number> {
    const supabase = await createClient();
    
    try {
        let query = supabase
            .from('cofre_movimentacoes')
            .select('tipo, valor')
            .eq('status', 'concluido');
        
        if (contaBancariaId) {
            query = query.eq('conta_bancaria_id', contaBancariaId);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('[getSaldoCofre] Erro:', error);
            return 0;
        }
        
        if (!data || data.length === 0) return 0;
        
        const saldo = data.reduce((acc, mov) => {
            if (mov.tipo === 'entrada_fechamento' || mov.tipo === 'ajuste_entrada') {
                return acc + (mov.valor || 0);
            } else if (mov.tipo === 'saida_deposito' || mov.tipo === 'ajuste_saida') {
                return acc - (mov.valor || 0);
            }
            return acc;
        }, 0);
        
        return saldo;
    } catch (err) {
        console.error('[getSaldoCofre] Erro inesperado:', err);
        return 0;
    }
}

// ─── Buscar histórico do cofre ───
export async function getHistoricoCofre(
    limite: number = 30, 
    contaBancariaId?: string
): Promise<MovimentacaoCofre[]> {
    const supabase = await createClient();
    
    try {
        let query = supabase
            .from('cofre_movimentacoes')
            .select(`
                id,
                tipo,
                valor,
                data_movimentacao,
                observacoes,
                operador_id,
                conta_bancaria_id
            `)
            .order('data_movimentacao', { ascending: false })
            .limit(limite);
        
        if (contaBancariaId) {
            query = query.eq('conta_bancaria_id', contaBancariaId);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('[getHistoricoCofre] Erro na consulta:', error);
            return [];
        }
        
        if (!data || data.length === 0) {
            return [];
        }
        
        // Buscar nomes dos operadores e contas em paralelo
        const operadoresIds = [...new Set(data.map(m => m.operador_id).filter(id => id))];
        const contasIds = [...new Set(data.map(m => m.conta_bancaria_id).filter(id => id))];

        const [usuariosResult, contasResult] = await Promise.all([
            operadoresIds.length > 0
                ? supabase.from('usuarios').select('id, nome').in('id', operadoresIds)
                : Promise.resolve({ data: null, error: null }),
            contasIds.length > 0
                ? supabase.from('financeiro_contas_bancarias').select('id, nome').in('id', contasIds)
                : Promise.resolve({ data: null, error: null })
        ]);

        const operadoresMap = new Map();
        if (!usuariosResult.error && usuariosResult.data) {
            usuariosResult.data.forEach((user: any) => {
                operadoresMap.set(user.id, user.nome);
            });
        }

        const contasMap = new Map();
        if (!contasResult.error && contasResult.data) {
            contasResult.data.forEach((conta: any) => {
                contasMap.set(conta.id, conta.nome);
            });
        }
        
        const resultado: MovimentacaoCofre[] = data.map((mov: any) => ({
            id: mov.id,
            tipo: mov.tipo,
            valor: mov.valor || 0,
            data_movimentacao: mov.data_movimentacao,
            observacoes: mov.observacoes || '',
            operador_id: mov.operador_id,
            operador_nome: operadoresMap.get(mov.operador_id) || 'Sistema',
            conta_bancaria_id: mov.conta_bancaria_id,
            conta_nome: contasMap.get(mov.conta_bancaria_id) || 'Não informada'
        }));
        
        return resultado;
    } catch (err) {
        console.error('[getHistoricoCofre] Erro inesperado:', err);
        return [];
    }
}

// ─── Buscar depósitos pendentes ───
export async function getDepositosPendentes(contaBancariaId?: string) {
    const supabase = await createClient();
    
    try {
        let query = supabase
            .from('cofre_movimentacoes')
            .select(`
                id,
                valor,
                data_movimentacao,
                observacoes,
                conta_bancaria_id,
                loja_id
            `)
            .eq('tipo', 'saida_deposito')
            .eq('status', 'concluido')
            .order('data_movimentacao', { ascending: false });
        
        if (contaBancariaId) {
            query = query.eq('conta_bancaria_id', contaBancariaId);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('[getDepositosPendentes] Erro na consulta:', error);
            return [];
        }
        
        return data || [];
    } catch (err) {
        console.error('[getDepositosPendentes] Erro inesperado:', err);
        return [];
    }
}

// ─── Registrar depósito do cofre ───
export async function registrarDepositoCofre(
    valor: number,
    contaBancariaId: string,
    dataDeposito: string,
    observacoes?: string
) {
    const supabase = await createClient();
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            throw new Error('Não autenticado');
        }
        
        if (valor <= 0) {
            throw new Error('Valor deve ser positivo');
        }
        
        if (!contaBancariaId) {
            throw new Error('Conta bancária não informada');
        }
        
        const { data, error } = await supabase
            .from('cofre_movimentacoes')
            .insert({
                tipo: 'saida_deposito',
                valor: valor,
                data_movimentacao: dataDeposito,
                operador_id: user.id,
                observacoes: observacoes || `Depósito bancário de R$ ${valor.toFixed(2)}`,
                conta_bancaria_id: contaBancariaId,
                status: 'concluido'
            })
            .select()
            .single();
        
        if (error) {
            console.error('[registrarDepositoCofre] Erro no insert:', error);
            throw new Error(`Erro ao registrar depósito: ${error.message}`);
        }
        
        revalidatePath('/cofre');

        return { success: true, data };
    } catch (err: any) {
        console.error('[registrarDepositoCofre] Erro:', err);
        return { success: false, error: err.message };
    }
}

// ─── Registrar entrada no cofre (fechamento) ───
export async function registrarEntradaCofre(
    valor: number,
    sessaoId: number,
    observacoes?: string
) {
    const supabase = await createClient();
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            throw new Error('Não autenticado');
        }
        
        if (valor <= 0) {
            throw new Error('Valor deve ser positivo');
        }
        
        const { data, error } = await supabase
            .from('cofre_movimentacoes')
            .insert({
                tipo: 'entrada_fechamento',
                valor: valor,
                data_movimentacao: new Date().toISOString(),
                operador_id: user.id,
                origem_sessao_id: sessaoId,
                observacoes: observacoes || `Entrada referente ao fechamento da sessão ${sessaoId}`,
                status: 'concluido'
            })
            .select()
            .single();
        
        if (error) {
            console.error('[registrarEntradaCofre] Erro no insert:', error);
            throw new Error(`Erro ao registrar entrada: ${error.message}`);
        }
        
        // Atualizar a sessão de caixa
        await supabase
            .from('caixa_sessoes')
            .update({
                cofre_movimentacao_id: data.id,
                cofre_confirmado: true
            })
            .eq('id', sessaoId);
        
        revalidatePath('/cofre');

        return { success: true, data };
    } catch (err: any) {
        console.error('[registrarEntradaCofre] Erro:', err);
        return { success: false, error: err.message };
    }
}
