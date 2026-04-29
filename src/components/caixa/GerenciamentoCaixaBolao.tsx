'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock, DollarSign, Users, TrendingUp, Eye, RefreshCw } from 'lucide-react';
import { useCaixaBolao } from '@/hooks/useCaixaBolao';
import { usePerfil } from '@/hooks/usePerfil';
import { useToast } from '@/contexts/ToastContext';
import { ModalFechamentoCaixaBolao } from './ModalFechamentoCaixaBolao';

export function GerenciamentoCaixaBolao() {
    const { perfil, isOperador, isGestorBolao, isGerente, isAdmin, podeGerenciarCaixaBolao } = usePerfil();
    const { sessaoAtiva, loading, abrirCaixaBolao, refresh } = useCaixaBolao();
    const { toast } = useToast();
    const [isOpening, setIsOpening] = useState(false);
    const [showModalFechamento, setShowModalFechamento] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 🔄 Escuta o evento de venda realizada para atualizar os totais automaticamente
    useEffect(() => {
        const handleVendaRealizada = () => {
            if (sessaoAtiva) {
                console.log('[CaixaBolao] Venda detectada, atualizando totais...');
                setIsRefreshing(true);
                refresh().finally(() => setIsRefreshing(false));
            }
        };

        window.addEventListener('vendaBolaoRealizada', handleVendaRealizada);
        return () => window.removeEventListener('vendaBolaoRealizada', handleVendaRealizada);
    }, [sessaoAtiva, refresh]);

    // Função manual para atualizar (ícone de reload)
    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refresh();
        setIsRefreshing(false);
        toast({ message: 'Totais atualizados', type: 'success' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue-light"></div>
                <span className="ml-3 text-muted">Carregando caixa bolão...</span>
            </div>
        );
    }

    // ============================================================
    // 1. OPERADOR: apenas visualização (não pode abrir/fechar)
    // ============================================================
    if (isOperador) {
        if (!sessaoAtiva) {
            return (
                <div className="text-center py-12">
                    <Lock size={48} className="mx-auto mb-4 text-muted" />
                    <h3 className="font-bold text-lg mb-2">Caixa Bolão Fechado</h3>
                    <p className="text-muted text-sm">
                        O caixa bolão é aberto automaticamente quando você inicia o turno no caixa geral.
                        <br />
                        <span className="text-xs text-muted">Se o turno foi iniciado e esta mensagem persiste, contate o suporte.</span>
                    </p>
                </div>
            );
        }

        // Operador com sessão ativa – apenas informações (sem botões de ação)
        return (
            <div className="p-6">
                <div className="relative card-premium p-6 bg-linear-to-br from-blue-500/10 to-transparent border-blue-500/20">
                    {/* Botão de atualização manual */}
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                        title="Atualizar totais"
                    >
                        <RefreshCw size={16} className={`text-muted ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <Eye size={24} className="text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg">Caixa Bolão (Visualização)</h3>
                                <p className="text-xs text-muted">
                                    Operador: {perfil?.nome} • Sessão vinculada ao turno
                                </p>
                            </div>
                        </div>
                        <span className="badge success">ATIVO</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-bold text-muted uppercase">Total Vendido</p>
                            <p className="text-2xl font-black text-white">
                                R$ {sessaoAtiva.total_vendido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-bold text-muted uppercase">Dinheiro</p>
                            <p className="text-2xl font-black text-emerald-400">
                                R$ {sessaoAtiva.total_dinheiro?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-bold text-muted uppercase">PIX</p>
                            <p className="text-2xl font-black text-sky-400">
                                R$ {sessaoAtiva.total_pix?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                        <p className="text-xs text-muted">
                            O caixa bolão será consolidado pelo gestor de bolões ou gerente.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================================
    // 2. GESTOR, GERENTE E ADMIN: controle total
    // ============================================================
    if (!podeGerenciarCaixaBolao) {
        return (
            <div className="text-center py-12">
                <Lock size={48} className="mx-auto mb-4 text-muted" />
                <h3 className="font-bold text-lg mb-2">Acesso Restrito</h3>
                <p className="text-muted text-sm">
                    Apenas Gestor de Bolão, Gerente e Administrador podem gerenciar o Caixa Bolão.
                </p>
            </div>
        );
    }

    const handleAbrirCaixa = async () => {
        setIsOpening(true);
        try {
            let tipo = 'op_admin';
            if (isGestorBolao) tipo = 'op_admin';
            else if (isGerente) tipo = 'gerente';
            else if (isAdmin) tipo = 'gerente';
            await abrirCaixaBolao(tipo as any);
            toast({ message: 'Caixa Bolão aberto com sucesso!', type: 'success' });
        } catch (error: any) {
            toast({ message: `Erro ao abrir: ${error.message}`, type: 'error' });
        } finally {
            setIsOpening(false);
        }
    };

    // Estado: caixa FECHADO
    if (!sessaoAtiva) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <h2 className="text-2xl font-black mb-2">Caixa Bolão (Gestão)</h2>
                    <p className="text-sm text-muted">
                        Abra o caixa bolão para registrar e acompanhar vendas de cotas.
                    </p>
                </div>
                <div className="card p-8 text-center">
                    <Lock size={64} className="mx-auto mb-4 text-muted" />
                    <h3 className="font-bold text-xl mb-2">Caixa Bolão Fechado</h3>
                    <p className="text-muted mb-6">
                        Abra o Caixa Bolão para registrar vendas de cotas e bolões.
                        <br />
                        <span className="text-xs">
                            Responsável: {perfil?.nome} (você)
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
            </div>
        );
    }

    // Estado: caixa ABERTO (exibe totais e ações)
    return (
        <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black mb-1">Caixa Bolão (Gestão)</h2>
                    <p className="text-sm text-muted">
                        Gerenciamento de vendas de cotas e bolões
                    </p>
                </div>
                <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    title="Atualizar totais"
                >
                    <RefreshCw size={18} className={`text-muted ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="space-y-4">
                {/* Card principal com totais */}
                <div className="relative card p-6 bg-linear-to-br from-green-500/10 to-blue-500/10 border-green-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                <Unlock size={24} className="text-green-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg">Caixa Bolão Aberto</h3>
                                <p className="text-xs text-muted">
                                    Responsável: {perfil?.nome} ({sessaoAtiva.tipo_responsavel === 'op_admin' ? 'Gestor' : 'Gerente'})
                                </p>
                            </div>
                        </div>
                        <span className="badge success">ATIVO</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign size={16} className="text-muted" />
                                <span className="text-xs font-bold text-muted uppercase">Total Vendido</span>
                            </div>
                            <p className="text-2xl font-black text-white">
                                R$ {sessaoAtiva.total_vendido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Users size={16} className="text-muted" />
                                <span className="text-xs font-bold text-muted uppercase">Dinheiro</span>
                            </div>
                            <p className="text-2xl font-black text-emerald-400">
                                R$ {sessaoAtiva.total_dinheiro?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={16} className="text-muted" />
                                <span className="text-xs font-bold text-muted uppercase">PIX</span>
                            </div>
                            <p className="text-2xl font-black text-sky-400">
                                R$ {sessaoAtiva.total_pix?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Botões de ação */}
                <div className="flex gap-3">
                    <button
                        className="btn btn-ghost flex-1 h-14"
                        onClick={() => {
                            // Exibir modal com histórico de vendas (pode implementar depois)
                            toast({ message: 'Funcionalidade em desenvolvimento', type: 'info' });
                        }}
                    >
                        Ver Vendas Consolidadas
                    </button>
                    <button
                        className="btn btn-danger flex-1 h-14 font-black"
                        onClick={() => setShowModalFechamento(true)}
                    >
                        Encerrar Caixa Bolão
                    </button>
                </div>

                {/* Info box */}
                <div className="card p-4 bg-blue-500/5 border-blue-500/20">
                    <p className="text-xs text-muted">
                        <strong>ℹ️ Importante:</strong> O Caixa Bolão consolida vendas de TODOS os operadores vinculados a esta sessão (se for gestor) ou somente suas vendas (se for operador). Ao encerrar, você prestará conta de todas as vendas realizadas durante esta sessão.
                    </p>
                </div>
            </div>

            {/* Modal de fechamento */}
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
