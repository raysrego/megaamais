'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger'
}: ConfirmDialogProps) {
    const [isConfirming, setIsConfirming] = useState(false);

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            console.error('Erro ao confirmar:', error);
        } finally {
            setIsConfirming(false);
        }
    };

    const variantStyles = {
        danger: {
            icon: '🗑️',
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
            buttonBg: 'bg-red-500 hover:bg-red-600',
        },
        warning: {
            icon: '⚠️',
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-500/10',
            buttonBg: 'bg-yellow-500 hover:bg-yellow-600',
        },
        info: {
            icon: 'ℹ️',
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
            buttonBg: 'bg-blue-500 hover:bg-blue-600',
        }
    };

    const style = variantStyles[variant];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-9999!"
                        onClick={onClose}
                    />

                    {/* Dialog */}
                    <div className="fixed inset-0 flex items-center justify-center z-10000! p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            className="bg-card rounded-2xl max-w-md w-full shadow-2xl border border-white/10"
                            role="dialog"
                            aria-labelledby="confirm-dialog-title"
                            aria-describedby="confirm-dialog-description"
                            aria-modal="true"
                        >
                            {/* Header */}
                            <div className="flex items-start gap-4 p-6 pb-4">
                                <div className={`shrink-0 w-12 h-12 rounded-full ${style.bgColor} flex items-center justify-center`}>
                                    <span className="text-2xl">{style.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <h3
                                        id="confirm-dialog-title"
                                        className="text-lg font-black text-white"
                                    >
                                        {title}
                                    </h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="shrink-0 text-muted hover:text-white transition-colors"
                                    aria-label="Fechar"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 pb-6">
                                <p
                                    id="confirm-dialog-description"
                                    className="text-muted text-sm leading-relaxed"
                                >
                                    {message}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex gap-3 px-6 pb-6">
                                <button
                                    onClick={onClose}
                                    disabled={isConfirming}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-card-hover hover:bg-white/10 text-white font-black text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isConfirming}
                                    className={`flex-1 px-4 py-2.5 rounded-lg ${style.buttonBg} text-white font-black text-sm transition-colors disabled:opacity-50 disabled:cursor-wait`}
                                >
                                    {isConfirming ? 'Processando...' : confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

/**
 * Hook para facilitar o uso do ConfirmDialog
 * 
 * @example
 * const { showConfirm, ConfirmDialogComponent } = useConfirmDialog();
 * 
 * <ConfirmDialogComponent />
 * 
 * <button onClick={() => showConfirm({
 *     title: 'Excluir Bolão',
 *     message: 'Tem certeza que deseja excluir este bolão?',
 *     onConfirm: () => deleteBolao(id)
 * })}>
 *     Excluir
 * </button>
 */
export function useConfirmDialog() {
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void | Promise<void>;
        variant?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'danger'
    });

    const showConfirm = (config: Omit<typeof dialogState, 'isOpen'>) => {
        setDialogState({ ...config, isOpen: true });
    };

    const hideConfirm = () => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
    };

    const ConfirmDialogComponent = () => (
        <ConfirmDialog
            isOpen={dialogState.isOpen}
            onClose={hideConfirm}
            onConfirm={dialogState.onConfirm}
            title={dialogState.title}
            message={dialogState.message}
            variant={dialogState.variant}
        />
    );

    return { showConfirm, hideConfirm, ConfirmDialogComponent };
}
