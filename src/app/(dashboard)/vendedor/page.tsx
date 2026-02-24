import { Wrench } from 'lucide-react';

export default function VendedorPage() {
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
                width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-blue)'
            }}>
                <Wrench size={40} className="animate-pulse" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Painel do Vendedor em Construção</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Estamos preparando um ambiente exclusivo para seus vendedores acompanharem metas e resultados.
            </p>
        </div>
    );
}
