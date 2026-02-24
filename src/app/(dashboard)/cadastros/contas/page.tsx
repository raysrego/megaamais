'use client';
import { Building2, Info } from 'lucide-react';

export default function ContasBancariasPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center p-8 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-surface-subtle rounded-full flex items-center justify-center mb-6">
                <Building2 size={48} className="text-primary-blue-light" />
            </div>
            <h1 className="text-3xl font-black text-text-primary mb-2">Contas Bancárias</h1>
            <p className="text-text-secondary max-w-md mb-8 text-lg">
                Estamos preparando um módulo completo para gestão de suas contas e conciliação bancária.
            </p>
            <div className="badge badge-primary px-4 py-3 text-sm font-bold uppercase tracking-widest bg-primary-blue-light/10 text-primary-blue-light border-primary-blue-light/20">
                Em Breve
            </div>
        </div>
    );
}
