"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onDismiss: (id: string) => void;
}

const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
};

const bgColors = {
    success: "bg-emerald-50/90 border-emerald-100",
    error: "bg-red-50/90 border-red-100",
    warning: "bg-amber-50/90 border-amber-100",
    info: "bg-blue-50/90 border-blue-100",
};

export function Toast({ id, message, type, duration = 5000, onDismiss }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onDismiss]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={cn(
                "flex items-start gap-3 p-4 pr-10 rounded-lg border pointer-events-auto min-w-[300px] max-w-md",
                bgColors[type]
            )}
        >
            <div className="shrink-0 mt-0.5">{icons[type]}</div>
            <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{message}</p>
            </div>
            <button
                onClick={() => onDismiss(id)}
                className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

export function ToastContainer({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed top-4 right-4 z-9999 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">{children}</AnimatePresence>
        </div>
    );
}
