'use client';

import React from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { BadgeLoteria, LogoLoteria } from '@/components/ui/LogoLoteria';
import { LOTERIAS_OFFICIAL } from '@/data/loterias-config';

interface LotteryConsolidatedCardProps {
    jogo: string;
    cor: string;
    boloes: any[];
    onClick: () => void;
}

export function LotteryConsolidatedCard({ jogo, cor, boloes, onClick }: LotteryConsolidatedCardProps) {
    const slug = Object.keys(LOTERIAS_OFFICIAL).find(key => LOTERIAS_OFFICIAL[key].nome === jogo) || 'megasena';
    const config = LOTERIAS_OFFICIAL[slug];

    const totalCotas = boloes.reduce((acc, b) => acc + b.qtdCotas, 0);
    const totalVendidas = boloes.reduce((acc, b) => acc + b.cotasVendidas, 0);
    const progressoGeral = totalCotas > 0 ? (totalVendidas / totalCotas) * 100 : 0;
    const qtdConcursos = new Set(boloes.map(b => b.concurso)).size;

    // Pega a data de sorteio mais próxima (futura)
    const datasFuturas = boloes
        .map(b => new Date(b.dataSorteio))
        .filter(d => d >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => a.getTime() - b.getTime());

    const dataProximoSorteio = datasFuturas.length > 0 ? datasFuturas[0] : (boloes.length > 0 ? new Date(boloes[0]?.dataSorteio) : null);
    const ticketMedio = boloes.length > 0 ? (boloes.reduce((acc, b) => acc + b.precoVendaCota, 0) / boloes.length) : 0;

    return (
        <div className="card  hover: transition-all duration-300 overflow-hidden cursor-pointer flex flex-col h-full bg-bg-card border-border" onClick={onClick}>
            <div className="bg-surface-subtle p-5 pb-3 flex items-center justify-between border-b border-border">
                <BadgeLoteria
                    nome={jogo}
                    cor={cor}
                    corDestaque={cor}
                    temPlus={config?.temPlus}
                />
                <div className="bg-bg-dark text-text-secondary border border-border font-extrabold text-[0.6rem] px-3 py-1.5 rounded-lg">
                    {qtdConcursos} {qtdConcursos === 1 ? 'Concurso' : 'Concursos'}
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-6">
                    <div className="flex justify-between items-end mb-2.5">
                        <span className="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Vendas Consolidadas</span>
                        <div className="text-right">
                            <span className="text-sm font-black text-text-primary">{totalVendidas}</span>
                            <span className="text-[0.7rem] text-text-muted font-medium ml-1">/ {totalCotas} cotas</span>
                        </div>
                    </div>
                    <div className="h-2.5 bg-bg-dark border border-border rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-700 ease-out" style={{
                            width: `${progressoGeral}%`,
                            background: cor
                        }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-3 rounded-xl bg-bg-dark border border-border/50 text-center">
                        <div className="text-[0.55rem] text-text-muted font-bold uppercase tracking-widest mb-1">Ticket Médio</div>
                        <div className="text-[1.1rem] font-black text-text-primary">
                            R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-success/5 border border-success/10 text-center">
                        <div className="text-[0.55rem] text-success font-bold uppercase tracking-widest mb-1">Status Geral</div>
                        <div className="text-[0.8rem] font-black text-success">
                            {progressoGeral >= 100 ? 'FINALIZADO' : `${Math.round(progressoGeral)}% VENDIDO`}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[0.75rem] text-text-muted mb-6 bg-surface-subtle/50 p-2 rounded-lg border border-border/30 justify-center">
                    <Calendar size={13} className="opacity-60" />
                    <span>Próximo Sorteio: </span>
                    <strong className="text-text-primary font-bold">{dataProximoSorteio ? dataProximoSorteio.toLocaleDateString('pt-BR') : 'A definir'}</strong>
                </div>

                <button
                    className="btn w-full h-11 rounded-xl text-[0.75rem] font-black uppercase tracking-widest  transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] mt-auto"
                    style={{
                        background: cor,
                        color: '#fff'
                    }}
                >
                    <LogoLoteria cor={cor} tamanho={16} temPlus={config?.temPlus} />
                    Gerenciar Modalidade
                    <ChevronRight size={16} className="ml-auto" />
                </button>
            </div>
        </div>
    );
}

