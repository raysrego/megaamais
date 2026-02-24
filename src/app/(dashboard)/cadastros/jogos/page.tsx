'use client';
import { Ticket, Info } from 'lucide-react';

export default function JogosPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center p-8 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-surface-subtle rounded-full flex items-center justify-center mb-6">
                <Ticket size={48} className="text-primary-purple" />
            </div>
            <h1 className="text-3xl font-black text-text-primary mb-2">Jogos & Modalidades</h1>
            <p className="text-text-secondary max-w-md mb-8 text-lg">
                O gerenciamento de jogos, tipos de aposta e regras será centralizado aqui.
            </p>
            <div className="badge badge-primary px-4 py-3 text-sm font-bold uppercase tracking-widest bg-primary-purple/10 text-primary-purple border-primary-purple/20">
                Em Breve
            </div>
        </div>
    );
}
