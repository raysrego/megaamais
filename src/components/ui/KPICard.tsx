import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
    label: string;
    value: string | number | React.ReactNode;
    icon: LucideIcon;
    trend?: {
        value: string | number;
        description?: string;
        direction?: 'up' | 'down' | 'neutral';
    };
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'primary';
    loading?: boolean;
    onClick?: () => void;
    className?: string;
    compact?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
    label,
    value,
    icon: Icon,
    trend,
    variant = 'default',
    loading = false,
    onClick,
    className = "",
    compact = false
}) => {
    // Mapeamento de variantes para cores
    const variants = {
        default: 'text-primary-blue-light bg-primary-blue-light/10',
        primary: 'text-primary-blue-light bg-primary-blue-light/10',
        success: 'text-success bg-success/10',
        warning: 'text-warning bg-warning/10',
        danger: 'text-danger bg-danger/10',
        accent: 'text-accent-orange bg-accent-orange/10'
    };

    if (loading) {
        return (
            <div className={`bg-bg-card border border-border ${compact ? 'rounded-xl p-3' : 'rounded-2xl p-5'} animate-pulse ${className}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="h-3 w-24 bg-border rounded" />
                    <div className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} bg-border rounded-xl`} />
                </div>
                <div className={`${compact ? 'h-5 w-24' : 'h-8 w-32'} bg-border rounded mb-2`} />
                <div className="h-3 w-20 bg-border rounded" />
            </div>
        );
    }

    return (
        <div
            className={`bg-bg-card border border-border ${compact ? 'rounded-xl p-3' : 'rounded-2xl p-5'} transition-all duration-300 group hover:border-primary-blue-light/30 ${onClick ? 'cursor-pointer hover:translate-y-[-4px]' : ''} ${className}`}
            onClick={onClick}
        >
            <div className={`flex justify-between items-start ${compact ? 'mb-1.5' : 'mb-3'}`}>
                <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-[0.15em] text-text-muted transition-colors group-hover:text-text-secondary`}>
                    {label}
                </span>
                <div className={`${compact ? 'w-7 h-7 rounded-lg' : 'w-10 h-10 rounded-xl'} flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${variants[variant as keyof typeof variants] || variants.default}`}>
                    <Icon size={compact ? 14 : 20} />
                </div>
            </div>

            <div className={`${compact ? 'text-lg' : 'text-2xl'} font-black text-text-primary tracking-tight mb-1`}>
                {value}
            </div>

            {trend && (
                <div className={`flex items-center gap-1.5 ${compact ? 'mt-1' : 'mt-2'}`}>
                    <div className={`flex items-center gap-0.5 ${compact ? 'text-[0.6rem]' : 'text-[0.7rem]'} font-bold px-1.5 py-0.5 rounded-lg ${trend.direction === 'up' ? 'text-success bg-success/10' :
                        trend.direction === 'down' ? 'text-danger bg-danger/10' :
                            'text-text-muted bg-surface-subtle'
                        }`}>
                        {trend.direction === 'up' && <TrendingUp size={compact ? 8 : 10} />}
                        {trend.direction === 'down' && <TrendingDown size={compact ? 8 : 10} />}
                        {trend.direction === 'neutral' && <Minus size={compact ? 8 : 10} />}
                        {trend.value}
                    </div>
                    {trend.description && (
                        <span className={`${compact ? 'text-[0.55rem]' : 'text-[0.65rem]'} text-text-muted font-medium italic`}>
                            {trend.description}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
