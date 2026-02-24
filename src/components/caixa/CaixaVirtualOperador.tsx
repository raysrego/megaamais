'use client';

import { useState, useEffect } from 'react';
import { Eye, DollarSign, Calendar } from 'lucide-react';
import { useCaixaBolao } from '@/hooks/useCaixaBolao';

export function CaixaVirtualOperador() {
    const { buscarMinhasVendas } = useCaixaBolao();
    const [vendas, setVendas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregarVendas();
    }, []);

    const carregarVendas = async () => {
        setLoading(true);
        try {
            const data = await buscarMinhasVendas();
            setVendas(data);
        } catch (error) {
            console.error('Erro ao carregar vendas:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalVendido = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const totalDinheiro = vendas.filter(v => v.metodo_pagamento === 'dinheiro').reduce((sum, v) => sum + v.valor_total, 0);
    const totalPix = vendas.filter(v => v.metodo_pagamento === 'pix').reduce((sum, v) => sum + v.valor_total, 0);

    if (loading) {
        return <div className="text-center py-8 text-muted">Carregando vendas...</div>;
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-black mb-2">Minhas Vendas de Bolão</h2>
                <p className="text-sm text-muted">
                    Visualização das suas vendas de cotas (Caixa Virtual)
                </p>
            </div>

            {/* Totalizadores */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-muted" />
                        <span className="text-xs font-bold text-muted uppercase">Total Vendido</span>
                    </div>
                    <p className="text-xl font-black">
                        R$ {totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-xs text-muted">{vendas.length} {vendas.length === 1 ? 'venda' : 'vendas'}</span>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-muted uppercase">💵 Dinheiro</span>
                    </div>
                    <p className="text-xl font-black">
                        R$ {totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-muted uppercase">💳 PIX</span>
                    </div>
                    <p className="text-xl font-black">
                        R$ {totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Info Box */}
            <div className="card p-4 bg-blue-500/5 border-blue-500/20 mb-6">
                <div className="flex items-start gap-3">
                    <Eye size={20} className="text-blue-500 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-muted">
                            <strong>ℹ️ Caixa Virtual:</strong> Você pode visualizar suas vendas de bolão aqui, mas o fechamento
                            consolidado é feito pelo <strong>Operador Admin</strong> ou <strong>Gerente</strong>.
                            Suas vendas serão incluídas automaticamente no fechamento do Caixa Bolão.
                        </p>
                    </div>
                </div>
            </div>

            {/* Lista de Vendas */}
            <div className="card p-6">
                <h3 className="font-bold text-lg mb-4">Vendas de Hoje</h3>

                {vendas.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                        <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Você ainda não realizou vendas de bolão hoje.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {vendas.map((venda) => (
                            <div
                                key={venda.id}
                                className="flex items-center justify-between p-4 rounded-xl bg-white/2 border border-white/5 hover:bg-white/5 transition-colors"
                            >
                                <div>
                                    <p className="font-bold">
                                        Venda #{venda.id.toString().padStart(4, '0')}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {new Date(venda.data_venda).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-lg">
                                        R$ {venda.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${venda.metodo_pagamento === 'dinheiro'
                                            ? 'bg-green-500/10 text-green-500'
                                            : 'bg-blue-500/10 text-blue-500'
                                        }`}>
                                        {venda.metodo_pagamento === 'dinheiro' ? '💵 Dinheiro' : '💳 PIX'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
