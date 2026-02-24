'use client';

import React from 'react';
import { Clover, Plus } from 'lucide-react';

interface LogoLoteriaProps {
    cor?: string;
    corDestaque?: string;
    tamanho?: number;
    temPlus?: boolean;
}

/**
 * Renderiza o ícone de trevo da Lucide React com as cores da loteria.
 */
export function LogoLoteria({
    cor = '#209869',
    corDestaque = '#B5DBAA',
    tamanho = 32,
    temPlus = false
}: LogoLoteriaProps) {
    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: tamanho, height: tamanho }}>
            <Clover
                size={tamanho}
                color="white"
                strokeWidth={2.5}
            />

            {temPlus && (
                <div style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    background: cor,
                    borderRadius: '50%',
                    padding: '1px',
                    border: '1.5px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Plus size={tamanho * 0.4} color="white" strokeWidth={4} />
                </div>
            )}
        </div>
    );
}

/**
 * Card Header Badge estilizado conforme a imagem
 */
export function BadgeLoteria({
    nome,
    cor,
    corDestaque,
    temPlus
}: {
    nome: string,
    cor: string,
    corDestaque: string,
    temPlus?: boolean
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: cor,
            padding: '8px 24px 8px 12px',
            borderRadius: '0 24px 24px 0',
            width: 'fit-content',
            minWidth: '220px',
            boxShadow: 'none'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <LogoLoteria cor={cor} corDestaque={cor} tamanho={32} temPlus={temPlus} />
            </div>
            <span style={{
                color: '#FFF',
                fontSize: '1.25rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                fontStyle: 'italic',
                letterSpacing: '-0.02em',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                {nome}
            </span>
        </div>
    );
}


