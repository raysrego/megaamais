'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number | string;
    onValueChange: (value: number) => void;
    showCurrency?: boolean;
}

export function MoneyInput({
    value,
    onValueChange,
    className,
    showCurrency = true,
    disabled,
    ...props
}: MoneyInputProps) {
    const [displayValue, setDisplayValue] = useState('');

    // Formata o valor numérico para exibição (PT-BR)
    const formatDisplay = (val: number) => {
        return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    useEffect(() => {
        // Sincroniza valor externo com display
        const numericValue = typeof value === 'string' ? parseFloat(value || '0') : value;
        if (!isNaN(numericValue)) {
            setDisplayValue(formatDisplay(numericValue));
        } else {
            setDisplayValue('');
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputValue = e.target.value;

        // Remove tudo que não for dígito
        const digits = inputValue.replace(/\D/g, '');

        // Converte para valor decimal (cents strategy)
        const realValue = parseFloat(digits) / 100;

        if (isNaN(realValue)) {
            onValueChange(0);
            setDisplayValue('0,00');
        } else {
            onValueChange(realValue);
            // O useEffect vai atualizar o displayValue formatado corretamente
        }
    };

    return (
        <div className="relative">
            {showCurrency && (
                <span className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm pointer-events-none transition-colors",
                    disabled ? "text-muted/50" : "text-muted"
                )}>
                    R$
                </span>
            )}
            <input
                type="tel" // Melhor teclado numérico no mobile
                value={displayValue}
                onChange={handleChange}
                disabled={disabled}
                className={cn(
                    "input w-full",
                    showCurrency ? "pl-10" : "",
                    className
                )}
                {...props}
            />
        </div>
    );
}
