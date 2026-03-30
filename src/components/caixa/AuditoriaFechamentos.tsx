'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Shield, 
  CircleCheck as CheckCircle2, 
  Circle as XCircle, 
  TriangleAlert as AlertTriangle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  CircleArrowUp as ArrowUpCircle, 
  CircleArrowDown as ArrowDownCircle, 
  DollarSign, 
  Smartphone, 
  Ticket, 
  FileText, 
  Building, 
  ArrowRightLeft, 
  Loader as Loader2, 
  RotateCcw, 
  ListFilter as Filter, 
  Wallet,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
    getFechamentosAuditoria,
    aprovarFechamento,
    rejeitarFechamento,
    getMovimentacoesSessao,
    type FechamentoAuditoria
} from '@/actions/auditoria';
import { formatarStatusReconciliacao } from '@/lib/fechamento-utils';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';

const STATUS_CONFIG: Record<string, { label: string; cor: string; icon: any; bgCor: string }> = {
    pendente: { 
        label: 'Pendente', 
        cor: '#eab308', 
        icon: Clock,
        bgCor: 'bg-warning/10'
    },
    aprovado: { 
        label: 'Aprovado', 
        cor: '#22c55e', 
        icon: CheckCircle2,
        bgCor: 'bg-success/10'
    },
    rejeitado: { 
        label: 'Rejeitado', 
        cor: '#ef4444', 
        icon: XCircle,
        bgCor: 'bg-danger/10'
    },
    correcao_solicitada: { 
        label: 'Correção Solicitada', 
        cor: '#f97316', 
        icon: RotateCcw,
        bgCor: 'bg-warning/10'
    },
};

interface FechamentoAuditoriaDetalhado extends FechamentoAuditoria {
    possui_inconsistencia?: boolean;
    resumo_entradas_pix_real?: number;
    resumo_entradas_dinheiro_real?: number;
    resumo_saidas_sangria_real?: number;
    resumo_saidas_deposito_real?: number;
}

interface MovimentacaoDetalhada {
    id: number;
    tipo: string;
    valor: number;
    descricao: string | null;
    metodo_pagamento: string;
    created_at: string;
    categorias_operacionais?: {
        nome: string;
        cor: string;
    };
}

