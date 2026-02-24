'use client';

import { useState } from 'react';
import {
    Plus,
    Ticket,
    TrendingUp,
    AlertCircle,
    Calendar,
    DollarSign,
    ChevronRight,
    MoreVertical,
    LayoutGrid,
    List
} from 'lucide-react';
import { ModalListaBoloes } from '@/components/boloes/ModalListaBoloes';
import { ModalNovoBolao } from '@/components/boloes/ModalNovoBolao';
import { LotteryConsolidatedCard } from '@/components/boloes/LotteryConsolidatedCard';
import { LotteryListRow } from '@/components/boloes/LotteryListRow';
import { SalesAuditTab } from '@/components/boloes/SalesAuditTab';
import { OperatorSettlementTab } from '@/components/boloes/OperatorSettlementTab';
import { getBoloes, getProdutos } from '@/actions/boloes';
import { useEffect } from 'react';
import { usePerfil } from '@/hooks/usePerfil';
import { useLoja } from '@/contexts/LojaContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { KPICard } from '@/components/ui/KPICard';
import { LoadingState } from '@/components/ui/LoadingState';

type TabType = 'geral' | 'auditoria' | 'acerto';
type ViewMode = 'card' | 'list';

export default function GestaoBoloesPage() {
    const { podeGerenciarCaixaBolao: canManageBoloes, isAdmin: isAdminOrGerente } = usePerfil();
    const { lojaAtual } = useLoja();
    const [activeTab, setActiveTab] = useState<TabType>('geral');
    const [boloes, setBoloes] = useState<any[]>([]);
    const [produtos, setProdutos] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedGame, setSelectedGame] = useState<{ jogo: string, cor: string } | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('card');

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Carrega produtos (loterias) e bolões da LOJA ATUAL
            const [dataProdutos, dataBoloes] = await Promise.all([
                getProdutos(lojaAtual?.id),
                getBoloes({ lojaId: lojaAtual?.id })
            ]);

            setProdutos(dataProdutos);
            setBoloes(dataBoloes);
        } catch (err: any) {
            console.error('Falha ao carregar dados:', err);
            setBoloes([]);
            setProdutos([]);
            setError(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [lojaAtual]);

    const handleAddBolao = (novoBolao: any) => {
        setBoloes(prev => [novoBolao, ...prev]);
        // Recarregar dados para garantir sincronia completa
        loadData();
    };

    const totalRealizado = boloes.reduce((acc, b) => acc + (b.cotasVendidas * b.precoVendaCota), 0);
    const totalVendido = boloes.reduce((acc, b) => acc + b.cotasVendidas, 0);
    const valorAVender = boloes.reduce((acc, b) => acc + ((b.qtdCotas - b.cotasVendidas) * b.precoVendaCota), 0);

    const totalComissao = boloes.reduce((acc, b) => {
        const comissaoUnit = (b.valorCotaBase * b.taxaAdministrativa) / 100;
        return acc + (b.cotasVendidas * comissaoUnit);
    }, 0);

    const totalEncalhe = boloes.reduce((acc, b) => {
        const custoBase = b.valorCotaBase;
        const cotasRestantes = b.qtdCotas - b.cotasVendidas;
        return acc + (cotasRestantes * custoBase);
    }, 0);

    return (
        <div className="dashboard-content">
            <PageHeader
                title="Bolões & Loterias"
            >
                {canManageBoloes && (
                    <button className="btn btn-accent " onClick={() => setShowNewModal(true)}>
                        <Plus size={16} /> Novo Bolão
                    </button>
                )}
            </PageHeader>

            {/* Seletor de Abas */}
            <div className="flex gap-2 mb-8 border-b border-white/5 pb-6">
                <button
                    onClick={() => setActiveTab('geral')}
                    className={`btn ${activeTab === 'geral' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold transition-all`}
                    style={{ borderRadius: '10px' }}
                >
                    <Ticket size={16} /> Visão Geral (Loterias)
                </button>
                <button
                    onClick={() => setActiveTab('auditoria')}
                    className={`btn ${activeTab === 'auditoria' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold transition-all`}
                    style={{ borderRadius: '10px' }}
                >
                    <TrendingUp size={16} /> Auditoria de Vendas
                </button>
                {canManageBoloes && (
                    <button
                        onClick={() => setActiveTab('acerto')}
                        className={`btn ${activeTab === 'acerto' ? 'btn-primary' : 'btn-ghost'} h-[42px] px-6 text-xs font-bold transition-all`}
                        style={{ borderRadius: '10px' }}
                    >
                        <DollarSign size={16} /> Acerto & Gestão (Master)
                    </button>
                )}
            </div>

            {activeTab === 'geral' ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5 translate-y-[-10px] animate-in fade-in slide-in-from-top-4 duration-500">
                        <KPICard
                            label="TOTAL REALIZADO"
                            value={`R$ ${totalRealizado.toLocaleString('pt-BR')}`}
                            icon={DollarSign}
                            trend={{ value: 'Total', direction: 'neutral', description: 'Arrecadação bruta' }}
                            compact
                        />

                        <KPICard
                            label="VENDIDO"
                            value={`${totalVendido} Cotas`}
                            icon={Ticket}
                            trend={{ value: 'Vendas', direction: 'up', description: 'Cotas totais' }}
                            variant="success"
                            compact
                        />

                        <KPICard
                            label="A VENDER"
                            value={`R$ ${valorAVender.toLocaleString('pt-BR')}`}
                            icon={AlertCircle}
                            trend={{ value: 'Restante', direction: 'neutral', description: 'Potencial de venda' }}
                            variant="accent"
                            compact
                        />

                        <KPICard
                            label="COMISSÃO"
                            value={`R$ ${totalComissao.toLocaleString('pt-BR')}`}
                            icon={TrendingUp}
                            trend={{ value: 'Lucro', direction: 'up', description: 'Ganhos reais' }}
                            variant="default"
                            compact
                        />

                        <KPICard
                            label="ENCALHE"
                            value={`R$ ${totalEncalhe.toLocaleString('pt-BR')}`}
                            icon={AlertCircle}
                            trend={{ value: 'Custo', direction: 'down', description: 'Assumido pela casa' }}
                            variant="danger"
                            compact
                        />
                    </div>

                    {/* Toggle Card / Lista */}
                    <div className="flex items-center justify-end gap-1 mb-4">
                        <button
                            onClick={() => setViewMode('card')}
                            className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'card'
                                    ? 'bg-primary-blue-light/15 text-primary-blue-light'
                                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-subtle'
                                }`}
                            title="Visualização em cards"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'list'
                                    ? 'bg-primary-blue-light/15 text-primary-blue-light'
                                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-subtle'
                                }`}
                            title="Visualização em lista"
                        >
                            <List size={18} />
                        </button>
                    </div>
                    {isLoading ? (
                        <LoadingState type="dashboard" />
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-danger bg-danger/5 rounded-2xl border border-danger/10">
                            <AlertCircle size={48} className="mb-4" />
                            <h3 className="text-xl font-extrabold mb-2">Ops! Algo deu errado</h3>
                            <p>{error}</p>
                            <button onClick={loadData} className="btn btn-primary mt-6 px-10">
                                Tentar novamente
                            </button>
                        </div>
                    ) : produtos.length > 0 ? (
                        viewMode === 'card' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
                                {produtos.map((produto) => {
                                    const boloesLoteria = boloes.filter(b => b.produtoId === produto.id);
                                    return (
                                        <LotteryConsolidatedCard
                                            key={produto.id}
                                            jogo={produto.nome}
                                            cor={produto.cor}
                                            boloes={boloesLoteria}
                                            onClick={() => setSelectedGame({ jogo: produto.nome, cor: produto.cor })}
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {produtos.map((produto) => {
                                    const boloesLoteria = boloes.filter(b => b.produtoId === produto.id);
                                    return (
                                        <LotteryListRow
                                            key={produto.id}
                                            jogo={produto.nome}
                                            cor={produto.cor}
                                            boloes={boloesLoteria}
                                            onClick={() => setSelectedGame({ jogo: produto.nome, cor: produto.cor })}
                                        />
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center p-16 bg-surface-subtle rounded-3xl border-2 border-dashed border-border mt-8">
                            <div className="w-20 h-20 rounded-full bg-surface-card-brighter flex items-center justify-center mb-6 ">
                                <Ticket size={40} className="text-text-primary/20" />
                            </div>
                            <h3 className="text-xl font-extrabold text-text-primary mb-2">Nenhum bolão ativo</h3>
                            <p className="text-text-muted mb-8 text-center max-w-sm">
                                {canManageBoloes ? 'Comece criando um novo bolão para gerenciar cotas e faturamento.' : 'Aguarde o cadastro de novos bolões pelo gerente.'}
                            </p>
                            {canManageBoloes && (
                                <button className="btn btn-accent px-8" onClick={() => setShowNewModal(true)}>
                                    <Plus size={16} /> Criar Primeiro Bolão
                                </button>
                            )}
                        </div>
                    )}
                </>
            ) : activeTab === 'auditoria' ? (
                <SalesAuditTab />
            ) : (
                <OperatorSettlementTab />
            )}

            {showNewModal && (
                <ModalNovoBolao
                    onClose={() => setShowNewModal(false)}
                    onAdd={handleAddBolao}
                />
            )}

            {selectedGame && (
                <ModalListaBoloes
                    jogo={selectedGame.jogo}
                    cor={selectedGame.cor}
                    onClose={() => setSelectedGame(null)}
                />
            )}
        </div>
    );
}



