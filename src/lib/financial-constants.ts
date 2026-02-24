/**
 * Constantes Financeiras - MegaB Sistema de Lotéricas
 * 
 * Fonte: ROTEIRO_ENTREVISTA.md + Regras de Negócio Validadas
 * Data: 2026-02-03
 * 
 * IMPORTANTE: Estes valores são baseados em contratos com a Caixa Econômica
 * e regras de negócio da lotérica. Não altere sem aprovação do gestor.
 */

export const FINANCIAL_RULES = {
    /**
     * Ágio de Bolões (Taxa Administrativa)
     * Percentual de lucro sobre o valor base do bolão
     * Fonte: ROTEIRO_ENTREVISTA.md linha 90
     */
    AGIO_BOLOES: 35,

    /**
     * Margem de Jogos Avulsos (Comissão da Caixa)
     * Percentual que a lotérica recebe sobre vendas de jogos individuais
     * Fonte: ROTEIRO_ENTREVISTA.md linha 129
     */
    MARGEM_JOGOS_CAIXA: 8.61,

    /**
     * Limites de Validação
     */
    VALIDATION: {
        AGIO_MIN: 0,
        AGIO_MAX: 35,
    },

    /**
     * Metas de Comissão para Operadores
     * Bonificação baseada no total de vendas mensais
     * Fonte: ROTEIRO_ENTREVISTA.md linha 61
     */
    METAS_COMISSAO: [
        { vendas: 10000, bonus: 600, label: 'Bronze' },
        { vendas: 20000, bonus: 700, label: 'Prata' },
        { vendas: 25000, bonus: 800, label: 'Ouro' },
        { vendas: 30000, bonus: 1000, label: 'Diamante' },
    ] as const,

    /**
     * Prazo para retirada de prêmios (em dias)
     * Fonte: ROTEIRO_ENTREVISTA.md linha 111
     */
    PRAZO_RESGATE_PREMIO: 90,

    /**
     * Outras Margens/Comissões
     * Valores a pesquisar conforme necessário
     */
    OUTROS: {
        // MARGEM_RECARGA_CELULAR: null, // A pesquisar
        // MARGEM_BOLETOS: null, // A pesquisar
    },
} as const;

/**
 * Calcula o valor de venda de uma cota de bolão
 * @param valorBase - Valor base da cota (sem ágio)
 * @param agio - Percentual de ágio (padrão 35%)
 * @returns Valor final de venda da cota
 * 
 * @example
 * calcularPrecoVenda(10, 35) // Retorna 13.50
 */
export function calcularPrecoVenda(valorBase: number, agio: number = FINANCIAL_RULES.AGIO_BOLOES): number {
    return valorBase * (1 + agio / 100);
}

/**
 * Calcula a comissão (lucro) de uma cota de bolão
 * @param valorBase - Valor base da cota
 * @param valorVenda - Valor de venda da cota
 * @returns Valor da comissão
 * 
 * @example
 * calcularComissao(10, 13.50) // Retorna 3.50
 */
export function calcularComissao(valorBase: number, valorVenda: number): number {
    return valorVenda - valorBase;
}

/**
 * Valida se o ágio está dentro dos limites permitidos
 * @param agio - Percentual de ágio
 * @returns true se válido, false caso contrário
 */
export function validarAgio(agio: number): boolean {
    return agio >= FINANCIAL_RULES.VALIDATION.AGIO_MIN && agio <= FINANCIAL_RULES.VALIDATION.AGIO_MAX;
}

/**
 * Calcula a meta de comissão do operador baseada nas vendas
 * @param totalVendas - Total de vendas do operador no mês
 * @returns Objeto com a meta atingida e o valor do bônus
 */
export function calcularMetaOperador(totalVendas: number) {
    const metasOrdenadas = [...FINANCIAL_RULES.METAS_COMISSAO].reverse();
    const metaAtingida = metasOrdenadas.find(m => totalVendas >= m.vendas);

    return metaAtingida || null;
}
