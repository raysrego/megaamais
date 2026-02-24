'use client';

/**
 * DevBadge - Indicador visual de Ambiente de Desenvolvimento
 * 
 * Mostra um badge "DEV" fixo no canto inferior-esquerdo quando
 * a variável NEXT_PUBLIC_ENV_LABEL está definida como "DEV".
 * 
 * Em produção (Vercel), essa variável não existe, então o badge
 * simplesmente não renderiza.
 */
export default function DevBadge() {
    const envLabel = process.env.NEXT_PUBLIC_ENV_LABEL;

    if (!envLabel) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '12px',
                left: '12px',
                zIndex: 9999,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#000',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                fontFamily: 'monospace',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
                userSelect: 'none',
                opacity: 0.85,
            }}
        >
            ⚠ {envLabel}
        </div>
    );
}
