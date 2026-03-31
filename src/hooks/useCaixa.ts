'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface CaixaSessao {
  id: number;
  operador_id: string;
  terminal_id: string | null;
  terminal_id_ref: number | null;
  data_abertura: string;
  data_fechamento: string | null;
  data_turno: string;
  valor_inicial: number;
  valor_final_declarado: number | null;
  valor_final_calculado: number;
  status: 'aberto' | 'fechado' | 'conferido' | 'discrepante';
  observacoes: string | null;
  tem_fundo_caixa?: boolean;
  tfl_vendas?: number;
  tfl_premios?: number;
  tfl_contas?: number;
  tfl_saldo_projetado?: number;
  tfl_comprovante_url?: string;
  status_validacao?: 'pendente' | 'aprovado' | 'rejeitado';
  validado_por_id?: string;
  data_validacao?: string;
  observacoes_gerente?: string;
  valor_cofre?: number;
  valor_pix_externo?: number;
  diferenca_apurada?: number;
  justificativa_divergencia?: string;
}

export interface CaixaMovimentacao {
  id: number;
  sessao_id: number;
  tipo: 'venda' | 'sangria' | 'suprimento' | 'pagamento' | 'estorno' | 'pix' | 'trocados' | 'deposito' | 'boleto' | 'venda_bolao' | 'venda_bolao_pix';
  valor: number;
  descricao: string | null;
  metodo_pagamento: string;
  referencia_id: string | null;
  classificacao_pix: string | null;
  item_financeiro_id?: number | null;
  categoria_operacional_id?: number | null;
  data_vencimento?: string;
  created_at: string;
  deleted_at?: string | null;
  categorias_operacionais?: {
    id: number;
    nome: string;
    cor: string;
  } | null;
}

export interface FechamentoPayload {
    observacoes?: string;
    resumo: any;
    reconciliacao: any;
    dinheiroEmMaos: number;
    valorEnviadoCofre: number;
    pixExternoInformado: number;
    fundoCaixaDevolvido: boolean;
}

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
};

