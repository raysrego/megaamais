
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Formata valor monetário de forma segura (tratando null/undefined/NaN)
 * @param valor - Valor a ser formatado (pode ser number, string, null ou undefined)
 * @param options - Opções de formatação (default: 2 casas decimais)
 * @returns String formatada em pt-BR (ex: "1.234,56")
 */
export function formatCurrency(
    valor: number | string | null | undefined,
    options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
    const defaultOptions = {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options
    };

    // Converter para número, com fallback para 0
    const numericValue = Number(valor);

    // Se não for um número válido, retornar 0,00
    if (isNaN(numericValue) || !isFinite(numericValue)) {
        return (0).toLocaleString('pt-BR', defaultOptions);
    }

    return numericValue.toLocaleString('pt-BR', defaultOptions);
}
