// lib/validate-fechamento.ts

import { CaixaMovimentacao } from '@/hooks/useCaixa';

export interface ValidacaoFechamento {
  valido: boolean;
  inconsistencias: string[];
  correcoes?: {
    entradas: number;
    saidas: number;
    saldo: number;
    diferenca: number;
  };
}

export function validarFechamento(
  valorInicial: number,
  movimentacoes: CaixaMovimentacao[],
  resumoInformado: {
    entradas_pix: number;
    entradas_dinheiro: number;
    entradas_bolao_dinheiro: number;
    entradas_bolao_pix: number;
    saidas_sangria: number;
    saidas_deposito: number;
    saidas_boleto: number;
    saidas_trocados: number;
  },
  dinheiroEmMaos: number
): ValidacaoFechamento {
  const inconsistencias: string[] = [];
  
  // Calcular valores reais das movimentações
  const entradasPixReal = movimentacoes
    .filter(m => m.tipo === 'pix' && m.valor > 0)
    .reduce((acc, m) => acc + m.valor, 0);
    
  const entradasDinheiroReal = movimentacoes
    .filter(m => m.metodo_pagamento === 'dinheiro' && m.valor > 0 && m.tipo !== 'pix')
    .reduce((acc, m) => acc + m.valor, 0);
    
  const saidasSangriaReal = movimentacoes
    .filter(m => m.tipo === 'sangria')
    .reduce((acc, m) => acc + Math.abs(m.valor), 0);
    
  const saidasDepositoReal = movimentacoes
    .filter(m => m.tipo === 'deposito')
    .reduce((acc, m) => acc + Math.abs(m.valor), 0);
    
  const saidasBoletoReal = movimentacoes
    .filter(m => m.tipo === 'boleto')
    .reduce((acc, m) => acc + Math.abs(m.valor), 0);
    
  const saidasTrocadosReal = movimentacoes
    .filter(m => m.tipo === 'trocados')
    .reduce((acc, m) => acc + Math.abs(m.valor), 0);
  
  // Validar entradas PIX
  if (Math.abs(entradasPixReal - (resumoInformado.entradas_pix + resumoInformado.entradas_bolao_pix)) > 0.01) {
    inconsistencias.push(`Inconsistência em PIX: Real R$ ${entradasPixReal.toFixed(2)} vs Informado R$ ${(resumoInformado.entradas_pix + resumoInformado.entradas_bolao_pix).toFixed(2)}`);
  }
  
  // Validar entradas Dinheiro
  const entradasDinheiroTotalReal = entradasDinheiroReal;
  const entradasDinheiroTotalInformado = resumoInformado.entradas_dinheiro + resumoInformado.entradas_bolao_dinheiro;
  
  if (Math.abs(entradasDinheiroTotalReal - entradasDinheiroTotalInformado) > 0.01) {
    inconsistencias.push(`Inconsistência em Entradas Dinheiro: Real R$ ${entradasDinheiroTotalReal.toFixed(2)} vs Informado R$ ${entradasDinheiroTotalInformado.toFixed(2)}`);
  }
  
  // Validar saídas
  if (Math.abs(saidasSangriaReal - resumoInformado.saidas_sangria) > 0.01) {
    inconsistencias.push(`Inconsistência em Sangrias: Real R$ ${saidasSangriaReal.toFixed(2)} vs Informado R$ ${resumoInformado.saidas_sangria.toFixed(2)}`);
  }
  
  if (Math.abs(saidasDepositoReal - resumoInformado.saidas_deposito) > 0.01) {
    inconsistencias.push(`Inconsistência em Depósitos: Real R$ ${saidasDepositoReal.toFixed(2)} vs Informado R$ ${resumoInformado.saidas_deposito.toFixed(2)}`);
  }
  
  // Calcular saldo esperado
  const totalEntradasReal = entradasPixReal + entradasDinheiroTotalReal;
  const totalSaidasReal = saidasSangriaReal + saidasDepositoReal + saidasBoletoReal + saidasTrocadosReal;
  const saldoEsperadoReal = valorInicial + totalEntradasReal - totalSaidasReal;
  
  const diferenca = dinheiroEmMaos - saldoEsperadoReal;
  
  if (Math.abs(diferenca) > 0.01) {
    inconsistencias.push(`Diferença de caixa: R$ ${diferenca.toFixed(2)} (Esperado: R$ ${saldoEsperadoReal.toFixed(2)} vs Declarado: R$ ${dinheiroEmMaos.toFixed(2)})`);
  }
  
  return {
    valido: inconsistencias.length === 0,
    inconsistencias,
    correcoes: inconsistencias.length > 0 ? {
      entradas: totalEntradasReal,
      saidas: totalSaidasReal,
      saldo: saldoEsperadoReal,
      diferenca
    } : undefined
  };
}
