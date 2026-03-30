/**
 * Utilitários de Fechamento de Caixa
 * Funções puras para cálculos de resumo, reconciliação e validação.
 * Sem dependências de React ou Supabase.
 */

export interface MovimentacaoParaResumo {
    tipo: string;
    valor: number;
}

export interface ResumoFechamento {
    entradas_pix: number;
    entradas_dinheiro: number;
    entradas_bolao_dinheiro: number;
    entradas_bolao_pix: number;
    saidas_sangria: number;
    saidas_deposito: number;
    saidas_boleto: number;
    saidas_trocados: number;
    total_entradas: number;
    total_saidas: number;
}

export interface ReconciliacaoCaixa {
    saldo_esperado_dinheiro: number;
    diferenca: number;
    status: 'batido' | 'sobra' | 'falta';
}

/**
 * Calcula o resumo de movimentações agrupado por tipo.
 * Usado para preencher os campos resumo_* da sessão.
 */
export function calcularResumo(movimentacoes: MovimentacaoParaResumo[]): ResumoFechamento {
    const resumo: ResumoFechamento = {
        entradas_pix: 0,
        entradas_dinheiro: 0,
        entradas_bolao_dinheiro: 0,
        entradas_bolao_pix: 0,
        saidas_sangria: 0,
        saidas_deposito: 0,
        saidas_boleto: 0,
        saidas_trocados: 0,
        total_entradas: 0,
        total_saidas: 0,
    };

    for (const mov of movimentacoes) {
        const valor = mov.valor;

        switch (mov.tipo) {
            case 'pix':
                if (valor > 0) resumo.entradas_pix += valor;
                break;
            case 'venda':
            case 'suprimento':
                if (valor > 0) resumo.entradas_dinheiro += valor;
                break;
            case 'venda_bolao':
                if (valor > 0) resumo.entradas_bolao_dinheiro += valor;
                break;
            case 'venda_bolao_pix':
                if (valor > 0) resumo.entradas_bolao_pix += valor;
                break;
            case 'sangria':
                resumo.saidas_sangria += Math.abs(valor);
                break;
            case 'deposito':
                resumo.saidas_deposito += Math.abs(valor);
                break;
            case 'boleto':
            case 'pagamento':
                resumo.saidas_boleto += Math.abs(valor);
                break;
            case 'trocados':
                resumo.saidas_trocados += Math.abs(valor);
                break;
        }

        if (valor > 0) {
            resumo.total_entradas += valor;
        } else {
            resumo.total_saidas += Math.abs(valor);
        }
    }

    // Arredondar para evitar float issues
    for (const key of Object.keys(resumo) as Array<keyof ResumoFechamento>) {
        resumo[key] = Math.round(resumo[key] * 100) / 100;
    }

    return resumo;
}

/**
 * Calcula a reconciliação entre saldo esperado e valor declarado pelo operador.
 * O saldo esperado de dinheiro desconsidera PIX (não fica na gaveta).
 */
export function calcularReconciliacao(
    valorInicial: number,
    resumo: ResumoFechamento,
    dinheiroDeclarado: number
): ReconciliacaoCaixa {
    // Dinheiro que ENTROU na gaveta: vendas jogos + vendas bolão dinheiro + suprimentos
    const entradasDinheiro = resumo.entradas_dinheiro + resumo.entradas_bolao_dinheiro;

    // Dinheiro que SAIU da gaveta: sangrias + depósitos + boletos + trocados
    const saidasDinheiro = resumo.saidas_sangria + resumo.saidas_deposito +
        resumo.saidas_boleto + resumo.saidas_trocados;

    // Saldo esperado = fundo inicial + entradas em dinheiro - saídas em dinheiro
    const saldoEsperado = Math.round((valorInicial + entradasDinheiro - saidasDinheiro) * 100) / 100;

    const diferenca = Math.round((dinheiroDeclarado - saldoEsperado) * 100) / 100;

    let status: 'batido' | 'sobra' | 'falta';
    if (Math.abs(diferenca) < 0.01) {
        status = 'batido';
    } else if (diferenca > 0) {
        status = 'sobra';
    } else {
        status = 'falta';
    }

    return {
        saldo_esperado_dinheiro: saldoEsperado,
        diferenca,
        status,
    };
}

/**
 * Valida se o fechamento pode ser enviado.
 * Retorna null se válido, ou string com mensagem de erro.
 */
export function validarFechamento(params: {
    dinheiroEmMaos: number;
    valorEnviadoCofre: number;
    diferenca: number;
    justificativa: string;
    fundoDevolvido: boolean;
    valorInicial: number;
}): string | null {
    const { dinheiroEmMaos, valorEnviadoCofre, diferenca, justificativa, fundoDevolvido, valorInicial } = params;

    if (dinheiroEmMaos < 0) {
        return 'O valor em mãos não pode ser negativo.';
    }

    if (valorEnviadoCofre < 0) {
        return 'O valor enviado ao cofre não pode ser negativo.';
    }

    if (valorEnviadoCofre > dinheiroEmMaos) {
        return 'Não é possível enviar ao cofre mais do que você tem em mãos.';
    }

    if (Math.abs(diferenca) >= 0.01 && !justificativa.trim()) {
        return 'Justificativa obrigatória quando há diferença no caixa.';
    }

    if (fundoDevolvido && dinheiroEmMaos < valorInicial) {
        return `Você marcou que devolveu o fundo de R$ ${valorInicial.toFixed(2)}, mas declarou ter menos que isso em mãos.`;
    }

    return null;
}

/**
 * Formata o status da reconciliação para exibição.
 */
export function formatarStatusReconciliacao(status: string): {
    label: string;
    cor: string;
    icone: 'check' | 'alert' | 'x';
} {
    switch (status) {
        case 'batido':
            return { label: 'BATIDO', cor: '#22c55e', icone: 'check' };
        case 'sobra':
            return { label: 'SOBRA', cor: '#eab308', icone: 'alert' };
        case 'falta':
            return { label: 'FALTA', cor: '#ef4444', icone: 'x' };
        default:
            return { label: 'PENDENTE', cor: '#94a3b8', icone: 'alert' };
    }
}
