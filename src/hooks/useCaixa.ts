'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ResumoFechamento, ReconciliacaoCaixa } from '@/lib/fechamento-utils';

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

export interface FechamentoPayload {
    observacoes?: string;
    resumo: ResumoFechamento;
    reconciliacao: ReconciliacaoCaixa;
    dinheiroEmMaos: number;
    valorEnviadoCofre: number;
    pixExternoInformado: number;
    fundoCaixaDevolvido: boolean;
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
  const fetchingRef = useRef(false);
  const sessaoAtivaRef = useRef(sessaoAtiva);

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
      const userData = await withRetry(async () => {
        const result = await supabase.auth.getUser();
        if (result.error) throw result.error;
        return result.data;
      });
      const user = userData.user;
      if (!user) {
        console.log('[useCaixa] Usuário não autenticado');
        if (isMounted.current) {
          setSessaoAtiva(null);
          setMovimentacoes([]);
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
          setSessaoAtiva(prev => {
            if (prev?.id === data.id) return prev;
            return data;
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
      const userData = await withRetry(async () => {
        const result = await supabase.auth.getUser();
        if (result.error) throw result.error;
        return result.data;
      });
      const user = userData.user;
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

  const fecharCaixaV2 = useCallback(async (payload: FechamentoPayload) => {
    if (!sessaoAtivaRef.current) {
      setError('Nenhuma sessão ativa');
      return;
    }
    setLoading(true);
    try {
      const { resumo, reconciliacao, dinheiroEmMaos, valorEnviadoCofre,
          pixExternoInformado, fundoCaixaDevolvido, observacoes } = payload;

      console.log('[useCaixa] fecharCaixaV2 - Payload recebido:', {
        dinheiroEmMaos,
        valorEnviadoCofre,
        pixExternoInformado,
        fundoCaixaDevolvido,
        resumo,
        reconciliacao
      });

      const updateData = {
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        valor_final_declarado: dinheiroEmMaos,
        resumo_entradas_pix: resumo.entradas_pix,
        resumo_entradas_dinheiro: resumo.entradas_dinheiro,
        resumo_entradas_bolao_dinheiro: resumo.entradas_bolao_dinheiro,
        resumo_entradas_bolao_pix: resumo.entradas_bolao_pix,
        resumo_saidas_sangria: resumo.saidas_sangria,
        resumo_saidas_deposito: resumo.saidas_deposito,
        resumo_saidas_boleto: resumo.saidas_boleto,
        resumo_saidas_trocados: resumo.saidas_trocados,
        resumo_total_entradas: resumo.total_entradas,
        resumo_total_saidas: resumo.total_saidas,
        dinheiro_em_maos: dinheiroEmMaos,
        valor_enviado_cofre: valorEnviadoCofre,
        pix_externo_informado: pixExternoInformado,
        fundo_caixa_devolvido: fundoCaixaDevolvido,
        saldo_esperado_dinheiro: reconciliacao.saldo_esperado_dinheiro,
        diferenca_caixa: reconciliacao.diferenca,
        auditoria_status: 'pendente',
        observacoes: observacoes || null,
      };

      console.log('[useCaixa] fecharCaixaV2 - Dados enviados para update:', updateData);

      const { data, error } = await supabase
        .from('caixa_sessoes')
        .update(updateData)
        .eq('id', sessaoAtivaRef.current.id)
        .select();

      if (error) {
        console.error('[useCaixa] fecharCaixaV2 - Erro no update:', error);
        throw error;
      }

      console.log('[useCaixa] fecharCaixaV2 - Resposta do Supabase:', data);
      console.log('[useCaixa] Turno encerrado! Enviado para auditoria.');
      setSessaoAtiva(null);
      setMovimentacoes([]);
    } catch (error: any) {
      console.error('[useCaixa] Erro ao fechar caixa:', error);
      setError(`Erro ao fechar caixa: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    sessaoAtivaRef.current = sessaoAtiva;
  }, [sessaoAtiva]);

  useEffect(() => {
    fetchSessaoAtiva();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sessaoAtiva,
    movimentacoes,
    loading,
    error,
    abrirCaixa,
    registrarMovimentacao,
    fecharCaixa,
    fecharCaixaV2,
    refresh: fetchSessaoAtiva,
  };
}
