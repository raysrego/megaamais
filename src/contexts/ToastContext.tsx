"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Toast, ToastContainer, ToastProps, ToastType } from "@/components/ui/Toast";

interface ToastContextType {
    toast: (payload: { message: string; type?: ToastType; duration?: number }) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback(
        ({ message, type = "info", duration = 5000 }: { message: string; type?: ToastType; duration?: number }) => {
            const id = Date.now().toString() + Math.random().toString().slice(2);
            const newToast: ToastProps = {
                id,
                message,
                type,
                duration,
                onDismiss: removeToast,
            };

            // Add new toast to the top of the stack
            setToasts((prev) => [newToast, ...prev]);
        },
        [removeToast]
    );

    return (
        <ToastContext.Provider value={{ toast, removeToast }}>
            {children}
            <ToastContainer>
                {toasts.map((t) => (
                    <Toast key={t.id} {...t} />
                ))}
            </ToastContainer>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
