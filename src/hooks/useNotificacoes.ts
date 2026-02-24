'use client';

/**
 * Hook para consumir o contexto de notificações.
 * Agora consolidado no NotificacoesProvider para evitar múltiplas conexões.
 */
import { useNotificacoes as useNotificacoesContext } from '@/contexts/NotificacoesContext';

export function useNotificacoes() {
    return useNotificacoesContext();
}

export type { Notificacao } from '@/contexts/NotificacoesContext';
