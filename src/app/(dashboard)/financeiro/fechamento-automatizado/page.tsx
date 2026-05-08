'use client';

import { FechamentoCaixaAutomatizado } from '@/components/financeiro/FechamentoCaixaAutomatizado';
import { usePerfil } from '@/hooks/usePerfil';
import { LoadingState } from '@/components/ui/LoadingState';
import { ShieldOff } from 'lucide-react';

export default function FechamentoAutomatizadoPage() {
    const { isAdmin, loading } = usePerfil();

    if (loading) {
        return (
            <div className="dashboard-content">
                <LoadingState />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="dashboard-content">
                <div className="flex flex-col items-center justify-center gap-4 py-24 text-text-muted">
                    <ShieldOff size={48} strokeWidth={1.2} />
                    <p className="text-lg font-semibold">Acesso restrito</p>
                    <p className="text-sm">Esta página é exclusiva para usuários master.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-content">
            <FechamentoCaixaAutomatizado />
        </div>
    );
}
