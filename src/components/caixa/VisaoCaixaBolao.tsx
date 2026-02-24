'use client';

import {
    Ticket
} from 'lucide-react';

export function VisaoCaixaBolao() {
    return (
        <div className="visao-bolao-container fade-in animate-in">
            <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 grayscale opacity-20">
                    <Ticket size={32} />
                </div>
                <h3 className="text-lg font-bold mb-2">Visualização em Manutenção</h3>
                <p className="text-sm text-muted">
                    Esta visão está sendo migrada para o novo sistema de dados reais.
                    <br />
                    Em breve estará disponível novamente.
                </p>
            </div>
        </div>
    );
}

