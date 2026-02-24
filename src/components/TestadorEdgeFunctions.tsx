'use client';

import { useState } from 'react';
import { useEdgeFunctions } from '@/hooks/useEdgeFunctions';
import { FileText, Download, Loader2, TrendingUp } from 'lucide-react';

/**
 * Componente de teste das Edge Functions
 * Adicione este componente em qualquer página para testar os relatórios
 */
export function TestadorEdgeFunctions() {
    const { gerarRelatorioFinanceiro, gerarRelatorioBoloes, loading, error } = useEdgeFunctions();
    const [resultado, setResultado] = useState<any>(null);

    const testarRelatorioFinanceiro = async () => {
        const res = await gerarRelatorioFinanceiro({
            ano: 2026,
            mes: 2, // Fevereiro
            loja_id: null // Todas as lojas
        });
        setResultado(res);
    };

    const testarRelatorioBoloes = async () => {
        const res = await gerarRelatorioBoloes({
            periodo_inicio: '2026-01-01',
            periodo_fim: '2026-12-31',
            status: null
        });
        setResultado(res);
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 20,
            maxWidth: 400,
            zIndex: 1000,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 900, textTransform: 'uppercase' }}>
                🔧 Testador Edge Functions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                    onClick={testarRelatorioFinanceiro}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '8px 12px', justifyContent: 'flex-start' }}
                >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                    <span style={{ marginLeft: 8 }}>Relatório Financeiro (DRE)</span>
                </button>

                <button
                    onClick={testarRelatorioBoloes}
                    disabled={loading}
                    className="btn btn-success"
                    style={{ fontSize: 12, padding: '8px 12px', justifyContent: 'flex-start' }}
                >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <TrendingUp size={14} />}
                    <span style={{ marginLeft: 8 }}>Relatório Bolões (CMV)</span>
                </button>
            </div>

            {error && (
                <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#ef4444'
                }}>
                    <strong>Erro:</strong> {error}
                </div>
            )}

            {resultado && (
                <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: 8,
                    maxHeight: 300,
                    overflow: 'auto'
                }}>
                    <pre style={{ fontSize: 10, margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(resultado, null, 2)}
                    </pre>
                </div>
            )}

            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
                💡 Certifique-se de fazer o deploy das functions antes de testar
            </p>
        </div>
    );
}