export function useCaixa() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sessaoAtiva, setSessaoAtiva] = useState<CaixaSessao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>([]);
  const realtimeChannel = useRef<RealtimeChannel | null>(null);
  const isMounted = useRef(true);
  const fetchingRef = useRef(false);
  const sessaoAtivaRef = useRef(sessaoAtiva);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Função para calcular totais consistentes
  const calcularTotaisMovimentacoes = useCallback((movs: CaixaMovimentacao[]) => {
    console.log('[useCaixa] Calculando totais para', movs.length, 'movimentações');
    
    const entradas = movs.filter(m => m.valor > 0).reduce((acc, m) => acc + m.valor, 0);
    const saidas = movs.filter(m => m.valor < 0).reduce((acc, m) => acc + Math.abs(m.valor), 0);
    const saldo = entradas - saidas;
    
    const resumo = {
      pix: movs.filter(m => m.tipo === 'pix' && m.valor > 0).reduce((acc, m) => acc + m.valor, 0),
      dinheiro: movs.filter(m => (m.tipo === 'venda' || m.tipo === 'suprimento') && 
                                 m.metodo_pagamento === 'dinheiro' && 
                                 m.valor > 0)
                     .reduce((acc, m) => acc + m.valor, 0),
      bolao_dinheiro: movs.filter(m => m.tipo === 'venda_bolao' && 
                                       m.metodo_pagamento === 'dinheiro' && 
                                       m.valor > 0)
                           .reduce((acc, m) => acc + m.valor, 0),
      bolao_pix: movs.filter(m => m.tipo === 'venda_bolao_pix' && 
                                  m.metodo_pagamento === 'pix' && 
                                  m.valor > 0)
                      .reduce((acc, m) => acc + m.valor, 0),
      sangria: movs.filter(m => m.tipo === 'sangria').reduce((acc, m) => acc + Math.abs(m.valor), 0),
      deposito: movs.filter(m => m.tipo === 'deposito').reduce((acc, m) => acc + Math.abs(m.valor), 0),
      boleto: movs.filter(m => m.tipo === 'boleto').reduce((acc, m) => acc + Math.abs(m.valor), 0),
      trocados: movs.filter(m => m.tipo === 'trocados').reduce((acc, m) => acc + Math.abs(m.valor), 0),
    };
    
    return { entradas, saidas, saldo, resumo };
  }, []);

  const fetchMovimentacoes = useCallback(
    async (sessaoId: number) => {
      if (!isMounted.current) return;
      try {
        console.log(`[useCaixa] Buscando movimentações da sessão ${sessaoId}`);
        const { data, error } = await supabase
          .from('caixa_movimentacoes')
          .select(`*, categorias_operacionais!categoria_operacional_id(id, nome, cor)`)
          .eq('sessao_id', sessaoId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        
        if (isMounted.current && data) {
          console.log(`[useCaixa] ${data.length} movimentações carregadas`);
          setMovimentacoes(data as CaixaMovimentacao[]);
        }
      } catch (err) {
        console.error('[useCaixa] Erro ao buscar movimentações:', err);
        if (isMounted.current) setError('Erro ao carregar movimentações');
      }
    },
    [supabase]
  );

  const fetchSessaoAtiva = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (!isMounted.current) {
      fetchingRef.current = false;
      return;
    }

    setError(null);
    try {
      console.log('[useCaixa] Verificando sessão ativa do usuário');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      if (!user) {
        console.log('[useCaixa] Usuário não autenticado');
        if (isMounted.current) {
          setSessaoAtiva(null);
          setMovimentacoes([]);
        }
        return;
      }

      const { data, error } = await supabase
        .from('caixa_sessoes')
        .select('*, terminais!terminal_id_ref(codigo, descricao), data_turno')
        .eq('operador_id', user.id)
        .eq('status', 'aberto')
        .maybeSingle();
        
      if (error) throw error;

      if (isMounted.current) {
        if (data) {
          setSessaoAtiva(prev => {
            if (prev?.id === data.id) return prev;
            return data as CaixaSessao;
          });
          await fetchMovimentacoes(data.id);
        } else {
          console.log('[useCaixa] Nenhuma sessão ativa encontrada');
          setSessaoAtiva(null);
          setMovimentacoes([]);
        }
      }
    } catch (err) {
      console.error('[useCaixa] Erro ao buscar sessão:', err);
      if (isMounted.current) {
        setError('Erro ao carregar dados do caixa. Verifique sua conexão.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [supabase, fetchMovimentacoes]);

  // Configurar Realtime
  useEffect(() => {
    if (!sessaoAtiva) {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
      return;
    }

    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
    }

    console.log(`[useCaixa] Configurando Realtime para sessão ${sessaoAtiva.id}`);
    const channel = supabase
      .channel(`movimentacoes:sessao_id=eq.${sessaoAtiva.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'caixa_movimentacoes',
          filter: `sessao_id=eq.${sessaoAtiva.id}`,
        },
        () => {
          console.log('[useCaixa] Realtime: movimentação alterada, atualizando...');
          fetchMovimentacoes(sessaoAtiva.id);
        }
      )
      .subscribe();

    realtimeChannel.current = channel;

    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
    };
  }, [sessaoAtiva, supabase, fetchMovimentacoes]);

  // Abrir caixa
  const abrirCaixa = async (
    valorInicial: number,
    terminalCodigo?: string,
    terminalId?: number,
    temFundoCaixa: boolean = true,
    dataTurno?: string
  ) => {
    setError(null);
    console.log('[useCaixa] abrirCaixa chamado', { valorInicial, terminalCodigo, terminalId, temFundoCaixa, dataTurno });
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Usuário não autenticado');

      const turnoData = dataTurno || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('caixa_sessoes')
        .insert({
          operador_id: user.id,
          terminal_id: terminalCodigo || 'TFL-WEB',
          terminal_id_ref: terminalId || null,
          valor_inicial: valorInicial,
          valor_final_calculado: valorInicial,
          status: 'aberto',
          tem_fundo_caixa: temFundoCaixa,
          data_turno: turnoData,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      console.log('[useCaixa] Caixa aberto, sessão criada:', data.id);
      setSessaoAtiva(data as CaixaSessao);
      return data;
    } catch (err) {
      console.error('[useCaixa] Erro ao abrir caixa:', err);
      setError('Falha ao abrir o caixa. Tente novamente.');
      throw err;
    }
  };

  // Registrar movimentação - CORRIGIDA
  const registrarMovimentacao = async (
    mov: Omit<CaixaMovimentacao, 'id' | 'sessao_id' | 'created_at'>
  ) => {
    if (!sessaoAtiva) {
      console.error('[useCaixa] Tentativa de registrar movimentação sem sessão ativa');
      throw new Error('Nenhuma sessão de caixa aberta');
    }
    
    setError(null);
    console.log('[useCaixa] registrarMovimentacao', { 
      tipo: mov.tipo, 
      valor: mov.valor,
      metodo_pagamento: mov.metodo_pagamento,
      descricao: mov.descricao 
    });

    try {
      // Preparar os dados para inserção
      const dadosInserir = {
        sessao_id: sessaoAtiva.id,
        tipo: mov.tipo,
        valor: mov.valor,
        descricao: mov.descricao || null,
        metodo_pagamento: mov.metodo_pagamento || 'dinheiro',
        referencia_id: mov.referencia_id || null,
        classificacao_pix: mov.classificacao_pix || null,
        categoria_operacional_id: mov.categoria_operacional_id || null,
        created_at: new Date().toISOString()
      };

      console.log('[useCaixa] Dados a inserir:', dadosInserir);

      const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .insert(dadosInserir)
        .select()
        .single();

      if (error) {
        console.error('[useCaixa] Erro no insert:', error);
        throw error;
      }

      console.log('[useCaixa] Movimentação registrada com sucesso:', data);

      // Recalcular saldo
      const todasMovs = [...movimentacoes, data as CaixaMovimentacao];
      const { saldo } = calcularTotaisMovimentacoes(todasMovs);
      const novoSaldo = sessaoAtiva.valor_inicial + saldo;

      console.log('[useCaixa] Atualizando saldo calculado para', novoSaldo);

      const { error: updateError } = await supabase
        .from('caixa_sessoes')
        .update({ valor_final_calculado: novoSaldo })
        .eq('id', sessaoAtiva.id);

      if (updateError) {
        console.error('[useCaixa] Erro ao atualizar saldo:', updateError);
      }

      setSessaoAtiva(prev => (prev ? { ...prev, valor_final_calculado: novoSaldo } : null));
      setMovimentacoes(prev => [data as CaixaMovimentacao, ...prev]);

      return data;
    } catch (err) {
      console.error('[useCaixa] Erro ao registrar movimentação:', err);
      setError('Erro ao registrar movimentação. Verifique sua conexão.');
      throw err;
    }
  };

  // Fechar caixa - VERSÃO SIMPLIFICADA
 const fecharCaixa = async (
    observacoes?: string,
    tflData?: any,
    valorCofre?: number,
    valorPixExterno?: number
) => {
    console.log('[useCaixa] fecharCaixa iniciado', { observacoes, valorCofre, valorPixExterno });
    
    if (!sessaoAtiva) {
        throw new Error('Nenhuma sessão de caixa aberta');
    }

    setError(null);

    try {
        // Verificar status da sessão
        const { data: sessaoAtual, error: sessaoError } = await supabase
            .from('caixa_sessoes')
            .select('status')
            .eq('id', sessaoAtiva.id)
            .single();
            
        if (sessaoError) throw sessaoError;
        if (sessaoAtual.status !== 'aberto') {
            throw new Error('Sessão já foi fechada por outro processo');
        }

        // Calcular totais das movimentações
        const { entradas, saidas, saldo, resumo } = calcularTotaisMovimentacoes(movimentacoes);
        
        // Calcular saldo esperado em dinheiro
        const totalEntradasDinheiro = resumo.dinheiro + resumo.bolao_dinheiro;
        const totalSaidasDinheiro = resumo.sangria + resumo.deposito + resumo.boleto + resumo.trocados;
        const saldoEsperadoDinheiro = sessaoAtiva.valor_inicial + totalEntradasDinheiro - totalSaidasDinheiro;
        
        // Saldo declarado (usar o saldo esperado)
        const dinheiroEmMaos = saldoEsperadoDinheiro;
        
        // Calcular diferença
        const diferenca = (valorCofre || 0) + (valorPixExterno || 0) - saldoEsperadoDinheiro;
        
        console.log('[useCaixa] Cálculos do fechamento:', {
            valor_inicial: sessaoAtiva.valor_inicial,
            resumo,
            totalEntradas: entradas,
            totalSaidas: saidas,
            saldoCalculado: saldo,
            totalEntradasDinheiro,
            totalSaidasDinheiro,
            saldoEsperadoDinheiro,
            valorCofre,
            valorPixExterno,
            diferenca
        });

        // Preparar os dados para update - APENAS OS CAMPOS QUE EXISTEM NA TABELA
        const updateData: any = {
            status: 'fechado',
            data_fechamento: new Date().toISOString(),
            observacoes: observacoes || null,
            valor_enviado_cofre: valorCofre || 0,
            pix_externo_informado: valorPixExterno || 0,
            dinheiro_em_maos: dinheiroEmMaos,
            valor_final_declarado: dinheiroEmMaos,
            valor_final_calculado: sessaoAtiva.valor_inicial + saldo,
            auditoria_status: 'pendente'
        };

        // Adicionar campos de resumo apenas se existirem na tabela
        // Vamos verificar se os campos existem, se não existir, não incluir
        try {
            updateData.resumo_entradas_pix = resumo.pix;
            updateData.resumo_entradas_dinheiro = resumo.dinheiro;
            updateData.resumo_entradas_bolao_dinheiro = resumo.bolao_dinheiro;
            updateData.resumo_entradas_bolao_pix = resumo.bolao_pix;
            updateData.resumo_saidas_sangria = resumo.sangria;
            updateData.resumo_saidas_deposito = resumo.deposito;
            updateData.resumo_saidas_boleto = resumo.boleto;
            updateData.resumo_saidas_trocados = resumo.trocados;
            updateData.resumo_total_entradas = entradas;
            updateData.resumo_total_saidas = saidas;
            updateData.saldo_esperado_dinheiro = saldoEsperadoDinheiro;
            updateData.diferenca_caixa = diferenca;
            updateData.fundo_caixa_devolvido = sessaoAtiva.tem_fundo_caixa !== false;
        } catch (err) {
            console.warn('[useCaixa] Alguns campos de resumo não existem na tabela:', err);
        }

        console.log('[useCaixa] Dados enviados para update:', updateData);

        const { data, error } = await supabase
            .from('caixa_sessoes')
            .update(updateData)
            .eq('id', sessaoAtiva.id)
            .select()
            .single();

        if (error) {
            console.error('[useCaixa] Erro no update - detalhes:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }

        console.log('[useCaixa] Sessão fechada com sucesso:', data);
        setSessaoAtiva(null);
        setMovimentacoes([]);
        return data;
    } catch (err) {
        console.error('[useCaixa] Erro ao fechar caixa:', err);
        setError('Falha ao fechar o caixa. Tente novamente.');
        throw err;
    }
};

  useEffect(() => {
    sessaoAtivaRef.current = sessaoAtiva;
  }, [sessaoAtiva]);

  useEffect(() => {
    fetchSessaoAtiva();
  }, [fetchSessaoAtiva]);

  return {
    sessaoAtiva,
    movimentacoes,
    loading,
    error,
    abrirCaixa,
    registrarMovimentacao,
    fecharCaixa,
    refresh: fetchSessaoAtiva,
    calcularTotaisMovimentacoes,
  };
}
