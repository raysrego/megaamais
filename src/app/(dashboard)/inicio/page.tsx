'use client';

import { usePerfil } from '@/hooks/usePerfil';
import { useLoja } from '@/contexts/LojaContext';
import Link from 'next/link';
import {
    LayoutDashboard,
    Ticket,
    Wallet,
    ShieldCheck,
    ChevronRight,
    DollarSign,
    Monitor,
    Calendar,
    UserCog,
    FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';

export default function InicioPage() {
    const { perfil, loading: loadingPerfil } = usePerfil();
    const { lojaAtual, loading: loadingLoja } = useLoja();

    if (loadingPerfil || loadingLoja) {
        return <LoadingState type="dashboard" />;
    }

    const firstName = perfil?.nome?.split(' ')[0] || 'Usuário';
    const isAdmin = perfil?.role === 'admin';
    const isGerente = perfil?.role === 'gerente';
    const isOperador = perfil?.role === 'operador';

    const roleDisplay = isAdmin ? 'Administrador Master' : (isGerente ? 'Gerente' : 'Operador');

    return (
        <div className="dashboard-content pb-16">
            {/* Premium Welcome Card (Static & Clean) */}
            <div
                className="mb-12 overflow-hidden rounded-[2rem] border border-white/10 bg-linear-to-br from-primary-blue to-primary-blue-light p-10"
            >
                <div className="relative z-10 flex flex-col gap-2">
                    <h1 className="m-0 text-4xl font-black tracking-tighter text-white">
                        Olá, {firstName}!
                    </h1>
                    <div className="flex items-center gap-2 text-xl font-medium text-white/90">
                        Você está no comando como <strong className="font-black text-white px-2 py-0.5 bg-white/10 rounded-lg">{roleDisplay}</strong>
                        {isAdmin ? (
                            <span> de <strong>todas as unidades</strong></span>
                        ) : (
                            lojaAtual && <span> na unidade <strong>{lojaAtual.nome_fantasia}</strong></span>
                        )}.
                    </div>
                </div>

                {/* Decorative background element (Static) */}
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
            </div>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Módulos de Ativação</h2>
                </div>
                <div className="flex gap-2">
                    <div className="px-4 py-2 bg-surface-subtle border border-border rounded-lg text-xs text-text-secondary font-semibold">
                        Beta v2.5.22
                    </div>
                </div>
            </div>

            {/* Grid de Cards Estilizados */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">

                {/* Fluxo de Caixa */}
                <Link href="/caixa" className="no-underline">
                    <div className="kpi-card h-full p-8 cursor-pointer transition-all duration-300 flex flex-col group hover:border-primary-blue-light hover:-translate-y-1 hover:-[0_15px_30px_rgba(0,0,0,0.1)]">
                        <div className="w-16 h-16 bg-primary-blue-light/10 text-primary-blue-light rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-primary-blue-light group-hover:text-white">
                            <Wallet size={32} />
                        </div>
                        <h3 className="text-[1.4rem] font-bold text-text-primary mb-3">Fluxo de Caixa</h3>
                        <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                            Gerencie terminais, realize sangrias, reforços e o fechamento diário da unidade.
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-primary-blue-light font-bold text-[0.9rem]">
                            Iniciar Operações <ChevronRight size={18} />
                        </div>
                    </div>
                </Link>

                {/* Gestão de Bolões */}
                <Link href="/boloes" className="no-underline">
                    <div className="kpi-card h-full p-8 cursor-pointer transition-all duration-300 flex flex-col group hover:border-chart-2 hover:-translate-y-1 hover:-[0_15px_30px_rgba(0,0,0,0.1)]">
                        <div className="w-16 h-16 bg-chart-2/10 text-chart-2 rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-chart-2 group-hover:text-white">
                            <Ticket size={32} />
                        </div>
                        <h3 className="text-[1.4rem] font-bold text-text-primary mb-3">Bolões & Cotas</h3>
                        <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                            Controle de estoque de bolões oficiais, reserva de cotas e monitoramento de loterias.
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-chart-2 font-bold text-[0.9rem]">
                            Ver Disponibilidade <ChevronRight size={18} />
                        </div>
                    </div>
                </Link>

                {/* Calendário de Sorteios (Todos) */}
                <Link href="/calendario" className="no-underline">
                    <div className="kpi-card h-full p-8 cursor-pointer transition-all duration-300 flex flex-col group hover:border-danger hover:-translate-y-1 hover:-[0_15px_30px_rgba(0,0,0,0.1)]">
                        <div className="w-16 h-16 bg-danger/10 text-danger rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-danger group-hover:text-white">
                            <Calendar size={32} />
                        </div>
                        <h3 className="text-[1.4rem] font-bold text-text-primary mb-3">Calendário Sorteios</h3>
                        <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                            Consulte as datas, horários e resultados dos principais sorteios das loterias.
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-danger font-bold text-[0.9rem]">
                            Ver Calendário <ChevronRight size={18} />
                        </div>
                    </div>
                </Link>

                {/* Painel Vendedor (Todos) */}
                <Link href="/vendedor" className="no-underline">
                    <div className="kpi-card h-full p-8 cursor-pointer transition-all duration-300 flex flex-col group hover:border-warning hover:-translate-y-1 hover:-[0_15px_30px_rgba(0,0,0,0.1)]">
                        <div className="w-16 h-16 bg-warning/10 text-warning rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-warning group-hover:text-white">
                            <UserCog size={32} />
                        </div>
                        <h3 className="text-[1.4rem] font-bold text-text-primary mb-3">Painel Vendedor</h3>
                        <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                            Metas individuais, ranking de vendas e ferramentas de produtividade do vendedor.
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-warning font-bold text-[0.9rem]">
                            Acessar Painel <ChevronRight size={18} />
                        </div>
                    </div>
                </Link>

                {/* Produtividade TFL (Admin/Gerente) */}
                {(isAdmin || isGerente) && (
                    <Link href="/produtividade" className="no-underline">
                        <div className="kpi-card h-full p-8 cursor-pointer transition-all duration-300 flex flex-col group hover:border-accent-orange hover:-translate-y-1 hover:-[0_15px_30px_rgba(0,0,0,0.1)]">
                            <div className="w-16 h-16 bg-accent-orange/10 text-accent-orange rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-accent-orange group-hover:text-white">
                                <Monitor size={32} />
                            </div>
                            <h3 className="text-[1.4rem] font-bold text-text-primary mb-3">Produtividade TFL</h3>
                            <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                                Analise a eficiência dos terminais, volume de jogos e performance em tempo real.
                            </p>
                            <div className="mt-auto flex items-center gap-2 text-accent-orange font-bold text-[0.9rem]">
                                Ver Produtividade <ChevronRight size={18} />
                            </div>
                        </div>
                    </Link>
                )}

                {/* Relatórios (Admin/Gerente) */}
                {(isAdmin || isGerente) && (
                    <Link href="/relatorios" className="no-underline">
                        <div className="kpi-card h-full p-8 cursor-pointer transition-all duration-300 flex flex-col group hover:border-chart-2 hover:-translate-y-1 hover:-[0_15px_30px_rgba(0,0,0,0.1)]">
                            <div className="w-16 h-16 bg-chart-2/10 text-chart-2 rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-chart-2 group-hover:text-white">
                                <FileText size={32} />
                            </div>
                            <h3 className="text-[1.4rem] font-bold text-text-primary mb-3">Relatórios</h3>
                            <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                                Histórico de faturamento, comparativos e exportação de dados analíticos.
                            </p>
                            <div className="mt-auto flex items-center gap-2 text-chart-2 font-bold text-[0.9rem]">
                                Analisar Dados <ChevronRight size={18} />
                            </div>
                        </div>
                    </Link>
                )}

                {/* Financeiro (Admin/Gerente) */}
                {(isAdmin || isGerente) && (
                    <Link href="/financeiro" className="no-underline">
                        <div className="kpi-card h-full p-8 cursor-pointer transition-all duration-300 flex flex-col group hover:border-success hover:-translate-y-1 hover:-[0_15px_30px_rgba(0,0,0,0.1)]">
                            <div className="w-16 h-16 bg-success/10 text-success rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-success group-hover:text-white">
                                <DollarSign size={32} />
                            </div>
                            <h3 className="text-[1.4rem] font-bold text-text-primary mb-3">Financeiro</h3>
                            <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                                Gestão de contas, tesouraria, despesas e acompanhamento de saldos.
                            </p>
                            <div className="mt-auto flex items-center gap-2 text-success font-bold text-[0.9rem]">
                                Acessar Financeiro <ChevronRight size={18} />
                            </div>
                        </div>
                    </Link>
                )}

                {/* Painel Executivo (Admin) */}
                {isAdmin && (
                    <Link href="/" className="no-underline">
                        <div className="kpi-card h-full p-8 border-2 border-primary-blue-light/30 bg-primary-blue-light/5 cursor-pointer transition-all duration-300 flex flex-col group hover:border-primary-blue-light hover:-translate-y-1 hover:-[0_15px_30px_rgba(var(--primary-blue-rgb),0.2)]">
                            <div className="w-16 h-16 bg-linear-to-br from-primary-blue to-primary-blue-light text-white rounded-2xl flex items-center justify-center mb-6  -primary-blue/20">
                                <LayoutDashboard size={32} />
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-[1.4rem] font-bold text-text-primary m-0">Painel Executivo</h3>
                                <div className="badge success px-2 py-1">Master</div>
                            </div>
                            <p className="text-[0.95rem] text-text-secondary leading-relaxed mb-8">
                                Monitoramento estratégico global de faturamento, metas e performance de rede.
                            </p>
                            <div className="mt-auto flex items-center gap-2 text-primary-blue-light font-bold text-[0.9rem]">
                                Abrir Dashboard Master <ChevronRight size={18} />
                            </div>
                        </div>
                    </Link>
                )}
            </div>

            {/* Footer de Suporte */}
            <div className="mt-16 flex justify-center">
                <div className="bg-surface-subtle px-12 py-6 rounded-full border border-border flex items-center gap-8 text-text-muted text-[0.85rem]">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-500" /> Segurança MegaMais Ativa
                    </div>
                    <div className="w-px h-5 bg-border" />
                    <Link href="/configuracoes" className="text-text-primary font-semibold no-underline hover:underline">Suporte Técnico</Link>
                </div>
            </div>
        </div>
    );
}

