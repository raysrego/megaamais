'use client';

import React from 'react';
import { DashboardSkeleton } from '../skeletons/DashboardSkeleton';
import { CaixaSkeleton } from '../skeletons/CaixaSkeleton';
import { ListSkeleton } from '../skeletons/ListSkeleton';
import { FormSkeleton } from '../skeletons/FormSkeleton';

type SkeletonType = 'dashboard' | 'caixa' | 'list' | 'form';

interface LoadingStateProps {
    type?: SkeletonType;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ type = 'list' }) => {
    const [showRetry, setShowRetry] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => setShowRetry(true), 10000);
        return () => clearTimeout(timer);
    }, []);

    const content = () => {
        switch (type) {
            case 'dashboard':
                return <DashboardSkeleton />;
            case 'caixa':
                return <CaixaSkeleton />;
            case 'form':
                return <FormSkeleton />;
            case 'list':
            default:
                return <ListSkeleton />;
        }
    };

    return (
        <div className="relative w-full h-full">
            {content()}
            {showRetry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="bg-bg-card p-8 rounded-3xl shadow-2xl text-center max-w-sm mx-4 border border-primary-blue/20">
                        <div className="w-16 h-16 bg-primary-blue/10 text-primary-blue rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-text-primary mb-3">Sincronizando Dados</h3>
                        <p className="text-sm text-text-secondary mb-8 leading-relaxed">
                            O servidor está demorando um pouco mais para validar sua sessão.
                        </p>
                        <button
                            onClick={() => window.location.href = '/inicio?v=' + Date.now()}
                            className="btn btn-primary w-full py-4 rounded-2xl shadow-lg shadow-primary-blue/20"
                        >
                            Forçar Atualização
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