export function AuditoriaFechamentos() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [fechamentos, setFechamentos] = useState<FechamentoAuditoriaDetalhado[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState<FechamentoAuditoriaDetalhado | null>(null);
    const [movimentacoes, setMovimentacoes] = useState<MovimentacaoDetalhada[]>([]);
    const [loadingMovs, setLoadingMovs] = useState(false);
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroInconsistencia, setFiltroInconsistencia] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [observacoesGerente, setObservacoesGerente] = useState('');
    const [showRejeitar, setShowRejeitar] = useState(false);
    const [expandedMovimentacoes, setExpandedMovimentacoes] = useState(false);

    // Carregar fechamentos com tratamento de inconsistências
    const carregarFechamentos = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getFechamentosAuditoria({
                status: filtroStatus !== 'todos' ? filtroStatus : undefined,
            });
            
            // Adicionar flag de inconsistência baseada na diferença
            const dataComInconsistencia = data.map(f => ({
                ...f,
                possui_inconsistencia: Math.abs(f.diferenca_caixa || 0) > 0.01,
                resumo_entradas_pix_real: f.resumo_entradas_pix,
                resumo_entradas_dinheiro_real: f.resumo_entradas_dinheiro + (f.resumo_entradas_bolao_dinheiro || 0),
                resumo_saidas_sangria_real: f.resumo_saidas_sangria,
                resumo_saidas_deposito_real: f.resumo_saidas_deposito,
            }));
            
            setFechamentos(dataComInconsistencia);
        } catch (err: any) {
            console.error('[AuditoriaFechamentos] Erro ao carregar:', err);
            toast({ message: err.message || 'Erro ao carregar fechamentos', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filtroStatus, toast]);

    // Refresh manual
    const refresh = useCallback(async () => {
        setRefreshing(true);
        await carregarFechamentos();
        setRefreshing(false);
    }, [carregarFechamentos]);

    useEffect(() => { 
        carregarFechamentos(); 
    }, [carregarFechamentos]);

    // Filtrar fechamentos
    const fechamentosFiltrados = useMemo(() => {
        let filtered = fechamentos;
        
        if (filtroInconsistencia) {
            filtered = filtered.filter(f => f.possui_inconsistencia);
        }
        
        return filtered;
    }, [fechamentos, filtroInconsistencia]);

    // Selecionar fechamento e carregar movimentações
    const selecionarFechamento = async (f: FechamentoAuditoriaDetalhado) => {
        setSelected(f);
        setShowRejeitar(false);
        setObservacoesGerente('');
        setExpandedMovimentacoes(false);
        setLoadingMovs(true);
        
        try {
            const movs = await getMovimentacoesSessao(f.id);
            setMovimentacoes(movs.map(m => ({
                ...m,
                categorias_operacionais: m.categorias_operacionais
            })));
        } catch (err: any) {
            console.error('[AuditoriaFechamentos] Erro ao carregar movimentações:', err);
            toast({ message: 'Erro ao carregar movimentações', type: 'error' });
        } finally {
            setLoadingMovs(false);
        }
    };

    // Aprovar fechamento
    const handleAprovar = async () => {
        if (!selected) return;
        
        // Confirmar aprovação - usando 'neutral' que é o tipo permitido
        const confirmado = await confirm({
            title: 'Aprovar Fechamento',
            description: `Tem certeza que deseja aprovar o fechamento do terminal ${selected.terminal_id} do turno ${selected.data_turno}?${observacoesGerente ? '\n\nObservação: ' + observacoesGerente : ''}`,
            confirmLabel: 'Sim, Aprovar',
            variant: 'neutral' // Alterado de 'success' para 'neutral'
        });
        
        if (!confirmado) return;
        
        setProcessing(true);
        try {
            await aprovarFechamento(selected.id, observacoesGerente || undefined);
            toast({ 
                message: `Fechamento aprovado! Entrada criada no cofre.${selected.possui_inconsistencia ? ' (Inconsistências foram registradas)' : ''}`, 
                type: 'success' 
            });
            setSelected(null);
            await carregarFechamentos();
        } catch (err: any) {
            console.error('[AuditoriaFechamentos] Erro ao aprovar:', err);
            toast({ message: err.message || 'Erro ao aprovar fechamento', type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    // Rejeitar fechamento
    const handleRejeitar = async (solicitarCorrecao: boolean) => {
        if (!selected) return;
        
        if (!observacoesGerente.trim()) {
            toast({ 
                message: 'Observação obrigatória ao rejeitar. Explique o motivo para o operador.', 
                type: 'warning' 
            });
            return;
        }
        
        const confirmado = await confirm({
            title: solicitarCorrecao ? 'Solicitar Correção' : 'Rejeitar Fechamento',
            description: solicitarCorrecao 
                ? `Solicitar correção para o operador do terminal ${selected.terminal_id}? Ele poderá ajustar os valores e reenviar.`
                : `Rejeitar definitivamente o fechamento do terminal ${selected.terminal_id}? Esta ação não poderá ser desfeita.`,
            confirmLabel: solicitarCorrecao ? 'Solicitar Correção' : 'Rejeitar',
            variant: solicitarCorrecao ? 'danger' : 'danger' // Ambos usam 'danger' que é permitido
        });
        
        if (!confirmado) return;
        
        setProcessing(true);
        try {
            await rejeitarFechamento(selected.id, observacoesGerente, solicitarCorrecao);
            toast({
                message: solicitarCorrecao 
                    ? 'Correção solicitada ao operador. Ele poderá ajustar os valores.' 
                    : 'Fechamento rejeitado permanentemente.',
                type: 'info'
            });
            setSelected(null);
            await carregarFechamentos();
        } catch (err: any) {
            console.error('[AuditoriaFechamentos] Erro ao rejeitar:', err);
            toast({ message: err.message || 'Erro ao rejeitar fechamento', type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    // Calcular contadores
    const contadores = useMemo(() => ({
        pendentes: fechamentos.filter(f => f.auditoria_status === 'pendente').length,
        aprovados: fechamentos.filter(f => f.auditoria_status === 'aprovado').length,
        rejeitados: fechamentos.filter(f => f.auditoria_status === 'rejeitado').length,
        correcao: fechamentos.filter(f => f.auditoria_status === 'correcao_solicitada').length,
        comInconsistencia: fechamentos.filter(f => f.possui_inconsistencia).length,
    }), [fechamentos]);

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* Lista de Fechamentos */}
            <div className="flex-1 space-y-4 min-w-0">
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <KpiCard 
                        label="Pendentes" 
                        valor={contadores.pendentes} 
                        cor={STATUS_CONFIG.pendente.cor}
                        bgCor={STATUS_CONFIG.pendente.bgCor}
                    />
                    <KpiCard 
                        label="Aprovados" 
                        valor={contadores.aprovados} 
                        cor={STATUS_CONFIG.aprovado.cor}
                        bgCor={STATUS_CONFIG.aprovado.bgCor}
                    />
                    <KpiCard 
                        label="Rejeitados" 
                        valor={contadores.rejeitados} 
                        cor={STATUS_CONFIG.rejeitado.cor}
                        bgCor={STATUS_CONFIG.rejeitado.bgCor}
                    />
                    <KpiCard 
                        label="Correção" 
                        valor={contadores.correcao} 
                        cor={STATUS_CONFIG.correcao_solicitada.cor}
                        bgCor={STATUS_CONFIG.correcao_solicitada.bgCor}
                    />
                    <KpiCard 
                        label="Inconsistências" 
                        valor={contadores.comInconsistencia} 
                        cor="#f97316"
                        bgCor="bg-orange-500/10"
                        icon={<AlertCircle size={12} />}
                    />
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-2">
                    <Filter size={14} className="text-muted" />
                    <div className="flex flex-wrap gap-1.5">
                        {['todos', 'pendente', 'aprovado', 'rejeitado', 'correcao_solicitada'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFiltroStatus(s)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all ${
                                    filtroStatus === s
                                        ? 'bg-primary-blue-light text-white'
                                        : 'bg-surface-subtle text-muted hover:bg-white/5'
                                }`}
                            >
                                {s === 'todos' ? 'Todos' : STATUS_CONFIG[s]?.label || s}
                            </button>
                        ))}
                    </div>
                    
                    <button
                        onClick={() => setFiltroInconsistencia(!filtroInconsistencia)}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                            filtroInconsistencia
                                ? 'bg-orange-500 text-white'
                                : 'bg-surface-subtle text-muted hover:bg-white/5'
                        }`}
                    >
                        <AlertCircle size={10} />
                        Apenas com divergência
                    </button>
                    
                    <button
                        onClick={refresh}
                        disabled={refreshing}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-surface-subtle text-muted hover:bg-white/5 transition-all flex items-center gap-1 ml-auto"
                    >
                        {refreshing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        Atualizar
                    </button>
                </div>

                {/* Lista de Fechamentos */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-muted" size={32} />
                    </div>
                ) : fechamentosFiltrados.length === 0 ? (
                    <div className="text-center text-muted py-12 text-sm border border-border rounded-2xl">
                        {filtroInconsistencia 
                            ? 'Nenhum fechamento com inconsistência encontrado.' 
                            : 'Nenhum fechamento encontrado para auditoria.'}
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar pr-1">
                        {fechamentosFiltrados.map(f => {
                            const config = STATUS_CONFIG[f.auditoria_status] || STATUS_CONFIG.pendente;
                            const Icon = config.icon;
                            const temDiferenca = Math.abs(f.diferenca_caixa || 0) >= 0.01;
                            const isSelected = selected?.id === f.id;

                            return (
                                <button
                                    key={f.id}
                                    onClick={() => selecionarFechamento(f)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                                        isSelected
                                            ? 'border-primary-blue-light bg-primary-blue-light/5 shadow-lg'
                                            : 'border-border bg-bg-card hover:border-white/10 hover:bg-surface-subtle'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Icon size={14} style={{ color: config.cor }} />
                                            <span className="text-sm font-bold font-mono">{f.terminal_id}</span>
                                            <span className="text-xs text-muted">{f.operador_nome}</span>
                                            {f.possui_inconsistencia && (
                                                <span className="text-[8px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <AlertTriangle size={8} />
                                                    Divergência
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: config.cor, backgroundColor: `${config.cor}20` }}>
                                            {config.label.toUpperCase()}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted">
                                                Turno {f.data_turno}
                                            </span>
                                            <span className="text-[10px] text-muted">
                                                Fechado {f.data_fechamento ? new Date(f.data_fechamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </span>
                                        </div>
                                        {temDiferenca && (
                                            <div className={`text-right ${f.diferenca_caixa > 0 ? 'text-warning' : 'text-danger'}`}>
                                                <span className="text-[10px] font-black block">
                                                    {f.diferenca_caixa > 0 ? '+' : ''}R$ {Math.abs(f.diferenca_caixa).toFixed(2)}
                                                </span>
                                                <span className="text-[8px] text-muted">
                                                    {f.diferenca_caixa > 0 ? 'sobra' : 'falta'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Dossiê Detalhado */}
            {selected && (
                <div className="lg:w-[520px] bg-bg-card border border-border rounded-2xl overflow-hidden flex flex-col max-h-[85vh] shadow-xl">
                    {/* Header */}
                    <div className="p-5 border-b border-border bg-surface-subtle sticky top-0 z-10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    <Shield size={18} className="text-primary-blue-light" />
                                    {selected.terminal_id}
                                </h3>
                                <p className="text-xs text-muted mt-1">
                                    {selected.operador_nome} • Turno {selected.data_turno}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelected(null)} 
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <XCircle size={20} className="text-muted" />
                            </button>
                        </div>
                    </div>

                    {/* Body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                        {/* Alertas de Inconsistência */}
                        {selected.possui_inconsistencia && (
                            <div className="p-4 rounded-xl bg-orange-500/10 border-2 border-orange-500/30">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-orange-500 mb-2">
                                            Divergência Detectada
                                        </p>
                                        <p className="text-xs text-text-secondary">
                                            Os valores informados pelo operador não conferem com os cálculos automáticos. 
                                            Verifique as movimentações antes de aprovar.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Entradas */}
                        <SectionCard 
                            title="ENTRADAS" 
                            icon={<ArrowUpCircle size={14} />} 
                            cor="success"
                            total={selected.resumo_total_entradas || 0}
                        >
                            <LinhaResumo 
                                icon={<Smartphone size={12} />} 
                                label="PIX" 
                                valor={selected.resumo_entradas_pix || 0}
                                comparacao={selected.resumo_entradas_pix_real}
                            />
                            <LinhaResumo 
                                icon={<DollarSign size={12} />} 
                                label="Dinheiro (jogos)" 
                                valor={selected.resumo_entradas_dinheiro || 0}
                            />
                            <LinhaResumo 
                                icon={<Ticket size={12} />} 
                                label="Bolões (dinheiro)" 
                                valor={selected.resumo_entradas_bolao_dinheiro || 0}
                            />
                            {(selected.resumo_entradas_bolao_pix || 0) > 0 && (
                                <LinhaResumo 
                                    icon={<Ticket size={12} />} 
                                    label="Bolões (PIX)" 
                                    valor={selected.resumo_entradas_bolao_pix || 0}
                                />
                            )}
                        </SectionCard>

                        {/* Saídas */}
                        <SectionCard 
                            title="SAÍDAS" 
                            icon={<ArrowDownCircle size={14} />} 
                            cor="danger"
                            total={selected.resumo_total_saidas || 0}
                        >
                            <LinhaResumo 
                                icon={<Shield size={12} />} 
                                label="Sangrias" 
                                valor={selected.resumo_saidas_sangria || 0}
                                comparacao={selected.resumo_saidas_sangria_real}
                            />
                            <LinhaResumo 
                                icon={<FileText size={12} />} 
                                label="Boletos" 
                                valor={selected.resumo_saidas_boleto || 0}
                            />
                            <LinhaResumo 
                                icon={<Building size={12} />} 
                                label="Depósitos" 
                                valor={selected.resumo_saidas_deposito || 0}
                                comparacao={selected.resumo_saidas_deposito_real}
                            />
                            {(selected.resumo_saidas_trocados || 0) > 0 && (
                                <LinhaResumo 
                                    icon={<ArrowRightLeft size={12} />} 
                                    label="Trocados" 
                                    valor={selected.resumo_saidas_trocados || 0}
                                />
                            )}
                        </SectionCard>

                        {/* Conferência de Caixa */}
                        {(() => {
                            const statusInfo = formatarStatusReconciliacao(
                                Math.abs(selected.diferenca_caixa || 0) < 0.01 ? 'batido' :
                                    (selected.diferenca_caixa || 0) > 0 ? 'sobra' : 'falta'
                            );
                            return (
                                <div className={`p-4 rounded-xl border-2 ${
                                    statusInfo.icone === 'check' ? 'bg-success/10 border-success/20' :
                                    statusInfo.icone === 'alert' ? 'bg-warning/10 border-warning/20' :
                                    'bg-danger/10 border-danger/20'
                                }`}>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">
                                        Conferência de Caixa
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted">Fundo Inicial</span>
                                            <span className="font-bold font-mono">R$ {selected.valor_inicial.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted">Esperado em Dinheiro</span>
                                            <span className="font-bold font-mono">R$ {(selected.saldo_esperado_dinheiro || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted">Declarado pelo Operador</span>
                                            <span className="font-bold font-mono">R$ {(selected.dinheiro_em_maos || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="border-t border-border/50 my-2" />
                                        <div className="flex justify-between items-center pt-1">
                                            <span className="font-black text-sm">DIFERENÇA</span>
                                            <div className="text-right">
                                                <span className={`text-xl font-black ${(selected.diferenca_caixa || 0) > 0 ? 'text-warning' : (selected.diferenca_caixa || 0) < 0 ? 'text-danger' : 'text-success'}`}>
                                                    {(selected.diferenca_caixa || 0) >= 0 ? '+' : ''}R$ {(selected.diferenca_caixa || 0).toFixed(2)}
                                                </span>
                                                <p className="text-[10px] text-muted mt-0.5">
                                                    {statusInfo.texto || (selected.diferenca_caixa === 0 ? 'Conferido' : 'Divergente')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Destino do Dinheiro */}
                        <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                                Destino do Dinheiro
                            </p>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Enviado ao Cofre</span>
                                <span className="font-bold font-mono">R$ {(selected.valor_enviado_cofre || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Fundo Devolvido</span>
                                <span className={`font-bold ${selected.fundo_caixa_devolvido ? 'text-success' : 'text-warning'}`}>
                                    {selected.fundo_caixa_devolvido ? `R$ ${selected.valor_inicial.toFixed(2)}` : 'Não devolvido'}
                                </span>
                            </div>
                            {(selected.pix_externo_informado || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted">PIX Externo</span>
                                    <span className="font-bold font-mono">R$ {(selected.pix_externo_informado || 0).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                                <span className="text-muted">Status Cofre</span>
                                <span className={`font-bold ${selected.cofre_confirmado ? 'text-success' : 'text-warning'}`}>
                                    {selected.cofre_confirmado ? 'Confirmado' : 'Aguardando confirmação'}
                                </span>
                            </div>
                        </div>

                        {/* Observações do Operador */}
                        {selected.observacoes_operador && (
                            <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
                                <p className="text-[10px] font-black text-warning uppercase tracking-widest mb-2">
                                    Justificativa do Operador
                                </p>
                                <p className="text-sm text-text-secondary">{selected.observacoes_operador}</p>
                            </div>
                        )}

                        {/* Movimentações Detalhadas */}
                        <DetalhesMovimentacoes 
                            movimentacoes={movimentacoes} 
                            loading={loadingMovs}
                            expanded={expandedMovimentacoes}
                            onToggle={() => setExpandedMovimentacoes(!expandedMovimentacoes)}
                        />
                    </div>

                    {/* Footer - Ações */}
                    {selected.auditoria_status === 'pendente' && (
                        <div className="p-5 border-t border-border bg-surface-subtle space-y-4">
                            {showRejeitar ? (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-muted uppercase mb-1 block">
                                            Observação para o Operador <span className="text-danger">*</span>
                                        </label>
                                        <textarea
                                            className="input w-full text-sm"
                                            rows={3}
                                            value={observacoesGerente}
                                            onChange={e => setObservacoesGerente(e.target.value)}
                                            placeholder="Explique detalhadamente o motivo da rejeição ou a correção necessária..."
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            className="btn btn-ghost flex-1 text-sm" 
                                            onClick={() => {
                                                setShowRejeitar(false);
                                                setObservacoesGerente('');
                                            }} 
                                            disabled={processing}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            className="btn flex-1 text-sm bg-danger/20 text-danger hover:bg-danger/30 font-bold"
                                            onClick={() => handleRejeitar(false)}
                                            disabled={processing || !observacoesGerente.trim()}
                                        >
                                            {processing ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                                            Rejeitar
                                        </button>
                                        <button
                                            className="btn flex-1 text-sm bg-warning/20 text-warning hover:bg-warning/30 font-bold"
                                            onClick={() => handleRejeitar(true)}
                                            disabled={processing || !observacoesGerente.trim()}
                                        >
                                            {processing ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                                            Solicitar Correção
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-muted uppercase mb-1 block">
                                            Observação (opcional)
                                        </label>
                                        <textarea
                                            className="input w-full text-sm"
                                            rows={2}
                                            value={observacoesGerente}
                                            onChange={e => setObservacoesGerente(e.target.value)}
                                            placeholder="Adicione uma observação sobre a aprovação..."
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="btn flex-1 bg-success/20 text-success hover:bg-success/30 font-black py-3"
                                            onClick={handleAprovar}
                                            disabled={processing}
                                        >
                                            {processing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                            APROVAR
                                        </button>
                                        <button
                                            className="btn flex-1 bg-danger/10 text-danger hover:bg-danger/20 font-bold py-3"
                                            onClick={() => setShowRejeitar(true)}
                                            disabled={processing}
                                        >
                                            <XCircle size={16} /> Rejeitar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info de Auditoria Realizada */}
                    {selected.auditoria_status !== 'pendente' && (
                        <div className="p-5 border-t border-border bg-surface-subtle">
                            <div className="flex items-start gap-3">
                                {selected.auditoria_status === 'aprovado' ? (
                                    <CheckCircle2 size={18} className="text-success flex-shrink-0 mt-0.5" />
                                ) : (
                                    <XCircle size={18} className="text-danger flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-bold">
                                        {selected.auditoria_status === 'aprovado' ? 'Aprovado' : selected.auditoria_status === 'correcao_solicitada' ? 'Correção Solicitada' : 'Rejeitado'}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {selected.auditoria_data ? new Date(selected.auditoria_data).toLocaleString('pt-BR') : ''}
                                    </p>
                                    {selected.auditoria_observacoes && (
                                        <p className="text-xs text-text-secondary mt-2 p-2 bg-white/5 rounded-lg">
                                            "{selected.auditoria_observacoes}"
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Componentes Auxiliares ───

function KpiCard({ label, valor, cor, bgCor, icon }: { 
    label: string; 
    valor: number; 
    cor: string; 
    bgCor?: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className={`p-4 rounded-xl border border-border text-center transition-all hover:scale-105 ${bgCor || 'bg-bg-card'}`}>
            <div className="flex items-center justify-center gap-1 mb-1">
                {icon && <span style={{ color: cor }}>{icon}</span>}
                <p className="text-2xl font-black" style={{ color: cor }}>{valor}</p>
            </div>
            <p className="text-[10px] text-muted font-bold uppercase">{label}</p>
        </div>
    );
}

function SectionCard({ title, icon, cor, total, children }: {
    title: string; 
    icon: React.ReactNode; 
    cor: string; 
    total: number; 
    children: React.ReactNode;
}) {
    const corClass = cor === 'success' ? 'text-success' : cor === 'danger' ? 'text-danger' : 'text-primary-blue-light';
    const bgClass = cor === 'success' ? 'bg-success/10' : cor === 'danger' ? 'bg-danger/10' : 'bg-primary-blue-light/10';
    
    return (
        <div className="rounded-xl border border-border overflow-hidden">
            <div className={`px-4 py-2.5 ${bgClass} flex justify-between items-center`}>
                <span className={`text-[10px] font-black uppercase flex items-center gap-1.5 ${corClass}`}>
                    {icon} {title}
                </span>
                <span className={`text-sm font-black ${corClass}`}>
                    R$ {total.toFixed(2)}
                </span>
            </div>
            <div className="p-4 space-y-2">{children}</div>
        </div>
    );
}

function LinhaResumo({ icon, label, valor, comparacao }: { 
    icon: React.ReactNode; 
    label: string; 
    valor: number;
    comparacao?: number;
}) {
    if (!valor && valor !== 0) return null;
    
    const temDiferenca = comparacao !== undefined && Math.abs(valor - comparacao) > 0.01;
    
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted">{icon} {label}</span>
            <div className="text-right">
                <span className={`font-bold font-mono ${temDiferenca ? 'text-warning' : ''}`}>
                    R$ {valor.toFixed(2)}
                </span>
                {temDiferenca && comparacao !== undefined && (
                    <div className="text-[9px] text-muted">
                        (Real: R$ {comparacao.toFixed(2)})
                    </div>
                )}
            </div>
        </div>
    );
}

function DetalhesMovimentacoes({ 
    movimentacoes, 
    loading, 
    expanded, 
    onToggle 
}: { 
    movimentacoes: MovimentacaoDetalhada[]; 
    loading: boolean;
    expanded: boolean;
    onToggle: () => void;
}) {
    if (loading) {
        return (
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-surface-subtle flex justify-between items-center">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                        Movimentações
                    </span>
                    <Loader2 size={14} className="animate-spin text-muted" />
                </div>
                <div className="p-4 text-center">
                    <Loader2 className="animate-spin mx-auto text-muted" size={20} />
                </div>
            </div>
        );
    }

    if (movimentacoes.length === 0) {
        return (
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-surface-subtle">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                        Movimentações
                    </span>
                </div>
                <div className="p-4 text-center text-muted text-sm">
                    Nenhuma movimentação registrada
                </div>
            </div>
        );
    }

    const visibles = expanded ? movimentacoes : movimentacoes.slice(0, 10);

    return (
        <div className="rounded-xl border border-border overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 bg-surface-subtle flex justify-between items-center hover:bg-white/5 transition-colors"
            >
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                    Movimentações ({movimentacoes.length})
                </span>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {visibles.map((m: MovimentacaoDetalhada) => (
                    <div key={m.id} className="flex items-center justify-between text-xs px-4 py-2.5 border-b border-border/30 hover:bg-white/5">
                        <div className="flex items-center gap-3">
                            <span className="text-muted w-12 font-mono text-[10px]">
                                {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.valor > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                            }`}>
                                {m.tipo}
                            </span>
                            {m.categorias_operacionais?.nome && (
                                <span className="text-[10px] text-muted">
                                    • {m.categorias_operacionais.nome}
                                </span>
                            )}
                        </div>
                        <span className={`font-bold font-mono ${m.valor > 0 ? 'text-success' : 'text-danger'}`}>
                            {m.valor > 0 ? '+' : ''}R$ {Math.abs(m.valor).toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
            {!expanded && movimentacoes.length > 10 && (
                <button
                    onClick={onToggle}
                    className="w-full text-center text-[10px] text-primary-blue-light font-bold py-2 hover:bg-white/5 transition-colors"
                >
                    Ver mais {movimentacoes.length - 10} movimentações
                </button>
            )}
        </div>
    );
}
