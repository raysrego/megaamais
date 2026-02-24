import { BarChart2 } from 'lucide-react';

export default function ProdutividadePage() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
            textAlign: 'center',
            background: 'var(--bg-card)',
            borderRadius: '24px',
            border: '1px dashed var(--border)',
            minHeight: '60vh',
            marginTop: '2rem'
        }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: '#10b981'
            }}>
                <BarChart2 size={40} className="animate-pulse" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Produtividade TFL em Desenvolvimento</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Métricas avançadas e análise de produtividade estarão disponíveis aqui em breve.
            </p>
        </div>
    );
}
