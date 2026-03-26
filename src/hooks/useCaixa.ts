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
  tipo: 'venda' | 'sangria' | 'suprimento' | 'pagamento' | 'estorno' | 'pix' | 'trocados' | 'deposito' | 'boleto';
  valor: number;
  descricao: string | null;
  metodo_pagamento: string;
  referencia_id: string | null;
  classificacao_pix: string | null;
  item_financeiro_id?: number | null;
  categoria_operacional_id?: number | null;
  created_at: string;
  deleted_at?: string | null;
  categorias_operacionais?: {
    id: number;
    nome: string;
    cor: string;
  } | null;
}

/**
 * Helper para executar uma função assíncrona com retry automático.
 * A função deve lançar erro para que a tentativa seja considerada falha.
 */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // backoff exponencial
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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Busca movimentações de uma sessão
  const fetchMovimentacoes = useCallback(
    async (sessaoId: number) => {
      if (!isMounted.current) return;
      try {
        console.log(`[useCaixa] Buscando movimentações da sessão ${sessaoId}`);
        const data = await withRetry(async () => {
          const result = await supabase
            .from('caixa_movimentacoes')
            .select(`*, categorias_operacionais!categoria_operacional_id(id, nome, cor)`)
            .eq('sessao_id', sessaoId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100);
          if (result.error) throw result.error;
          return result.data;
        });
        if (isMounted.current) {
          console.log(`[useCaixa] ${data?.length || 0} movimentações carregadas`);
          setMovimentacoes(data || []);
        }
      } catch (err) {
        console.error('[useCaixa] Erro ao buscar movimentações:', err);
        if (isMounted.current) setError('Erro ao carregar movimentações');
      }
    },
    [supabase]
  );

  // Busca sessão ativa do usuário
  const fetchSessaoAtiva = useCallback(async () => {
    if (!isMounted.current) return;
    setError(null);
    try {
      console.log('[useCaixa] Verificando sessão ativa do usuário');
      const { data: { user }, error: userError } = await withRetry(async () => {
        const result = await supabase.auth.getUser();
        if (result.error) throw result.error;
        return result.data;
      });
      if (userError) throw userError;
      if (!user) {
        console.log('[useCaixa] Usuário não autenticado');
        if (isMounted.current) {
          setSessaoAtiva(null);
          setLoading(false);
        }
        return;
      }

      const data = await withRetry(async () => {
        const result = await supabase
          .from('caixa_sessoes')
          .select('*, terminais!terminal_id_ref(codigo, descricao), data_turno')
          .eq('operador_id', user.id)
          .eq('status', 'aberto')
          .maybeSingle();
        if (result.error) throw result.error;
        return result.data;
      });

      if (isMounted.current) {
        if (data) {
          console.log('[useCaixa] Sessão ativa encontrada:', data.id);
          setSessaoAtiva(data);
          await fetchMovimentacoes(data.id);
        } else {
          console.log('[useCaixa] Nenhuma sessão ativa encontrada');
          setSessaoAtiva(null);
          setMovimentacoes([]);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('[useCaixa] Erro ao buscar sessão:', err);
      if (isMounted.current) {
        setError('Erro ao carregar dados do caixa. Verifique sua conexão.');
        setLoading(false);
      }
    } finally {
      if (isMounted.current && !sessaoAtiva) {
        setLoading(false);
      }
    }
  }, [supabase, fetchMovimentacoes, sessaoAtiva]);

  // Configurar Realtime com tratamento de erro e reconexão
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
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useCaixa] Realtime conectado');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useCaixa] Erro no canal Realtime:', err);
          setError('Erro na conexão em tempo real. Tentando reconectar...');
          // Tenta reconectar após 5 segundos
          setTimeout(() => {
            if (realtimeChannel.current && sessaoAtiva) {
              console.log('[useCaixa] Tentando reconectar canal Realtime');
              supabase.removeChannel(realtimeChannel.current);
              realtimeChannel.current = supabase.channel(`movimentacoes:reconnect-${Date.now()}`);
              realtimeChannel.current.subscribe();
            }
          }, 5000);
        }
      });

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
      const { data: user } = await withRetry(async () => {
        const result = await supabase.auth.getUser();
        if (result.error) throw result.error;
        return result.data;
      });
      if (!user) throw new Error('Usuário não autenticado');

      const turnoData = dataTurno || new Date().toISOString().split('T')[0];

      const data = await withRetry(async () => {
        const result = await supabase
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
        if (result.error) throw result.error;
        return result.data;
      });
      console.log('[useCaixa] Caixa aberto, sessão criada:', data.id);
      setSessaoAtiva(data);
      return data;
    } catch (err) {
      console.error('[useCaixa] Erro ao abrir caixa:', err);
      setError('Falha ao abrir o caixa. Tente novamente.');
      throw err;
    }
  };

  // Registrar movimentação
  const registrarMovimentacao = async (
    mov: Omit<CaixaMovimentacao, 'id' | 'sessao_id' | 'created_at'>
  ) => {
    if (!sessaoAtiva) throw new Error('Nenhuma sessão de caixa aberta');
    setError(null);
    console.log('[useCaixa] registrarMovimentacao', { tipo: mov.tipo, valor: mov.valor });

    try {
      const data = await withRetry(async () => {
        const result = await supabase
          .from('caixa_movimentacoes')
          .insert({
            sessao_id: sessaoAtiva.id,
            ...mov,
          })
          .select()
          .single();
        if (result.error) throw result.error;
        return result.data;
      });

      let delta = mov.valor;
      if (mov.tipo === 'trocados') {
        delta = 0;
      }

      const novoSaldo = (sessaoAtiva.valor_final_calculado || 0) + delta;
      console.log('[useCaixa] Atualizando saldo calculado para', novoSaldo);

      await withRetry(async () => {
        const result = await supabase
          .from('caixa_sessoes')
          .update({ valor_final_calculado: novoSaldo })
          .eq('id', sessaoAtiva.id);
        if (result.error) throw result.error;
        return result.data;
      });

      setSessaoAtiva(prev => (prev ? { ...prev, valor_final_calculado: novoSaldo } : null));
      setMovimentacoes(prev => [data, ...prev]);

      return data;
    } catch (err) {
      console.error('[useCaixa] Erro ao registrar movimentação:', err);
      setError('Erro ao registrar movimentação. Verifique sua conexão.');
      throw err;
    }
  };

  // Fechar caixa
  const fecharCaixa = async (
    observacoes?: string,
    tflData?: {
      tfl_vendas?: number;
      tfl_premios?: number;
      tfl_contas?: number;
      tfl_saldo_projetado?: number;
      tfl_comprovante_url?: string;
    },
    valorCofre?: number,
    valorPixExterno?: number
  ) => {
    console.log('[useCaixa] fecharCaixa iniciado', { observacoes, tflData, valorCofre, valorPixExterno });
    if (!sessaoAtiva) {
      console.error('[useCaixa] Erro: sessão ativa é nula');
      throw new Error('Nenhuma sessão de caixa aberta');
    }

    setError(null);

    try {
      // Verificar status da sessão
      const sessaoAtual = await withRetry(async () => {
        const result = await supabase
          .from('caixa_sessoes')
          .select('status')
          .eq('id', sessaoAtiva.id)
          .single();
        if (result.error) throw result.error;
        return result.data;
      });
      if (sessaoAtual.status !== 'aberto') {
        throw new Error('Sessão já foi fechada por outro processo');
      }

      // Registrar sangria para o valor do cofre
      if (valorCofre && valorCofre > 0) {
        try {
          console.log('[useCaixa] Registrando sangria de R$', valorCofre);
          await registrarMovimentacao({
            tipo: 'sangria',
            valor: -Math.abs(valorCofre),
            descricao: 'Sangria para cofre',
            metodo_pagamento: 'dinheiro',
            referencia_id: null,
            classificacao_pix: null,
            categoria_operacional_id: null,
          });
          console.log('[useCaixa] Sangria registrada com sucesso');
        } catch (error) {
          console.error('[useCaixa] Erro ao registrar sangria:', error);
          throw new Error('Falha ao registrar sangria: ' + (error as Error).message);
        }
      }

      const valorDeclarado = sessaoAtiva.valor_final_calculado;
      const updateData = {
        valor_final_declarado: valorDeclarado,
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        observacoes: observacoes,
        ...(tflData || {}),
        valor_cofre: valorCofre || 0,
        valor_pix_externo: valorPixExterno || 0,
      };

      console.log('[useCaixa] Enviando update para Supabase:', updateData);

      const data = await withRetry(async () => {
        const result = await supabase
          .from('caixa_sessoes')
          .update(updateData)
          .eq('id', sessaoAtiva.id)
          .select()
          .single();
        if (result.error) throw result.error;
        return result.data;
      });

      console.log('[useCaixa] Sessão fechada com sucesso, dados retornados:', data);
      setSessaoAtiva(null);
      setMovimentacoes([]);
      return data;
    } catch (err) {
      console.error('[useCaixa] Erro ao fechar caixa:', err);
      setError('Falha ao fechar o caixa. Tente novamente.');
      throw err;
    }
  };

  // Carregar dados iniciais
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
  };
}
