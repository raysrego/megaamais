'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction
}: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center justify-center p-12 text-center"
        >
            <div className="w-20 h-20 bg-primary-blue-light/5 rounded-3xl flex items-center justify-center mb-6 border border-primary-blue-light/10 relative overflow-hidden group">
                {/* Decorative background glow */}
                <div className="absolute inset-0 bg-primary-blue-light/10 blur-2xl group-hover:bg-primary-blue-light/20 transition-colors duration-500" />

                <Icon size={40} className="text-primary-blue-light relative z-10" />
            </div>

            <h3 className="text-xl font-black text-white mb-2 tracking-tight">
                {title}
            </h3>

            <p className="text-sm text-text-muted max-w-[320px] mb-8 font-medium leading-relaxed">
                {description}
            </p>

            {actionLabel && onAction && (
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onAction}
                    className="btn btn-primary px-8 h-11"
                >
                    {actionLabel}
                </motion.button>
            )}

        </motion.div>
    );
}
