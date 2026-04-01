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

export function useCaixa() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sessaoAtiva, setSessaoAtiva] = useState<CaixaSessao | null>(null);
  const [loading, setLoading] = useState(true);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [error, setError] = useState<string | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>([]);
  const realtimeChannel = useRef<RealtimeChannel | null>(null);
  const isMounted = useRef(true);
  const fetchingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessaoAtivaRef = useRef(sessaoAtiva);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Função para calcular totais consistentes
  const calcularTotaisMovimentacoes = useCallback((movs: CaixaMovimentacao[]) => {
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      if (!user) {
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

  // Configurar Realtime com tratamento de erro e reconexão melhorado
  useEffect(() => {
    if (!sessaoAtiva) {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      return;
    }

    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
      realtimeChannel.current = null;
    }

    const setupChannel = () => {
      if (!isMounted.current || !sessaoAtiva) return;

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
            reconnectAttempts.current = 0;
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[useCaixa] Erro no canal Realtime:', err);

            if (reconnectAttempts.current >= maxReconnectAttempts) {
              console.error('[useCaixa] Máximo de tentativas de reconexão atingido');
              return;
            }

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectAttempts.current++;

            console.log(`[useCaixa] Tentando reconectar em ${backoffDelay}ms (tentativa ${reconnectAttempts.current}/${maxReconnectAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMounted.current && sessaoAtiva) {
                setupChannel();
              }
            }, backoffDelay);
          }
        });

      realtimeChannel.current = channel;
    };

    setupChannel();

    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Usuário não autenticado');

    // Buscar empresa_id do usuário
    const { data: userData, error: userDataError } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();
    if (userDataError || !userData?.empresa_id) {
      throw new Error('Usuário não possui filial vinculada');
    }

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
        loja_id: userData.empresa_id,   // <-- AGORA PREENCHIDO
      })
      .select()
      .single();

    if (error) throw error;

    setSessaoAtiva(data as CaixaSessao);
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
    if (!sessaoAtiva) {
      throw new Error('Nenhuma sessão de caixa aberta');
    }
    
    setError(null);

    try {
      const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .insert({
          sessao_id: sessaoAtiva.id,
          tipo: mov.tipo,
          valor: mov.valor,
          descricao: mov.descricao || null,
          metodo_pagamento: mov.metodo_pagamento || 'dinheiro',
          referencia_id: mov.referencia_id || null,
          classificacao_pix: mov.classificacao_pix || null,
          categoria_operacional_id: mov.categoria_operacional_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      const todasMovs = [...movimentacoes, data as CaixaMovimentacao];
      const { saldo } = calcularTotaisMovimentacoes(todasMovs);
      const novoSaldo = sessaoAtiva.valor_inicial + saldo;

      await supabase
        .from('caixa_sessoes')
        .update({ valor_final_calculado: novoSaldo })
        .eq('id', sessaoAtiva.id);

      setSessaoAtiva(prev => (prev ? { ...prev, valor_final_calculado: novoSaldo } : null));
      setMovimentacoes(prev => [data as CaixaMovimentacao, ...prev]);

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
  tflData?: any,
  valorCofre?: number,
  valorPixExterno?: number
) => {
  if (!sessaoAtiva) {
    throw new Error('Nenhuma sessão de caixa aberta');
  }

  setError(null);

  try {
    const { data: sessaoAtual, error: sessaoError } = await supabase
      .from('caixa_sessoes')
      .select('status')
      .eq('id', sessaoAtiva.id)
      .single();

    if (sessaoError) throw sessaoError;
    if (sessaoAtual.status !== 'aberto') {
      throw new Error('Sessão já foi fechada por outro processo');
    }

    const { entradas, saidas, saldo, resumo } = calcularTotaisMovimentacoes(movimentacoes);

    const totalEntradasDinheiro = resumo.dinheiro + resumo.bolao_dinheiro;
    const totalSaidasDinheiro = resumo.sangria + resumo.deposito + resumo.boleto + resumo.trocados;
    const saldoEsperadoDinheiro = sessaoAtiva.valor_inicial + totalEntradasDinheiro - totalSaidasDinheiro;

    // Calcula o dinheiro físico que deve permanecer no caixa após retirar o que foi para o cofre
    let dinheiroEmMaos = saldoEsperadoDinheiro - (valorCofre || 0) - (valorPixExterno || 0);
    if (dinheiroEmMaos < 0) {
      console.warn(`[fecharCaixa] Dinheiro em mãos negativo (${dinheiroEmMaos}). Ajustando para 0.`);
      dinheiroEmMaos = 0;
    }

    // Discrepância (pode ser negativa se o esperado for maior que o cofre + pix)
    const diferenca = (valorCofre || 0) + (valorPixExterno || 0) - saldoEsperadoDinheiro;

    const updateData = {
      status: 'fechado',
      data_fechamento: new Date().toISOString(),
      observacoes: observacoes || null,
      valor_enviado_cofre: valorCofre || 0,
      pix_externo_informado: valorPixExterno || 0,
      dinheiro_em_maos: dinheiroEmMaos,
      valor_final_declarado: dinheiroEmMaos,          // nunca negativo
      valor_final_calculado: sessaoAtiva.valor_inicial + saldo,
      resumo_entradas_pix: resumo.pix || 0,
      resumo_entradas_dinheiro: resumo.dinheiro || 0,
      resumo_entradas_bolao_dinheiro: resumo.bolao_dinheiro || 0,
      resumo_entradas_bolao_pix: resumo.bolao_pix || 0,
      resumo_saidas_sangria: resumo.sangria || 0,
      resumo_saidas_deposito: resumo.deposito || 0,
      resumo_saidas_boleto: resumo.boleto || 0,
      resumo_saidas_trocados: resumo.trocados || 0,
      resumo_total_entradas: entradas || 0,
      resumo_total_saidas: saidas || 0,
      saldo_esperado_dinheiro: saldoEsperadoDinheiro,
      diferenca_caixa: diferenca,
      fundo_caixa_devolvido: sessaoAtiva.tem_fundo_caixa !== false,
      auditoria_status: 'pendente'
    };

    const { data, error } = await supabase
      .from('caixa_sessoes')
      .update(updateData)
      .eq('id', sessaoAtiva.id)
      .select();

    if (error) throw error;

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
