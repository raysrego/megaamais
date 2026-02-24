'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { BadgeLoteria } from '@/components/ui/LogoLoteria';
import { LOTERIAS_OFFICIAL } from '@/data/loterias-config';

interface LotteryListRowProps {
    jogo: string;
    cor: string;
    boloes: any[];
    onClick: () => void;
}

export function LotteryListRow({ jogo, cor, boloes, onClick }: LotteryListRowProps) {
    const slug = Object.keys(LOTERIAS_OFFICIAL).find(key => LOTERIAS_OFFICIAL[key].nome === jogo) || 'megasena';
    const config = LOTERIAS_OFFICIAL[slug];

    const totalCotas = boloes.reduce((acc, b) => acc + b.qtdCotas, 0);
    const totalVendidas = boloes.reduce((acc, b) => acc + b.cotasVendidas, 0);
    const progressoGeral = totalCotas > 0 ? (totalVendidas / totalCotas) * 100 : 0;
    const qtdConcursos = new Set(boloes.map(b => b.concurso)).size;
    const ticketMedio = boloes.length > 0 ? (boloes.reduce((acc, b) => acc + b.precoVendaCota, 0) / boloes.length) : 0;
    const totalRealizado = boloes.reduce((acc, b) => acc + (b.cotasVendidas * b.precoVendaCota), 0);

    return (
        <div
            className="group flex items-center gap-4 bg-bg-card border border-border rounded-xl px-4 py-3 cursor-pointer transition-all duration-300 hover:border-primary-blue-light/30 hover:bg-surface-subtle/50"
            onClick={onClick}
        >
            {/* Badge da Loteria */}
            <div className="shrink-0 min-w-[160px]">
                <BadgeLoteria
                    nome={jogo}
                    cor={cor}
                    corDestaque={cor}
                    temPlus={config?.temPlus}
                />
            </div>

            {/* Separador */}
            <div className="w-px h-8 bg-border/50 shrink-0" />

            {/* Concursos */}
            <div className="shrink-0 min-w-[100px]">
                <div className="text-[0.55rem] text-text-muted font-bold uppercase tracking-widest mb-0.5">Concursos</div>
                <div className="text-sm font-black text-text-primary">{qtdConcursos}</div>
            </div>

            {/* Separador */}
            <div className="w-px h-8 bg-border/50 shrink-0" />

            {/* Barra de Progresso */}
            <div className="flex-1 min-w-[140px]">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[0.55rem] text-text-muted font-bold uppercase tracking-widest">Vendas</span>
                    <span className="text-xs font-bold text-text-secondary">
                        {totalVendidas}<span className="text-text-muted font-medium">/{totalCotas}</span>
                    </span>
                </div>
                <div className="h-2 bg-bg-dark border border-border/50 rounded-full overflow-hidden">
                    <div
                        className="h-full transition-all duration-700 ease-out rounded-full"
                        style={{ width: `${progressoGeral}%`, background: cor }}
                    />
                </div>
            </div>

            {/* Separador */}
            <div className="w-px h-8 bg-border/50 shrink-0" />

            {/* Progresso % */}
            <div className="shrink-0 min-w-[70px] text-center">
                <div className="text-[0.55rem] text-text-muted font-bold uppercase tracking-widest mb-0.5">Progresso</div>
                <div className={`text-sm font-black ${progressoGeral >= 100 ? 'text-success' : progressoGeral >= 50 ? 'text-accent-orange' : 'text-text-primary'}`}>
                    {Math.round(progressoGeral)}%
                </div>
            </div>

            {/* Separador */}
            <div className="w-px h-8 bg-border/50 shrink-0" />

            {/* Ticket Médio */}
            <div className="shrink-0 min-w-[100px] text-center">
                <div className="text-[0.55rem] text-text-muted font-bold uppercase tracking-widest mb-0.5">Ticket Médio</div>
                <div className="text-sm font-black text-text-primary">
                    R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
            </div>

            {/* Separador */}
            <div className="w-px h-8 bg-border/50 shrink-0" />

            {/* Total Realizado */}
            <div className="shrink-0 min-w-[110px] text-right">
                <div className="text-[0.55rem] text-text-muted font-bold uppercase tracking-widest mb-0.5">Realizado</div>
                <div className="text-sm font-black text-success">
                    R$ {totalRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
            </div>

            {/* Seta */}
            <div className="shrink-0 ml-2">
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{ background: `${cor}20`, color: cor }}
                >
                    <ChevronRight size={16} />
                </div>
            </div>
        </div>
    );
}
