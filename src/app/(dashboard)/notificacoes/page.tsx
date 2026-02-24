'use client';

import { Bell, CheckCircle, AlertTriangle, Info, Clock, Trash2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { useRouter } from 'next/navigation';

const iconMap = {
    sucesso: CheckCircle,
    alerta: AlertTriangle,
    info: Info,
    erro: AlertCircle,
};

const colorMap = {
    sucesso: '#22c55e',
    alerta: '#eab308',
    info: '#3b82f6',
    erro: '#ef4444',
};

export default function NotificacoesPage() {
    const { notificacoes, loading, naoLidas, marcarTodasComoLidas, limparLidas, marcarComoLida } = useNotificacoes();
    const router = useRouter();

    const handleClickNotificacao = (notif: any) => {
        // Marcar como lida
        marcarComoLida(notif.id);

        // Navegar para o link se houver
        if (notif.link) {
            router.push(notif.link);
        }
    };

    if (loading) return <LoadingState type="list" />;

    return (
        <div className="dashboard-content">
            <PageHeader title="Notificações">
                <div className="flex gap-2">
                    {naoLidas > 0 && (
                        <button
                            className="btn btn-ghost"
                            onClick={marcarTodasComoLidas}
                        >
                            <CheckCircle size={16} /> Marcar todas como lidas
                        </button>
                    )}
                    <button
                        className="btn btn-ghost"
                        onClick={limparLidas}
                    >
                        <Trash2 size={16} /> Limpar lidas
                    </button>
                </div>
            </PageHeader>

            {/* Badge de resumo */}
            {naoLidas > 0 && (
                <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
                    <Bell size={20} className="text-blue-400" />
                    <span className="text-sm font-semibold">
                        Você tem <strong className="text-blue-400">{naoLidas}</strong> notificação{naoLidas > 1 ? 'ões' : ''} não lida{naoLidas > 1 ? 's' : ''}
                    </span>
                </div>
            )}

            <div className="card" style={{ padding: 0 }}>
                {notificacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Bell size={48} className="text-muted mb-4 opacity-30" />
                        <h3 className="text-lg font-bold text-muted mb-2">Nenhuma notificação</h3>
                        <p className="text-sm text-muted">
                            Você está em dia! Não há alertas de vencimento no momento.
                        </p>
                    </div>
                ) : (
                    notificacoes.map((notif, idx) => {
                        const Icon = iconMap[notif.tipo as keyof typeof iconMap];
                        const color = colorMap[notif.tipo as keyof typeof colorMap];
                        return (
                            <div
                                key={notif.id}
                                style={{
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '1rem',
                                    borderBottom: idx < notificacoes.length - 1 ? '1px solid var(--border)' : 'none',
                                    background: notif.lida ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                className="hover:bg-white/5"
                                onClick={() => handleClickNotificacao(notif)}
                            >
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={18} color={color} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>{notif.titulo}</h4>
                                        <span className="text-xs text-muted flex items-center gap-1">
                                            <Clock size={12} /> {notif.tempo}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted">{notif.mensagem}</p>
                                    {notif.link && (
                                        <span className="text-xs text-blue-400 mt-1 inline-block">
                                            Clique para ir ao Financeiro →
                                        </span>
                                    )}
                                </div>
                                {!notif.lida && (
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-blue-light)', flexShrink: 0, marginTop: 6 }} />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
