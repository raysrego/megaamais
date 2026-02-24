/**
 * Utilitários de validação para Server Actions
 * Centraliza validações comuns para evitar duplicação
 */

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Valida se um valor numérico é positivo
 */
export function validatePositive(value: number, fieldName: string): void {
    if (value <= 0) {
        throw new ValidationError(`${fieldName} deve ser maior que zero`);
    }
}

/**
 * Valida se um valor numérico é não-negativo
 */
export function validateNonNegative(value: number, fieldName: string): void {
    if (value < 0) {
        throw new ValidationError(`${fieldName} não pode ser negativo`);
    }
}

/**
 * Valida se um valor está dentro de um range
 */
export function validateRange(value: number, min: number, max: number, fieldName: string): void {
    if (value < min || value > max) {
        throw new ValidationError(`${fieldName} deve estar entre ${min} e ${max}`);
    }
}

/**
 * Valida se uma string não está vazia
 */
export function validateNotEmpty(value: string | null | undefined, fieldName: string): void {
    if (!value || value.trim().length === 0) {
        throw new ValidationError(`${fieldName} é obrigatório`);
    }
}

/**
 * Valida se um UUID é válido
 */
export function validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
        throw new ValidationError(`${fieldName} não é um UUID válido`);
    }
}

/**
 * Valida se um email é válido
 */
export function validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError('Email inválido');
    }
}

/**
 * Valida se uma data está no futuro
 */
export function validateFutureDate(date: string | Date, fieldName: string): void {
    const inputDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();

    if (inputDate <= now) {
        throw new ValidationError(`${fieldName} deve ser uma data futura`);
    }
}

/**
 * Valida se um valor está em uma lista de opções
 */
export function validateEnum<T>(value: T, allowedValues: T[], fieldName: string): void {
    if (!allowedValues.includes(value)) {
        throw new ValidationError(
            `${fieldName} deve ser um dos seguintes valores: ${allowedValues.join(', ')}`
        );
    }
}

/**
 * Wrapper para executar uma Server Action com validação
 */
export async function withValidation<T>(
    actionFn: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
        const result = await actionFn();
        return { success: true, data: result };
    } catch (error) {
        if (error instanceof ValidationError) {
            return { success: false, error: error.message };
        }

        console.error('Erro inesperado:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro inesperado no servidor'
        };
    }
}

/**
 * Validações específicas para o domínio de bolões
 */
export const BolaoValidators = {
    validateQuantidadeCotas(qtd: number): void {
        validatePositive(qtd, 'Quantidade de cotas');
        validateRange(qtd, 1, 1000, 'Quantidade de cotas');
    },

    validatePrecoVenda(preco: number): void {
        validatePositive(preco, 'Preço de venda');
        validateRange(preco, 0.01, 100000, 'Preço de venda');
    },

    validateTaxaAdministrativa(taxa: number): void {
        validateNonNegative(taxa, 'Taxa administrativa');
        validateRange(taxa, 0, 100, 'Taxa administrativa');
    },

    validateConcurso(concurso: string): void {
        validateNotEmpty(concurso, 'Concurso');
        if (concurso.length > 20) {
            throw new ValidationError('Concurso não pode ter mais de 20 caracteres');
        }
    }
};

/**
 * Validações específicas para o domínio financeiro
 */
export const FinanceiroValidators = {
    validateValorTransacao(valor: number): void {
        validatePositive(valor, 'Valor da transação');
        validateRange(valor, 0.01, 1000000, 'Valor da transação');
    },

    validateMetodoPagamento(metodo: string): void {
        validateEnum(
            metodo,
            ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'],
            'Método de pagamento'
        );
    },

    validateDescricao(descricao: string | null | undefined): void {
        if (descricao) {
            if (descricao.length > 500) {
                throw new ValidationError('Descrição não pode ter mais de 500 caracteres');
            }
        }
    }
};

/**
 * Validações específicas para caixa
 */
export const CaixaValidators = {
    validateValorInicial(valor: number): void {
        validateNonNegative(valor, 'Valor inicial');
        validateRange(valor, 0, 100000, 'Valor inicial');
    },

    validateValorMovimentacao(valor: number, tipo: string): void {
        validatePositive(Math.abs(valor), 'Valor da movimentação');

        if (tipo === 'sangria' && valor > 0) {
            throw new ValidationError('Sangria deve ter valor negativo');
        }

        if (tipo !== 'sangria' && valor < 0) {
            throw new ValidationError('Entrada deve ter valor positivo');
        }
    }
};
