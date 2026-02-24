'use client';

import React, { useState, useEffect } from 'react';
import { X, Calculator, Coins, DollarSign, Check } from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';

interface Denominacao {
    valor: number;
    label: string;
    tipo: 'cedula' | 'moeda';
}

const DENOMINACOES: Denominacao[] = [
    { valor: 200, label: 'R$ 200', tipo: 'cedula' },
    { valor: 100, label: 'R$ 100', tipo: 'cedula' },
    { valor: 50, label: 'R$ 50', tipo: 'cedula' },
    { valor: 20, label: 'R$ 20', tipo: 'cedula' },
    { valor: 10, label: 'R$ 10', tipo: 'cedula' },
    { valor: 5, label: 'R$ 5', tipo: 'cedula' },
    { valor: 2, label: 'R$ 2', tipo: 'cedula' },
    { valor: 1, label: 'Moedas (Total)', tipo: 'moeda' },
];

interface CalculadoraNumerarioProps {
    onClose: () => void;
    onApply: (total: number) => void;
    valorAtual?: number;
}

export function CalculadoraNumerario({ onClose, onApply, valorAtual }: CalculadoraNumerarioProps) {
    const [quantidades, setQuantidades] = useState<Record<number, string>>({});

    const total = Object.entries(quantidades).reduce((acc, [valor, qtd]) => {
        return acc + (parseFloat(valor) * (parseInt(qtd) || 0));
    }, 0);

    const handleApply = () => {
        onApply(total);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
        }}>
            {/* Overlay */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--overlay-heavy)'
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: 400,
                background: 'var(--bg-card)',
                borderRadius: 24,
                border: '1px solid var(--border)',
                boxShadow: 'none',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-subtle)'
                }}>
                    <div className="flex items-center gap-2">
                        <div style={{
                            width: 32,
                            height: 32,
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6'
                        }}>
                            <Calculator size={18} />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Contagem de Notas</span>
                    </div>
                    <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: '1.25rem',
                    maxHeight: '60vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.05)',
                        padding: '1rem',
                        borderRadius: 16,
                        border: '1px solid rgba(34, 197, 94, 0.1)',
                        textAlign: 'center',
                        marginBottom: '0.5rem'
                    }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Total Contado</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)' }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>

                    {DENOMINACOES.map((den) => (
                        <div key={den.valor} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '0.75rem',
                            background: 'var(--bg-dark)',
                            borderRadius: '12px',
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{
                                width: 44,
                                height: 44,
                                background: den.tipo === 'cedula' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: den.tipo === 'cedula' ? '#3b82f6' : '#eab308',
                                flexShrink: 0
                            }}>
                                {den.tipo === 'cedula' ? <DollarSign size={20} /> : <Coins size={20} />}
                            </div>

                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{den.label}</p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{den.tipo === 'cedula' ? 'Quantidade de cédulas' : 'Valor total em moedas'}</p>
                            </div>

                            {den.tipo === 'moeda' ? (
                                <MoneyInput
                                    value={parseFloat(quantidades[den.valor] || '0')}
                                    onValueChange={(v) => setQuantidades({ ...quantidades, [den.valor]: v.toString() })}
                                    className="w-36 h-11 text-center font-extrabold text-sm"
                                    placeholder="0,00"
                                />
                            ) : (
                                <input
                                    type="number"
                                    value={quantidades[den.valor] || ''}
                                    onChange={(e) => setQuantidades({ ...quantidades, [den.valor]: e.target.value })}
                                    placeholder="0"
                                    style={{
                                        width: 80,
                                        height: 44,
                                        background: 'var(--bg-dark)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                        padding: '0 0.75rem',
                                        textAlign: 'center',
                                        fontWeight: 800,
                                        fontSize: '1rem',
                                        outline: 'none'
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            height: 48,
                            borderRadius: 12,
                            background: 'var(--bg-dark)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        style={{
                            flex: 2,
                            height: 48,
                            borderRadius: 12,
                            background: '#3b82f6',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: 'none'
                        }}
                    >
                        <Check size={18} />
                        Transferir Valor
                    </button>
                </div>
            </div>
        </div>
    );
}


