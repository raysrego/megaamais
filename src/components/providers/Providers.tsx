import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { LojaProvider } from '@/contexts/LojaContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { PerfilProvider } from "@/hooks/usePerfil";
import { ToastProvider } from '@/contexts/ToastContext';
import { NotificacoesProvider } from '@/contexts/NotificacoesContext';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { CommandPalette } from '@/components/ui/CommandPalette';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <PerfilProvider>
                    <LojaProvider>
                        <NotificacoesProvider>
                            <ToastProvider>
                                <ConfirmProvider>
                                    <CommandPalette />
                                    {children}
                                </ConfirmProvider>
                            </ToastProvider>
                        </NotificacoesProvider>
                    </LojaProvider>
                </PerfilProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
