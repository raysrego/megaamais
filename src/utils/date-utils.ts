import { Jogo } from '@/types/produto';

/**
 * Utilitários para tratamento de datas e horários de sorteio (MegaB)
 * Foco: Brasília (UTC-3)
 */

/**
 * Retorna a data e hora atual no fuso horário de Brasília
 */
export function getBrasiliaTime(): Date {
    const now = new Date();
    // No navegador, a representação de "America/Sao_Paulo" garante o fuso correto
    const spTime = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    return new Date(spTime);
}

/**
 * Calcula a próxima data de sorteio com base nos dias permitidos e horário de fechamento
 * @param diasSorteio Array de números (1=Seg, 2=Ter, ..., 6=Sáb, 0=Dom)
 * @param horarioFechamento String no formato "HH:MM"
 */
export function getNextDrawDate(diasSorteio: number[], horarioFechamento: string): Date {
    const now = getBrasiliaTime();
    let current = new Date(now);

    const [fechamentoH, fechamentoM] = horarioFechamento.split(':').map(Number);
    const limiteHoje = new Date(now);
    limiteHoje.setHours(fechamentoH, fechamentoM, 0, 0);

    // Se hoje for dia de sorteio, mas já passou o horário de fechamento, começamos a busca a partir de amanhã
    if (diasSorteio.includes(now.getDay()) && now > limiteHoje) {
        current.setDate(current.getDate() + 1);
    }

    // Busca o próximo dia da semana que está no array de sorteios (máximo 7 dias à frente)
    for (let i = 0; i < 7; i++) {
        const dayOfWeek = current.getDay();
        if (diasSorteio.includes(dayOfWeek)) {
            return new Date(current);
        }
        current.setDate(current.getDate() + 1);
    }

    return current;
}

export interface DrawOccurrence {
    jogo: Jogo;
    data: Date;
    horario: string;
    isHoje: boolean;
    passou: boolean;
}

/**
 * Gera todos os sorteios programados para uma semana específica
 */
export function getDrawsForWeek(jogos: Jogo[], startDate: Date): DrawOccurrence[] {
    const draws: DrawOccurrence[] = [];
    const now = getBrasiliaTime();

    // Garantir que começamos no início do dia de startDate (normalmente uma segunda-feira)
    const baseDate = new Date(startDate);
    baseDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(baseDate);
        currentDay.setDate(baseDate.getDate() + i);
        const dayOfWeek = currentDay.getDay();

        jogos.forEach(jogo => {
            if (jogo.diasSorteio.includes(dayOfWeek)) {
                const drawDate = new Date(currentDay);
                const [h, m] = (jogo.horarioFechamento || "19:00").split(':').map(Number);
                drawDate.setHours(h, m, 0, 0);

                draws.push({
                    jogo,
                    data: drawDate,
                    horario: jogo.horarioFechamento || '19:00',
                    isHoje: currentDay.toDateString() === now.toDateString(),
                    passou: now > drawDate
                });
            }
        });
    }

    return draws.sort((a, b) => a.data.getTime() - b.data.getTime());
}

/**
 * Formata um countdown amigável (HH:MM:SS ou "Em andamento")
 */
export function formatCountdown(targetDate: Date): string {
    const now = getBrasiliaTime();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) return "Encerrado";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 24) {
        const dias = Math.floor(hours / 24);
        return `${dias}d ${hours % 24}h`;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formata a data para exibição amigável: "Sábado, 31/01"
 */
export function formatDrawDateLabel(date: Date): string {
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = dias[date.getDay()];
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');

    return `${diaSemana}, ${dia}/${mes}`;
}

/**
 * Formata para o valor do input (YYYY-MM-DD)
 */
export function formatToInputDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
