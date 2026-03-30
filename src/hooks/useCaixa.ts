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

  // Função para calcular totais consistentes
 const calcularTotaisMovimentacoes = useCallback((movs: CaixaMovimentacao[]) => {
  console.log('[useCaixa] Calculando totais para', movs.length, 'movimentações');
  console.log('[useCaixa] Movimentações:', movs.map(m => ({ tipo: m.tipo, valor: m.valor, metodo: m.metodo_pagamento })));
  
  // Total de entradas (valores positivos)
  const entradas = movs.filter(m => m.valor > 0).reduce((acc, m) => acc + m.valor, 0);
  
  // Total de saídas (valores negativos)
  const saidas = movs.filter(m => m.valor < 0).reduce((acc, m) => acc + Math.abs(m.valor), 0);
  
  // Saldo final
  const saldo = entradas - saidas;
  
  // Resumo detalhado por tipo e método de pagamento
  const resumo = {
    // PIX: qualquer movimentação do tipo 'pix' com valor positivo
    pix: movs.filter(m => m.tipo === 'pix' && m.valor > 0).reduce((acc, m) => acc + m.valor, 0),
    
    // Dinheiro (jogos): movimentações do tipo 'venda' ou 'suprimento' com método dinheiro
    dinheiro: movs.filter(m => (m.tipo === 'venda' || m.tipo === 'suprimento') && 
                               m.metodo_pagamento === 'dinheiro' && 
                               m.valor > 0)
                   .reduce((acc, m) => acc + m.valor, 0),
    
    // Bolões (dinheiro): movimentações do tipo 'venda_bolao' com método dinheiro
    bolao_dinheiro: movs.filter(m => m.tipo === 'venda_bolao' && 
                                     m.metodo_pagamento === 'dinheiro' && 
                                     m.valor > 0)
                         .reduce((acc, m) => acc + m.valor, 0),
    
    // Bolões (PIX): movimentações do tipo 'venda_bolao' com método pix
    bolao_pix: movs.filter(m => m.tipo === 'venda_bolao' && 
                                m.metodo_pagamento === 'pix' && 
                                m.valor > 0)
                    .reduce((acc, m) => acc + m.valor, 0),
    
    // Sangrias: qualquer movimentação do tipo 'sangria'
    sangria: movs.filter(m => m.tipo === 'sangria').reduce((acc, m) => acc + Math.abs(m.valor), 0),
    
    // Depósitos: movimentações do tipo 'deposito'
    deposito: movs.filter(m => m.tipo === 'deposito').reduce((acc, m) => acc + Math.abs(m.valor), 0),
    
    // Boletos: movimentações do tipo 'boleto'
    boleto: movs.filter(m => m.tipo === 'boleto').reduce((acc, m) => acc + Math.abs(m.valor), 0),
    
    // Trocados: movimentações do tipo 'trocados'
    trocados: movs.filter(m => m.tipo === 'trocados').reduce((acc, m) => acc + Math.abs(m.valor), 0),
  };
  
  // Adicionar outras entradas que não se encaixam nas categorias acima
  const outrasEntradas = movs.filter(m => m.valor > 0 && 
                                         m.tipo !== 'pix' && 
                                         m.tipo !== 'venda' && 
                                         m.tipo !== 'suprimento' && 
                                         m.tipo !== 'venda_bolao')
                              .reduce((acc, m) => acc + m.valor, 0);
  
  if (outrasEntradas > 0) {
    console.log('[useCaixa] Outras entradas detectadas:', outrasEntradas);
    // Se houver outras entradas, podemos adicionar ao dinheiro ou criar uma categoria separada
    resumo.dinheiro += outrasEntradas;
  }
  
  console.log('[useCaixa] Totais calculados:', resumo);
  console.log('[useCaixa] Total entradas:', entradas);
  console.log('[useCaixa] Total saídas:', saidas);
  console.log('[useCaixa] Saldo:', saldo);
  
  return { entradas, saidas, saldo, resumo };
}, []);

  const fetchMovimentacoes = useCallback(
    async (sessaoId: number) => {
      if (!isMounted.current) return;
      try {
        console.log(`[useCaixa] Buscando movimentações da sessão ${sessaoId}`);
        const result = await withRetry(async () => {
          const response = await supabase
            .from('caixa_movimentacoes')
            .select(`*, categorias_operacionais!categoria_operacional_id(id, nome, cor)`)
            .eq('sessao_id', sessaoId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100);
          if (response.error) throw response.error;
          return response.data;
        });
        
        if (isMounted.current && result) {
          console.log(`[useCaixa] ${result.length} movimentações carregadas`);
          setMovimentacoes(result as CaixaMovimentacao[]);
          
          // Atualizar valor_final_calculado para garantir consistência
          const { saldo } = calcularTotaisMovimentacoes(result as CaixaMovimentacao[]);
          const valorFinalCalculado = (sessaoAtiva?.valor_inicial || 0) + saldo;
          
          // Se houver discrepância, atualizar no banco
          if (sessaoAtiva && Math.abs(sessaoAtiva.valor_final_calculado - valorFinalCalculado) > 0.01) {
            console.warn('[useCaixa] Discrepância detectada no saldo calculado, corrigindo...');
            const { error: updateError } = await supabase
              .from('caixa_sessoes')
              .update({ valor_final_calculado: valorFinalCalculado })
              .eq('id', sessaoAtiva.id);
            
            if (!updateError) {
              setSessaoAtiva(prev => prev ? { ...prev, valor_final_calculado: valorFinalCalculado } : null);
            }
          }
        }
      } catch (err) {
        console.error('[useCaixa] Erro ao buscar movimentações:', err);
        if (isMounted.current) setError('Erro ao carregar movimentações');
      }
    },
    [supabase, sessaoAtiva, calcularTotaisMovimentacoes]
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      if (!userData.user) {
        console.log('[useCaixa] Usuário não autenticado');
        if (isMounted.current) {
          setSessaoAtiva(null);
          setMovimentacoes([]);
        }
        return;
      }

      const result = await withRetry(async () => {
        const response = await supabase
          .from('caixa_sessoes')
          .select('*, terminais!terminal_id_ref(codigo, descricao), data_turno')
          .eq('operador_id', userData.user.id)
          .eq('status', 'aberto')
          .maybeSingle();
        if (response.error) throw response.error;
        return response.data;
      });

      if (isMounted.current) {
        if (result) {
          setSessaoAtiva(prev => {
            if (prev?.id === result.id) return prev;
            return result as CaixaSessao;
          });
          await fetchMovimentacoes(result.id);
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Usuário não autenticado');

      const turnoData = dataTurno || new Date().toISOString().split('T')[0];

      const result = await withRetry(async () => {
        const response = await supabase
          .from('caixa_sessoes')
          .insert({
            operador_id: userData.user.id,
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
        if (response.error) throw response.error;
        return response.data;
      });
      console.log('[useCaixa] Caixa aberto, sessão criada:', result.id);
      setSessaoAtiva(result as CaixaSessao);
      return result;
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
      // Validar data do turno para movimentações
      if (mov.data_vencimento && mov.data_vencimento !== sessaoAtiva.data_turno) {
        throw new Error(`Data do lançamento (${mov.data_vencimento}) não corresponde à data do turno (${sessaoAtiva.data_turno})`);
      }

      const result = await withRetry(async () => {
        const response = await supabase
          .from('caixa_movimentacoes')
          .insert({
            sessao_id: sessaoAtiva.id,
            ...mov,
          })
          .select()
          .single();
        if (response.error) throw response.error;
        return response.data;
      });

      // Recalcular saldo baseado nas movimentações atuais + nova
      const todasMovs = [...movimentacoes, result as CaixaMovimentacao];
      const { saldo } = calcularTotaisMovimentacoes(todasMovs);
      const novoSaldo = sessaoAtiva.valor_inicial + saldo;

      console.log('[useCaixa] Atualizando saldo calculado para', novoSaldo);

      await withRetry(async () => {
        const response = await supabase
          .from('caixa_sessoes')
          .update({ valor_final_calculado: novoSaldo })
          .eq('id', sessaoAtiva.id);
        if (response.error) throw response.error;
        return response.data;
      });

      setSessaoAtiva(prev => (prev ? { ...prev, valor_final_calculado: novoSaldo } : null));
      setMovimentacoes(prev => [result as CaixaMovimentacao, ...prev]);

      return result;
    } catch (err) {
      console.error('[useCaixa] Erro ao registrar movimentação:', err);
      setError('Erro ao registrar movimentação. Verifique sua conexão.');
      throw err;
    }
  };

  // Fechar caixa V2
  const fecharCaixaV2 = useCallback(async (payload: FechamentoPayload) => {
    if (!sessaoAtivaRef.current) {
      throw new Error('Nenhuma sessão ativa');
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

      // Validar consistência dos dados
      const { entradas: entradasCalc, saidas: saidasCalc, saldo: saldoCalc } = calcularTotaisMovimentacoes(movimentacoes);
      const saldoEsperado = sessaoAtivaRef.current.valor_inicial + saldoCalc;
      
      // Verificar se o resumo está consistente com as movimentações
      const resumoConsistente = Math.abs(resumo.total_entradas - entradasCalc) < 0.01 &&
                                Math.abs(resumo.total_saidas - saidasCalc) < 0.01;
      
      if (!resumoConsistente) {
        console.warn('[useCaixa] Inconsistência detectada no resumo. Recalculando...');
        // Corrigir resumo baseado nas movimentações reais
        const { resumo: resumoRecalculado } = calcularTotaisMovimentacoes(movimentacoes);
        resumo.total_entradas = resumoRecalculado.pix + resumoRecalculado.dinheiro + resumoRecalculado.bolao_dinheiro + resumoRecalculado.bolao_pix;
        resumo.total_saidas = resumoRecalculado.sangria + resumoRecalculado.deposito + resumoRecalculado.boleto + resumoRecalculado.trocados;
      }

      // Calcular diferença corretamente
      const saldoEsperadoDinheiro = sessaoAtivaRef.current.valor_inicial + 
                                    (resumo.entradas_dinheiro + resumo.entradas_bolao_dinheiro) - 
                                    (resumo.saidas_sangria + resumo.saidas_deposito + resumo.saidas_boleto + resumo.saidas_trocados);
      
      const diferencaCorreta = dinheiroEmMaos - saldoEsperadoDinheiro;

      const updateData = {
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        valor_final_declarado: dinheiroEmMaos,
        resumo_entradas_pix: resumo.entradas_pix || 0,
        resumo_entradas_dinheiro: resumo.entradas_dinheiro || 0,
        resumo_entradas_bolao_dinheiro: resumo.entradas_bolao_dinheiro || 0,
        resumo_entradas_bolao_pix: resumo.entradas_bolao_pix || 0,
        resumo_saidas_sangria: resumo.saidas_sangria || 0,
        resumo_saidas_deposito: resumo.saidas_deposito || 0,
        resumo_saidas_boleto: resumo.saidas_boleto || 0,
        resumo_saidas_trocados: resumo.saidas_trocados || 0,
        resumo_total_entradas: resumo.total_entradas || 0,
        resumo_total_saidas: resumo.total_saidas || 0,
        dinheiro_em_maos: dinheiroEmMaos,
        valor_enviado_cofre: valorEnviadoCofre,
        pix_externo_informado: pixExternoInformado,
        fundo_caixa_devolvido: fundoCaixaDevolvido,
        saldo_esperado_dinheiro: saldoEsperadoDinheiro,
        diferenca_caixa: diferencaCorreta,
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
      return data;
    } catch (error: any) {
      console.error('[useCaixa] Erro ao fechar caixa:', error);
      setError(`Erro ao fechar caixa: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, movimentacoes, calcularTotaisMovimentacoes]);

  // Fechar caixa (versão antiga) - DEPRECATED, mantida para compatibilidade
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
    console.warn('[useCaixa] fecharCaixa está deprecated. Use fecharCaixaV2');
    
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

      // Calcular valores corretamente
      const { entradas, saidas, saldo } = calcularTotaisMovimentacoes(movimentacoes);
      const valorFinalCalculado = sessaoAtiva.valor_inicial + saldo;

      const updateData = {
        valor_final_declarado: valorFinalCalculado,
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        observacoes: observacoes,
        ...(tflData || {}),
        valor_cofre: valorCofre || 0,
        valor_pix_externo: valorPixExterno || 0,
      };

      const { data, error } = await supabase
        .from('caixa_sessoes')
        .update(updateData)
        .eq('id', sessaoAtiva.id)
        .select()
        .single();

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
    fecharCaixaV2,
    refresh: fetchSessaoAtiva,
    calcularTotaisMovimentacoes,
  };
}
