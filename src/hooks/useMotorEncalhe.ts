'use client';

import { useEffect, useRef } from 'react';
import { getBoloesVencidos, processarEncalheBolao } from '@/actions/boloes';

/**
 * Hook que automatiza o processamento de encalhe.
 * Ele verifica bolões cuja data de sorteio já passou e os processa.
 * Roda apenas uma vez ao montar o componente. Para re-executar, o usuário deve dar refresh.
 */
export function useMotorEncalhe() {
    const isProcessing = useRef(false);

    useEffect(() => {
        async function runMotor() {
            if (isProcessing.current) return;
            isProcessing.current = true;

            try {
                const vencidos = await getBoloesVencidos();
                if (vencidos.length === 0) {
                    isProcessing.current = false;
                    return;
                }

                for (const bolao of vencidos) {
                    try {
                        await processarEncalheBolao(bolao.id);
                    } catch (err) {
                        console.error(`[Motor Encalhe] Erro ao processar Bolão #${bolao.id}:`, err);
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
