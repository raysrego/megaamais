'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useLoja } from '@/contexts/LojaContext';

export interface Notificacao {
    id: string;
    tipo: 'sucesso' | 'alerta' | 'info' | 'erro';
    titulo: string;
    mensagem: string;
    tempo: string;
    lida: boolean;
    transaction_id?: number;
    link?: string;
}

interface NotificacoesContextType {
    notificacoes: Notificacao[];
    loading: boolean;
    naoLidas: number;
    fetchNotificacoes: () => Promise<void>;
    marcarTodasComoLidas: () => void;
    limparLidas: () => void;
    marcarComoLida: (id: string) => void;
}

const NotificacoesContext = createContext<NotificacoesContextType | undefined>(undefined);

export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
    const supabase = createBrowserSupabaseClient();
    const { lojaAtual } = useLoja();
    const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
    const [loading, setLoading] = useState(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [lidasIds, setLidasIds] = useState<string[]>([]);
    const [ocultasIds, setOcultasIds] = useState<string[]>([]);

    useEffect(() => {
        const savedLidas = localStorage.getItem('notif_lidas');
        const savedOcultas = localStorage.getItem('notif_ocultas');
        if (savedLidas) setLidasIds(JSON.parse(savedLidas));
        if (savedOcultas) setOcultasIds(JSON.parse(savedOcultas));
    }, []);

    useEffect(() => {
        if (lidasIds.length > 0) localStorage.setItem('notif_lidas', JSON.stringify(lidasIds));
    }, [lidasIds]);

    useEffect(() => {
        if (ocultasIds.length > 0) localStorage.setItem('notif_ocultas', JSON.stringify(ocultasIds));
    }, [ocultasIds]);

    const fetchNotificacoes = useCallback(async () => {
        // Cancelar requisição anterior se houver
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const hoje = new Date();
            let query = supabase
                .from('financeiro_contas')
                .select('*')
                .eq('status', 'pendente')
                .order('data_vencimento', { ascending: true })
                .abortSignal(controller.signal);

            if (lojaAtual?.id) {
                query = query.eq('loja_id', lojaAtual.id);
            }

            const { data: contas, error } = await query;

            if (error) {
                if (error.name !== 'AbortError') console.error('[NOTIF] Erro:', error);
                return;
            }

            const notifs: Notificacao[] = [];
            contas?.forEach((conta) => {
                const vencimento = new Date(conta.data_vencimento);
                const diffDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                let notif: Notificacao | null = null;
                let id = '';

                if (diffDias < 0) {
                    id = `atrasada-${conta.id}`;
                    notif = {
                        id, tipo: 'erro', titulo: 'Pagamento Atrasado', tempo: `${Math.abs(diffDias)} dias atrás`,
                        mensagem: `${conta.descricao} - R$ ${conta.valor.toLocaleString('pt-BR')}`,
                        lida: false, link: '/financeiro'
                    };
                } else if (diffDias === 0) {
                    id = `hoje-${conta.id}`;
                    notif = {
                        id, tipo: 'alerta', titulo: 'Vence Hoje', tempo: 'Hoje',
                        mensagem: `${conta.descricao} - R$ ${conta.valor.toLocaleString('pt-BR')}`,
                        lida: false, link: '/financeiro'
                    };
                }

                if (notif && !ocultasIds.includes(id)) {
                    notifs.push({ ...notif, lida: lidasIds.includes(id) });
                }
            });

            setNotificacoes(notifs);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('[NOTIF] Erro detalhado:', error.message);
        } finally {
            setLoading(false);
        }
    }, [supabase, lojaAtual?.id, lidasIds, ocultasIds]);

    useEffect(() => {
        fetchNotificacoes();

        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lojaAtual?.id]);

    const marcarTodasComoLidas = useCallback(() => {
        const newLidas = [...new Set([...lidasIds, ...notificacoes.map(n => n.id)])];
        setLidasIds(newLidas);
        setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    }, [notificacoes, lidasIds]);

    const limparLidas = useCallback(() => {
        const lidasAtuais = notificacoes.filter(n => n.lida).map(n => n.id);
        const newOcultas = [...new Set([...ocultasIds, ...lidasAtuais])];
        setOcultasIds(newOcultas);
        setNotificacoes(prev => prev.filter(n => !n.lida));
    }, [notificacoes, ocultasIds]);

    const marcarComoLida = useCallback((id: string) => {
        if (!lidasIds.includes(id)) setLidasIds(prev => [...prev, id]);
        setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    }, [lidasIds]);

    return (
        <NotificacoesContext.Provider value={{
            notificacoes, loading, naoLidas: notificacoes.filter(n => !n.lida).length,
            fetchNotificacoes, marcarTodasComoLidas, limparLidas, marcarComoLida
        }}>
            {children}
        </NotificacoesContext.Provider>
    );
}

export const useNotificacoes = () => {
    const context = useContext(NotificacoesContext);
    if (context === undefined) {
        throw new Error('useNotificacoes deve ser usado dentro de um NotificacoesProvider');
    }
    return context;
};
