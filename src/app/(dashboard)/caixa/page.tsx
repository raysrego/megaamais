'use client';

import { useEffect, useState } from 'react';
import { LayoutDashboard, Calculator, ShieldCheck, Zap, History } from 'lucide-react';
import { VisaoGestorCaixa } from '@/components/caixa/VisaoGestorCaixa';
import { VisaoOperadorCaixa } from '@/components/caixa/VisaoOperadorCaixa';
import { ModalGestaoCaixa } from '@/components/ModalGestaoCaixa';
import Link from 'next/link';
import { usePerfil } from '@/hooks/usePerfil';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';

type AbaAtiva = 'gestor' | 'operador';

export default function FluxoCaixaPage() {
    const { isAdmin, loading } = usePerfil();
    const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('operador');
    const [showGestaoCaixa, setShowGestaoCaixa] = useState(false);

    // Efeito para setar aba correta assim que carregar perfil
    useEffect(() => {
        if (!loading) {
            if (isAdmin) {
                setAbaAtiva('gestor');
            } else {
                setAbaAtiva('operador');
            }
        }
    }, [isAdmin, loading]);

    if (loading) return <LoadingState type="caixa" />;

    return (
        <div className="dashboard-content">
            <PageHeader
                title="Fluxo de Caixa"            >
                {isAdmin && (
                    <>
                        <button className="btn btn-ghost text-xs" onClick={() => setShowGestaoCaixa(true)}>
                            <Zap size={14} /> Entrada / Saída Manual
                        </button>
                        <Link href="/cofre" className="btn btn-primary text-xs ">
                            <ShieldCheck size={14} /> Gestão de Cofre
                        </Link>
                    </>
                )}
            </PageHeader>

            <ModalGestaoCaixa isOpen={showGestaoCaixa} onClose={() => setShowGestaoCaixa(false)} />

            {/* Seletor de Abas */}
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                <div className="flex gap-2">
                    {isAdmin && (
                        <button
                            onClick={() => setAbaAtiva('gestor')}
                            className={`btn ${abaAtiva === 'gestor' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold`}
                            style={{ borderRadius: '10px' }}
                        >
                            <LayoutDashboard size={16} /> Monitoramento (Gestor)
                        </button>
                    )}
                    <button
                        onClick={() => setAbaAtiva('operador')}
                        className={`btn ${abaAtiva === 'operador' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold`}
                        style={{ borderRadius: '10px' }}
                    >
                        <Calculator size={16} /> Fluxo Operador
                    </button>
                </div>

                {abaAtiva === 'gestor' && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-success/5 rounded-full border border-success/10">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="text-[10px] uppercase font-bold text-success tracking-widest">Live Monitoring Ativo</span>
                    </div>
                )}
            </div>

            {/* Conteúdo Dinâmico */}
            <div className="aba-conteudo animate-in fade-in duration-500">
                {isAdmin && abaAtiva === 'gestor' && <VisaoGestorCaixa />}
                {abaAtiva === 'operador' && <VisaoOperadorCaixa />}
            </div>
        </div>
    );
}



