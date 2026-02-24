"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ConfirmOptions {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "info" | "neutral";
}

interface ConfirmModalProps {
    isOpen: boolean;
    options: ConfirmOptions;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({ isOpen, options, onConfirm, onCancel }: ConfirmModalProps) {
    const {
        title,
        description,
        confirmLabel = "Confirmar",
        cancelLabel = "Cancelar",
        variant = "neutral"
    } = options;

    const getConfirmButtonClasses = () => {
        switch (variant) {
            case "danger":
                return "bg-red-600 hover:bg-red-700 text-white";
            case "info":
                return "bg-blue-600 hover:bg-blue-700 text-white";
            default: // neutral
                return "bg-slate-900 hover:bg-slate-800 text-white";
        }
    };

    const getIcon = () => {
        if (variant === "danger") return <AlertTriangle className="w-10 h-10 text-red-500 mb-3 mx-auto" />;
        return <HelpCircle className="w-10 h-10 text-slate-400 mb-3 mx-auto" />;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="relative z-10 w-full max-w-sm bg-white rounded-xl p-6 text-center border border-slate-100 shadow-2xl"
                    >
                        {getIcon()}

                        <h3 className="text-lg font-bold text-slate-800 mb-2">
                            {title}
                        </h3>

                        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                            {description}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={cn(
                                    "px-4 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95",
                                    getConfirmButtonClasses()
                                )}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
