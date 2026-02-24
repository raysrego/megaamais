'use client';

import { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    AlertTriangle,
    TrendingUp,
    Clock,
    ChevronLeft,
    ChevronRight,
    Zap,
    Ticket,
    CheckCircle2
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { getProdutos } from '@/actions/produtos';
import { Jogo } from '@/types/produto';
import {
    getDrawsForWeek,
    DrawOccurrence,
    getBrasiliaTime,
    formatCountdown,
    formatDrawDateLabel
} from '@/utils/date-utils';

export default function CalendarioSorteiosPage() {
    const [loading, setLoading] = useState(true);
    const [jogos, setJogos] = useState<Jogo[]>([]);
    const [timeline, setTimeline] = useState<DrawOccurrence[]>([]);
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const now = getBrasiliaTime();
        const start = new Date(now);
        // Ajustar para a segunda-feira da semana atual
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        return start;
    });
    const [nowState, setNowState] = useState(getBrasiliaTime());

    // Carregar Jogos e Gerar Timeline
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const data = await getProdutos();
                setJogos(data);
                const generated = getDrawsForWeek(data, currentWeekStart);
                setTimeline(generated);
            } catch (error) {
                console.error('Erro ao carregar sorteios:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [currentWeekStart]);

    // Atualizar Countdown a cada segundo
    useEffect(() => {
        const interval = setInterval(() => {
            setNowState(getBrasiliaTime());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const changeWeek = (weeks: number) => {
        const next = new Date(currentWeekStart);
        next.setDate(next.getDate() + (weeks * 7));
        setCurrentWeekStart(next);
    };

    const acumulados = timeline.filter(s => s.isHoje && !s.passou); // Simplificação de "oportunidade"
    const sorteiosHoje = timeline.filter(s => s.isHoje);

    // Próximo sorteio iminente
    const proximoSorteio = timeline.find(s => !s.passou);

    if (loading) return <LoadingState type="dashboard" />;

    return (
        <div className="dashboard-content">
            <PageHeader title="Sorteios em Tempo Real">
                <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => changeWeek(-1)}>
                        <ChevronLeft size={16} /> Semana Anterior
                    </button>
                    <button className="btn btn-ghost" onClick={() => changeWeek(1)}>
                        Próxima Semana <ChevronRight size={16} />
                    </button>
                </div>
            </PageHeader>

            {/* Banner de Destaque / Próximo Sorteio */}
            {proximoSorteio && (
                <div className="card mb-8 p-0 overflow-hidden border-primary/20 bg-primary/5">
                    <div className="flex flex-col md:flex-row items-stretch">
                        <div className="p-8 flex flex-col justify-center flex-1">
                            <div className="flex items-center gap-2 text-primary-blue-light font-black text-xs uppercase tracking-widest mb-2">
                                <Zap size={14} /> PRÓXIMO SORTEIO IMINENTE
                            </div>
                            <h2 className="text-3xl font-black mb-1">{proximoSorteio.jogo.nome}</h2>
                            <p className="text-muted text-sm mb-6">Encerramento das apostas em breve. Prepare seus bolões!</p>

                            <div className="flex gap-8">
                                <div>
                                    <div className="text-[10px] font-black text-muted uppercase">Tempo Restante</div>
                                    <div className="text-3xl font-black text-primary-blue-light tabular-nums">
                                        {formatCountdown(proximoSorteio.data)}
                                    </div>
                                </div>
                                <div className="border-l border-white/10 pl-8">
                                    <div className="text-[10px] font-black text-muted uppercase">Horário Limite</div>
                                    <div className="text-3xl font-black">{proximoSorteio.horario}</div>
                                </div>
                            </div>
                        </div>
                        <div className="hidden md:flex w-64 items-center justify-center p-8 bg-linear-to-br from-primary-blue/20 to-transparent">
                            <div className="w-32 h-32 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
                                <TrendingUp size={64} className="text-primary-blue-light opacity-50" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Coluna da Esquerda: Timeline Vertical */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-sm font-black text-muted uppercase tracking-widest flex items-center gap-2">
                        <Clock size={16} /> Linha do Tempo da Semana
                    </h3>

                    <div className="relative pl-8 border-l-2 border-white/5 space-y-8">
                        {timeline.length === 0 ? (
                            <div className="text-muted p-8 text-center italic border-2 border-dashed border-white/5 rounded-3xl">
                                Nenhum sorteio programado para este período.
                            </div>
                        ) : timeline.map((draw, idx) => {
                            const isNext = draw === proximoSorteio;

                            return (
                                <div key={`${draw.jogo.nome}-${idx}`} className="relative">
                                    {/* Indicador de Timeline */}
                                    <div className={`absolute -left-[41px] top-6 w-4 h-4 rounded-full border-4 border-bg-dark transition-all duration-500 ${draw.passou ? 'bg-success scale-75' : isNext ? 'bg-primary-blue-light ring-4 ring-primary-blue/20 scale-125' : 'bg-muted'
                                        }`} />

                                    <div className={`card p-6 transition-all duration-300 hover:translate-x-1 ${draw.passou ? 'opacity-60 grayscale-[0.5]' : isNext ? 'border-primary-blue-light/40 bg-primary-blue-light/5' : ''
                                        }`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${draw.jogo.cor}20` }}>
                                                    <div className="font-black text-lg" style={{ color: draw.jogo.cor }}>
                                                        {draw.jogo.nome.substring(0, 1)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-lg">{draw.jogo.nome}</h4>
                                                        {draw.isHoje && (
                                                            <span className="badge success text-[8px] px-1.5 py-0.5">HOJE</span>
                                                        )}
                                                        {draw.passou && (
                                                            <span className="text-[10px] text-success font-black flex items-center gap-1">
                                                                <CheckCircle2 size={12} /> ENCERRADO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted font-bold">
                                                        {formatDrawDateLabel(draw.data)} • {draw.horario}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                {!draw.passou && (
                                                    <div className="text-right">
                                                        <div className="text-[9px] font-black text-muted uppercase">Countdown</div>
                                                        <div className={`text-sm font-black font-mono ${draw.isHoje ? 'text-primary-blue-light' : ''}`}>
                                                            {formatCountdown(draw.data)}
                                                        </div>
                                                    </div>
                                                )}

                                                <button className={`btn btn-sm ${draw.passou ? 'btn-ghost' : 'btn-primary'} h-10 px-4 rounded-xl font-black text-[10px] tracking-wider uppercase`}>
                                                    <Ticket size={14} className="mr-1.5" />
                                                    {draw.passou ? 'Ver Resultado' : 'Novo Bolão'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Coluna da Direita: Stats & Info */}
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-muted uppercase tracking-widest">Resumo Operacional</h3>

                    <div className="card p-6 bg-linear-to-br from-bg-card to-bg-dark border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-muted uppercase">Sorteios na Semana</span>
                            <Zap size={14} className="text-orange-500" />
                        </div>
                        <div className="text-4xl font-black mb-1">{timeline.length}</div>
                        <p className="text-xs text-muted">Total de oportunidades de venda</p>

                        <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted font-bold">Sorteios Hoje</span>
                                <span className="font-black text-primary-blue-light">{sorteiosHoje.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-success">
                                <span className="text-xs font-bold">Encerrados</span>
                                <span className="font-black">{timeline.filter(s => s.passou).length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card border-dashed border-2 border-white/5 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-4">
                            <AlertTriangle size={32} />
                        </div>
                        <h4 className="font-black mb-2">Atenção ao horário!</h4>
                        <p className="text-xs text-muted leading-relaxed">
                            Lembre-se que o encerramento do TFL ocorre 1 hora antes do sorteio oficial.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
