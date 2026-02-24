'use client';

import React, { useState, useTransition } from 'react';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { login } from './actions';
import { clearBrowserSupabaseClient } from '@/lib/supabase-browser';
import './login.css';

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    async function handleSubmit(formData: FormData) {
        setError(null);

        // Limpeza preventiva antes de tentar logar
        localStorage.clear();
        sessionStorage.clear();
        clearBrowserSupabaseClient();

        startTransition(async () => {
            const result = await login(formData);
            if (result?.error) {
                setError(result.error);
            } else if (result?.success) {
                // Hard Reload com cache busting
                window.location.href = '/inicio?v=' + Date.now();
            }
        });
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <span className="login-logo">MegaMais</span>
                    <h2 className="login-title">Bem-vindo de volta</h2>
                    <p className="login-subtitle">Acesso Restrito - Gestão de Lotéricas</p>
                </div>

                {error && (
                    <div className="error-message">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form className="login-form" action={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">E-mail</label>
                        <div className="input-wrapper">
                            <Mail size={18} />
                            <input
                                name="email"
                                type="email"
                                className="login-input"
                                placeholder="seu@e-mail.com"
                                required
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Senha</label>
                        <div className="input-wrapper">
                            <Lock size={18} />
                            <input
                                name="password"
                                type="password"
                                className="login-input"
                                placeholder="••••••••"
                                required
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    <button type="submit" className="login-button" disabled={isPending}>
                        {isPending ? <div className="loader" /> : (
                            <>
                                <LogIn size={20} />
                                Acessar Sistema
                            </>
                        )}
                    </button>

                    <div className="mt-8 pt-6 border-t border-border/50 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                localStorage.clear();
                                sessionStorage.clear();
                                if ('serviceWorker' in navigator) {
                                    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
                                }
                                window.location.href = '/login?reset=' + Date.now();
                            }}
                            className="text-xs text-text-secondary hover:text-primary-blue transition-colors flex items-center justify-center gap-2 mx-auto"
                        >
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                            Problemas de acesso? Clique para Limpeza de Sistema
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
