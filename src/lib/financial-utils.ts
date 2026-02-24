/**
 * Utilitários financeiros para cálculos precisos
 */

/**
 * Soma array de valores com precisão de centavos
 * Evita erros de ponto flutuante comuns em JavaScript
 */
export function somaSegura(valores: number[]): number {
    if (!valores || valores.length === 0) return 0;

    // Converter para centavos (inteiros), somar, e voltar para reais
    const centavos = valores.reduce((acc, val) => {
        const valorEmCentavos = Math.round((val || 0) * 100);
        return acc + valorEmCentavos;
    }, 0);

    return Math.round(centavos) / 100;
}

/**
 * Formata valor monetário para exibição
 */
export function formatarValor(valor: number | null | undefined, incluirSimbolo: boolean = true): string {
    if (valor === null || valor === undefined || isNaN(valor)) {
        return incluirSimbolo ? 'R$ 0,00' : '0,00';
    }

    const valorFormatado = Math.abs(valor).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const simbolo = incluirSimbolo ? 'R$ ' : '';
    const sinal = valor < 0 ? '-' : '';

    return `${sinal}${simbolo}${valorFormatado}`;
}

/**
 * Valida se um valor monetário é válido
 */
export function validarValorMonetario(valor: any): boolean {
    if (valor === null || valor === undefined) return false;

    const num = typeof valor === 'string' ? parseFloat(valor) : valor;
    return !isNaN(num) && num >= 0 && num < 1000000000; // Limite de 1 bilhão
}

/**
 * Calcula porcentagem com precisão
 */
export function calcularPorcentagem(valor: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((valor / total) * 10000) / 100; // 2 casas decimais
}

/**
 * Valida dia do mês (evita overflow como 31/02)
 */
export function obterDiaValidoDoMes(ano: number, mes: number, dia: number): number {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return Math.min(dia, ultimoDia);
}

/**
 * Formata data no padrão brasileiro
 */
export function formatarDataBR(data: string | Date | null): string {
    if (!data) return '-';

    const d = typeof data === 'string' ? new Date(data + 'T00:00:00') : data;

    if (isNaN(d.getTime())) return '-';

    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo'
    });
}

/**
 * Obtém data atual no timezone de São Paulo
 */
export function obterDataAtualBR(): string {
    const agora = new Date();
    const offset = -3 * 60; // UTC-3
    const dataLocal = new Date(agora.getTime() + offset * 60 * 1000);
    return dataLocal.toISOString().split('T')[0];
}

/**
 * Debounce para evitar múltiplas chamadas
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Agrupa transações por categoria
 */
export interface ItemAgrupado {
    item: string;
    total: number;
    quantidade: number;
}

export function agruparPorCategoria(
    transacoes: Array<{ item: string; valor: number }>
): ItemAgrupado[] {
    const mapa = new Map<string, { total: number; quantidade: number }>();

    transacoes.forEach(t => {
        const atual = mapa.get(t.item) || { total: 0, quantidade: 0 };
        mapa.set(t.item, {
            total: somaSegura([atual.total, t.valor]),
            quantidade: atual.quantidade + 1
        });
    });

    return Array.from(mapa.entries())
        .map(([item, dados]) => ({ item, ...dados }))
        .sort((a, b) => b.total - a.total);
}
