'use client';

import { useState } from 'react';
import { Lock, Unlock, DollarSign, Users, TrendingUp } from 'lucide-react';
import { useCaixaBolao } from '@/hooks/useCaixaBolao';
import { usePerfil } from '@/hooks/usePerfil';
import { useToast } from '@/contexts/ToastContext';
import { ModalFechamentoCaixaBolao } from './ModalFechamentoCaixaBolao';

export function GerenciamentoCaixaBolao() {
    const { perfil, podeGerenciarCaixaBolao, isOpAdmin, isGerente } = usePerfil();
    const { sessaoAtiva, loading, abrirCaixaBolao, refresh } = useCaixaBolao();
    const { toast } = useToast();
    const [isOpening, setIsOpening] = useState(false);
    const [showModalFechamento, setShowModalFechamento] = useState(false);

    if (loading) {
        return <div className="text-center py-8 text-muted">Carregando...</div>;
    }

    if (!podeGerenciarCaixaBolao) {
        return (
            <div className="text-center py-12">
                <Lock size={48} className="mx-auto mb-4 text-muted" />
                <h3 className="font-bold text-lg mb-2">Acesso Restrito</h3>
                <p className="text-muted text-sm">
                    Apenas Operador Admin e Gerente podem gerenciar o Caixa Bolão.
                </p>
            </div>
        );
    }

    const handleAbrirCaixa = async () => {
        setIsOpening(true);
        try {
            const tipo = isOpAdmin ? 'op_admin' : 'gerente';
            await abrirCaixaBolao(tipo);
            toast({ message: 'Caixa Bolão aberto com sucesso!', type: 'success' });
        } catch (error: any) {
            console.error('Erro ao abrir Caixa Bolão:', error);
            toast({ message: `Erro ao abrir: ${error.message}`, type: 'error' });
        } finally {
            setIsOpening(false);
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-black mb-2">Caixa Bolão</h2>
                <p className="text-sm text-muted">
                    Gerenciamento de vendas de cotas e bolões
                    {!sessaoAtiva && ' - Abra o caixa para começar'}
                </p>
            </div>

            {!sessaoAtiva ? (
                // Caixa Fechado
                <div className="card p-8 text-center">
                    <Lock size={64} className="mx-auto mb-4 text-muted" />
                    <h3 className="font-bold text-xl mb-2">Caixa Bolão Fechado</h3>
                    <p className="text-muted mb-6">
                        Abra o Caixa Bolão para registrar vendas de cotas e bolões.
                        <br />
                        <span className="text-xs">
                            Você ({perfil?.nome}) será responsável por consolidar TODAS as vendas.
                        </span>
                    </p>
                    <button
                        className="btn btn-primary w-full max-w-md mx-auto h-14"
                        onClick={handleAbrirCaixa}
                        disabled={isOpening}
                    >
                        <Unlock size={20} />
                        {isOpening ? 'Abrindo...' : 'Abrir Caixa Bolão'}
                    </button>
                </div>
            ) : (
                // Caixa Aberto
                <div className="space-y-4">
                    {/* Status Card */}
                    <div className="card p-6 bg-linear-to-br from-green-500/10 to-blue-500/10 border-green-500/20">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Unlock size={24} className="text-green-500" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg">Caixa Bolão Aberto</h3>
                                    <p className="text-xs text-muted">
                                        Responsável: {perfil?.nome} ({sessaoAtiva.tipo_responsavel === 'op_admin' ? 'Op. Admin' : 'Gerente'})
                                    </p>
                                </div>
                            </div>
                            <span className="badge success">ATIVO</span>
                        </div>

                        {/* Totalizadores */}
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign size={16} className="text-muted" />
                                    <span className="text-xs font-bold text-muted uppercase">Total Vendido</span>
                                </div>
                                <p className="text-2xl font-black">
                                    R$ {sessaoAtiva.total_vendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users size={16} className="text-muted" />
                                    <span className="text-xs font-bold text-muted uppercase">Dinheiro</span>
                                </div>
                                <p className="text-2xl font-black">
                                    R$ {sessaoAtiva.total_dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp size={16} className="text-muted" />
                                    <span className="text-xs font-bold text-muted uppercase">PIX</span>
                                </div>
                                <p className="text-2xl font-black">
                                    R$ {sessaoAtiva.total_pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3">
                        <button className="btn btn-ghost flex-1 h-14">
                            Ver Vendas Consolidadas
                        </button>
                        <button
                            className="btn btn-danger flex-1 h-14 font-black"
                            onClick={() => setShowModalFechamento(true)}
                        >
                            Encerrar Caixa Bolão
                        </button>
                    </div>

                    {/* Informações Adicionais */}
                    <div className="card p-4 bg-blue-500/5 border-blue-500/20">
                        <p className="text-xs text-muted">
                            <strong>ℹ️ Importante:</strong> O Caixa Bolão consolida vendas de TODOS os operadores.
                            Ao encerrar, você prestará conta de todas as vendas realizadas durante esta sessão.
                        </p>
                    </div>
                </div>
            )}

            {/* Modal de Fechamento */}
            {showModalFechamento && sessaoAtiva && (
                <ModalFechamentoCaixaBolao
                    sessao={sessaoAtiva}
                    onClose={() => setShowModalFechamento(false)}
                    onSuccess={() => {
                        setShowModalFechamento(false);
                        refresh();
                    }}
                />
            )}
        </div>
    );
}
