'use client';

import { useEffect, useRef } from 'react';
import { getBoloesVencidos, processarEncalheBolao } from '@/actions/boloes';

export function useMotorEncalhe() {
    const isProcessing = useRef(false);

    useEffect(() => {
        async function runMotor() {
            if (isProcessing.current) return;
            isProcessing.current = true;
            try {
                const vencidos = await getBoloesVencidos();
                for (const bolao of vencidos) {
                    try {
                        await processarEncalheBolao(bolao.id);
                    } catch (err) {
                        console.error(`Erro ao processar Bolão #${bolao.id}:`, err);
                    }
                }
            } catch (error) {
                console.error('[Motor Encalhe] Falha crítica:', error);
            } finally {
                isProcessing.current = false;
            }
        }
        runMotor();
    }, []);
}
