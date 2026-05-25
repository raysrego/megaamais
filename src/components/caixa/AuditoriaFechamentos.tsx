'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, RefreshCw, ShieldCheck, Loader as Loader2, X, TrendingUp, TrendingDown, ListFilter as Filter, Brain, AlertCircle, CheckCircle, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import {
    getFechamentosAuditoria,
    aprovarFechamento,
    rejeitarFechamento,
    type FechamentoAuditoria
} from '@/actions/auditoria';

interface AnaliseIA {
    id: string;
    recomendacao: 'APROVAR' | 'REJEITAR' | 'REVISAR';
    risco: 'BAIXO' | 'MEDIO' | 'ALTO';
    parecer: string;
    alertas: string[];
}

interface ResultadoAnalise {
    analises: AnaliseIA[];
    resumo: string;
}

interface Fechamento {
    id: string;
    data_turno: string;
    data_fechamento: string;
    terminal_id: string;
    operador_id: string;
    operador_nome?: string;
    valor_inicial: number;
    total_lancamentos: number;
    saldo_no_caixa: number;
    divergencia: number;
    valor_na_conta: number;
    total_pix: number;
    total_dinheiro: number;
    total_sangrias: number;
    total_depositos: number;
    total_boletos: number;
    total_trocados: number;
    status_validacao: string;
    tipo: 'tfl' | 'bolao';
    justificativa?: string;
    valor_cofre?: number;
    valor_pix_externo?: number;
    fundo_caixa_devolvido?: boolean;
    saldo_esperado?: number;
}

// Funções de formatação de data
const formatarDataLocal = (dataStr: string) => {
    if (!dataStr) return '-';
    if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    if (dataStr.includes('T')) {
        const [data] = dataStr.split('T');
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    return dataStr;
};

const formatarDataHoraLocal = (dataStr: string | null) => {
    if (!dataStr) return '-';
    if (dataStr.includes('T')) {
        const [data, hora] = dataStr.split('T');
        const [ano, mes, dia] = data.split('-');
        const horaLocal = hora.substring(0, 5);
        return `${dia}/${mes}/${ano} ${horaLocal}`;
    }
    return formatarDataLocal(dataStr);
};

// Modal de auditoria simplificado
interface ModalAuditoriaSimplificadaProps {
    fechamento: Fechamento;
    onClose: () => void;
    onAprovar: (observacoes: string) => void;
    onRejeitar: (dados: { justificativa: string; diferenca?: number }) => void;
}

function ModalAuditoriaSimplificada({
    fechamento,
    onClose,
    onAprovar,
    onRejeitar
}: ModalAuditoriaSimplificadaProps) {
    const [modoRejeitar, setModoRejeitar] = useState(false);
    const [justificativa, setJustificativa] = useState('');
    const [observacoes, setObservacoes] = useState('');

    const totalEntradas = (fechamento.total_pix || 0) + (fechamento.total_dinheiro || 0);
    const totalSaidas = (fechamento.total_sangrias || 0) + 
                        (fechamento.total_depositos || 0) + 
                        (fechamento.total_boletos || 0) + 
                        (fechamento.total_trocados || 0);

    return (
        <>
            <div className="fixed inset-0 bg-black/80 z-9998" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-bg-card border border-border rounded-2xl z-9999 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Auditoria de Fechamento</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm">
                        <X size={18} />
                    </button>
                </div>

                {/* Informações básicas */}
                <div className="grid grid-cols-2 gap-3 mb-6 p-3 rounded-xl bg-surface-subtle border border-border text-sm">
                    <div>
                        <p className="text-[9px] text-muted uppercase font-bold">Terminal</p>
                        <p className="font-bold">{fechamento.terminal_id}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-muted uppercase font-bold">Operador</p>
                        <p className="font-bold">{fechamento.operador_nome}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-muted uppercase font-bold">Data do turno</p>
                        <p className="font-bold">{formatarDataLocal(fechamento.data_turno)}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-muted uppercase font-bold">Fechamento</p>
                        <p className="font-bold">{formatarDataHoraLocal(fechamento.data_fechamento)}</p>
                    </div>
                </div>

                {/* Totais de Entrada e Saída */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-center">
                        <div className="flex items-center justify-center gap-1 mb-2">
                            <TrendingUp size={16} className="text-success" />
                            <span className="text-[10px] text-success uppercase font-bold">ENTRADA</span>
                        </div>
                        <p className="text-2xl font-black text-success">
                            R$ {totalEntradas.toFixed(2)}
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-center">
                        <div className="flex items-center justify-center gap-1 mb-2">
                            <TrendingDown size={16} className="text-danger" />
                            <span className="text-[10px] text-danger uppercase font-bold">SAÍDA</span>
                        </div>
                        <p className="text-2xl font-black text-danger">
                            R$ {totalSaidas.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Valor na Conta */}
                <div className="p-4 rounded-xl bg-primary-blue-light/10 border border-primary-blue-light/20 mb-6 text-center">
                    <p className="text-[10px] font-bold text-primary-blue-light uppercase mb-1">
                        💰 VALOR NA CONTA
                    </p>
                    <p className="text-2xl font-black text-primary-blue-light">
                        R$ {(fechamento.valor_na_conta || 0).toFixed(2)}
                    </p>
                    <p className="text-[9px] text-muted mt-1">
                        PIX Externo + (Entradas - Saídas)
                    </p>
                </div>

                {/* Informações adicionais */}
                {(fechamento.valor_cofre || 0) > 0 && (
                    <div className="bg-surface-subtle p-3 rounded-lg border border-border mb-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">Valor no cofre</span>
                            <span className="font-bold">R$ {(fechamento.valor_cofre || 0).toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {(fechamento.valor_pix_externo || 0) > 0 && (
                    <div className="bg-surface-subtle p-3 rounded-lg border border-border mb-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">PIX externo</span>
                            <span className="font-bold">R$ {(fechamento.valor_pix_externo || 0).toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Justificativa */}
                {fechamento.justificativa && (
                    <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-[9px] text-yellow-500 font-bold uppercase">Justificativa do Operador</span>
                        <p className="text-xs text-yellow-600 dark:text-yellow-200 mt-1 italic">"{fechamento.justificativa}"</p>
                    </div>
                )}

                {/* Ações */}
                {!modoRejeitar ? (
                    <div className="flex gap-3 justify-end mt-4">
                        <button className="btn btn-ghost text-sm" onClick={onClose}>Cancelar</button>
                        <button
                            className="btn bg-danger/10 text-danger hover:bg-danger/20 text-sm"
                            onClick={() => setModoRejeitar(true)}
                        >
                            Rejeitar
                        </button>
                        <button
                            className="btn btn-success text-sm"
                            onClick={() => onAprovar(observacoes)}
                        >
                            Aprovar
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3 mt-4">
                        <div className="form-group">
                            <label className="text-xs font-bold">Justificativa da rejeição</label>
                            <textarea
                                className="input w-full text-sm"
                                rows={3}
                                value={justificativa}
                                onChange={(e) => setJustificativa(e.target.value)}
                                placeholder="Descreva o motivo da rejeição"
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button className="btn btn-ghost text-sm" onClick={() => setModoRejeitar(false)}>
                                Voltar
                            </button>
                            <button
                                className="btn btn-danger text-sm"
                                onClick={() => onRejeitar({ justificativa })}
                            >
                                Confirmar Rejeição
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export function AuditoriaFechamentos() {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
    const [selectedFechamento, setSelectedFechamento] = useState<Fechamento | null>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado'>('todos');

    // Filtros por data
    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');

    // IA Analysis
    const [analisandoIA, setAnalisandoIA] = useState(false);
    const [resultadoIA, setResultadoIA] = useState<ResultadoAnalise | null>(null);

    const fetchHistorico = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getFechamentosAuditoria({
                status: filtroStatus !== 'todos' ? filtroStatus : undefined,
                dataInicio: filtroDataInicio || undefined,
                dataFim: filtroDataFim || undefined,
            });

            const fechamentosProcessados: Fechamento[] = data.map((f: any) => {
                const totalPix = (f.resumo_entradas_pix || 0) + (f.resumo_entradas_bolao_pix || 0);
                const totalDinheiro = (f.resumo_entradas_dinheiro || 0) + (f.resumo_entradas_bolao_dinheiro || 0);
                const totalEntradas = totalPix + totalDinheiro;
                const totalSaidas = (f.resumo_saidas_sangria || 0) + 
                                    (f.resumo_saidas_deposito || 0) + 
                                    (f.resumo_saidas_boleto || 0) + 
                                    (f.resumo_saidas_trocados || 0);
                const totalLancamentos = totalEntradas - totalSaidas;
                const valorNaConta = (f.pix_externo_informado || 0) + totalLancamentos;
                const saldoEsperado = (f.valor_inicial || 0) + totalLancamentos;

                return {
                    id: f.id,
                    data_turno: f.data_turno || '',
                    data_fechamento: f.data_fechamento,
                    terminal_id: f.terminal_id || 'TFL-WEB',
                    operador_id: f.operador_id || 'Sistema',
                    operador_nome: f.operador_nome || 'Sistema',
                    valor_inicial: f.valor_inicial || 0,
                    total_lancamentos: totalLancamentos,
                    saldo_no_caixa: f.valor_final_declarado || 0,
                    divergencia: f.diferenca_caixa || 0,
                    valor_na_conta: valorNaConta,
                    total_pix: totalPix,
                    total_dinheiro: totalDinheiro,
                    total_sangrias: f.resumo_saidas_sangria || 0,
                    total_depositos: f.resumo_saidas_deposito || 0,
                    total_boletos: f.resumo_saidas_boleto || 0,
                    total_trocados: f.resumo_saidas_trocados || 0,
                    status_validacao: f.auditoria_status || f.status,
                    tipo: 'tfl',
                    justificativa: f.observacoes_operador,
                    valor_cofre: f.valor_enviado_cofre || 0,
                    valor_pix_externo: f.pix_externo_informado || 0,
                    fundo_caixa_devolvido: f.fundo_caixa_devolvido,
                    saldo_esperado: saldoEsperado
                };
            });

            setFechamentos(fechamentosProcessados);
        } catch (err: any) {
            console.error('Erro ao carregar histórico:', err);
            toast({ message: 'Erro ao carregar fechamentos: ' + (err.message || 'Erro desconhecido'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filtroStatus, filtroDataInicio, filtroDataFim, toast]);

    useEffect(() => {
        fetchHistorico();
    }, [fetchHistorico]);

    const fazerAnaliseIA = useCallback(async () => {
        const pendentes = fechamentos.filter(f => f.status_validacao === 'pendente');
        if (pendentes.length === 0) {
            toast({ message: 'Nenhum fechamento pendente para analisar.', type: 'warning' });
            return;
        }

        setAnalisandoIA(true);
        setResultadoIA(null);

        try {
            const payload = pendentes.map(f => ({
                id: f.id,
                data_turno: f.data_turno,
                terminal_id: f.terminal_id,
                operador_nome: f.operador_nome || 'Sistema',
                total_entradas: (f.total_pix || 0) + (f.total_dinheiro || 0),
                total_saidas: (f.total_sangrias || 0) + (f.total_depositos || 0) + (f.total_boletos || 0) + (f.total_trocados || 0),
                valor_na_conta: f.valor_na_conta || 0,
                total_pix: f.total_pix || 0,
                total_dinheiro: f.total_dinheiro || 0,
                total_sangrias: f.total_sangrias || 0,
                total_depositos: f.total_depositos || 0,
                total_boletos: f.total_boletos || 0,
                total_trocados: f.total_trocados || 0,
                valor_cofre: f.valor_cofre || 0,
                valor_pix_externo: f.valor_pix_externo || 0,
                divergencia: f.divergencia || 0,
                justificativa: f.justificativa,
            }));

            const res = await fetch('/api/caixa/analise-auditoria', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechamentos: payload }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? 'Erro na API');
            }

            const resultado: ResultadoAnalise = await res.json();
            setResultadoIA(resultado);
            toast({ message: `Análise concluída para ${pendentes.length} fechamento(s)!`, type: 'success' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            toast({ message: 'Erro na análise IA: ' + msg, type: 'error' });
        } finally {
            setAnalisandoIA(false);
        }
    }, [fechamentos, toast]);

    const handleCloseModal = () => {
        setShowValidationModal(false);
    };

    const handleAprovar = async (sessaoId: number, observacoes: string) => {
        console.log('[Auditoria] Aprovando:', sessaoId, observacoes);
        try {
            await aprovarFechamento(sessaoId, observacoes);
            toast({ message: 'Fechamento aprovado com sucesso!', type: 'success' });
            await fetchHistorico();
            setSelectedFechamento(null);
        } catch (error: any) {
            console.error('[Auditoria] Erro:', error);
            toast({ message: error.message || 'Erro ao aprovar', type: 'error' });
        }
        handleCloseModal();
    };

    const handleRejeitar = async (sessaoId: number, justificativa: string) => {
        console.log('[Auditoria] Rejeitando:', sessaoId, justificativa);
        try {
            await rejeitarFechamento(sessaoId, justificativa, false);
            toast({ message: 'Fechamento rejeitado!', type: 'warning' });
            await fetchHistorico();
            setSelectedFechamento(null);
        } catch (error: any) {
            console.error('[Auditoria] Erro:', error);
            toast({ message: error.message || 'Erro ao rejeitar', type: 'error' });
        }
        handleCloseModal();
    };

    const getStatusBadge = (status: string) => {
        const labels: Record<string, string> = {
            pendente: 'PENDENTE',
            aprovado: 'APROVADO',
            rejeitado: 'REJEITADO',
            correcao_solicitada: 'CORREÇÃO'
        };
        const colors: Record<string, string> = {
            pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            aprovado: 'bg-green-500/10 text-green-400 border-green-500/20',
            rejeitado: 'bg-red-500/10 text-red-400 border-red-500/20',
            correcao_solicitada: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
        };
        return (
            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${colors[status] || colors.pendente}`}>
                {labels[status] || status}
            </span>
        );
    };

    const limparFiltros = () => {
        setFiltroDataInicio('');
        setFiltroDataFim('');
        setFiltroStatus('todos');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="auditoria-fechamentos">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="text-primary" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Auditoria de Fechamentos</h3>
                        <p className="text-xs text-muted">Validação de encerramentos de turno</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <select
                        className="input text-xs"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value as any)}
                    >
                        <option value="todos">Todos</option>
                        <option value="pendente">Pendentes</option>
                        <option value="aprovado">Aprovados</option>
                        <option value="rejeitado">Rejeitados</option>
                    </select>
                    <button onClick={fetchHistorico} className="btn btn-ghost btn-sm">
                        <RefreshCw size={14} /> Atualizar
                    </button>
                    <button
                        onClick={fazerAnaliseIA}
                        disabled={analisandoIA || fechamentos.filter(f => f.status_validacao === 'pendente').length === 0}
                        className="btn btn-primary btn-sm disabled:opacity-50"
                    >
                        {analisandoIA
                            ? <><Loader2 size={14} className="animate-spin" /> Analisando...</>
                            : <><Brain size={14} /> Fazer análise</>
                        }
                    </button>
                </div>
            </div>

            {/* Filtros por data */}
            <div className="mb-6 p-4 rounded-xl bg-surface-subtle border border-border">
                <div className="flex items-center gap-2 mb-3">
                    <Filter size={16} className="text-primary-blue-light" />
                    <h4 className="text-sm font-bold">Filtrar por Período</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Início</label>
                        <input
                            type="date"
                            value={filtroDataInicio}
                            onChange={e => setFiltroDataInicio(e.target.value)}
                            className="input w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Data Fim</label>
                        <input
                            type="date"
                            value={filtroDataFim}
                            onChange={e => setFiltroDataFim(e.target.value)}
                            className="input w-full text-sm"
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-3">
                    <button onClick={limparFiltros} className="btn btn-ghost btn-sm text-xs">
                        <X size={12} /> Limpar Filtros
                    </button>
                </div>
            </div>

            {/* Resultado da Análise IA */}
            {resultadoIA && (
                <div className="mb-6 rounded-xl border border-border bg-bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle">
                        <div className="flex items-center gap-2">
                            <Brain size={16} className="text-primary" />
                            <span className="text-sm font-bold">Resultado da Análise IA</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                                {resultadoIA.analises.length} fechamento(s)
                            </span>
                        </div>
                        <button onClick={() => setResultadoIA(null)} className="btn btn-ghost btn-sm px-2">
                            <X size={14} />
                        </button>
                    </div>

                    {resultadoIA.resumo && (
                        <div className="px-4 py-3 border-b border-border text-sm text-muted bg-surface-subtle/50">
                            {resultadoIA.resumo}
                        </div>
                    )}

                    <div className="divide-y divide-border">
                        {resultadoIA.analises.map((analise) => {
                            const fechamento = fechamentos.find(f => f.id === analise.id);
                            const corReco = analise.recomendacao === 'APROVAR' ? 'text-success' : analise.recomendacao === 'REJEITAR' ? 'text-danger' : 'text-warning';
                            const bgReco = analise.recomendacao === 'APROVAR' ? 'bg-success/10 border-success/20' : analise.recomendacao === 'REJEITAR' ? 'bg-danger/10 border-danger/20' : 'bg-warning/10 border-warning/20';
                            const IconReco = analise.recomendacao === 'APROVAR' ? CheckCircle : analise.recomendacao === 'REJEITAR' ? AlertCircle : AlertTriangleIcon;
                            return (
                                <div key={analise.id} className="px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg border ${bgReco}`}>
                                            <IconReco size={14} className={corReco} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-xs font-bold">
                                                    {fechamento ? `${fechamento.terminal_id} — ${formatarDataLocal(fechamento.data_turno)}` : `ID: ${analise.id}`}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${bgReco} ${corReco}`}>
                                                    {analise.recomendacao}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                    analise.risco === 'ALTO' ? 'bg-danger/10 text-danger' :
                                                    analise.risco === 'MEDIO' ? 'bg-warning/10 text-warning' :
                                                    'bg-success/10 text-success'
                                                }`}>
                                                    Risco {analise.risco}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted">{analise.parecer}</p>
                                            {analise.alertas && analise.alertas.length > 0 && (
                                                <ul className="mt-1.5 space-y-0.5">
                                                    {analise.alertas.map((alerta, i) => (
                                                        <li key={i} className="text-[11px] text-warning flex items-center gap-1">
                                                            <AlertTriangle size={10} /> {alerta}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selectedFechamento ? '1fr 480px' : '1fr', gap: '1.5rem' }}>
                {/* Tabela */}
                <div className="card p-0 overflow-hidden">
                    {fechamentos.length === 0 ? (
                        <div className="p-12 text-center border-dashed">
                            <CheckCircle2 className="mx-auto mb-4 text-success opacity-20" size={48} />
                            <p className="font-bold text-muted">Nenhum encerramento encontrado</p>
                        </div>
                    ) : (
                        <div className="table-container pt-0">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Data Turno</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Data Fechamento</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Terminal</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Operador</th>
                                        <th className="text-left py-2 px-2 text-xs font-bold text-muted uppercase">Status</th>
                                        <th className="text-right py-2 px-2 text-xs font-bold text-muted uppercase">Valor na Conta</th>
                                        <th style={{ width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fechamentos.map((f) => (
                                        <tr
                                            key={f.id}
                                            onClick={() => setSelectedFechamento(f)}
                                            className={`cursor-pointer hover:bg-bg-card-hover transition-colors ${
                                                selectedFechamento?.id === f.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                                            }`}
                                        >
                                            <td className="text-xs">{formatarDataLocal(f.data_turno)}</td>
                                            <td className="text-xs">{formatarDataHoraLocal(f.data_fechamento)}</td>
                                            <td>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-black bg-blue-500/10 text-blue-400`}>
                                                    {f.terminal_id}
                                                </span>
                                            </td>
                                            <td className="text-xs opacity-60">{f.operador_nome}</td>
                                            <td>{getStatusBadge(f.status_validacao)}</td>
                                            <td className={`font-bold text-right ${(f.valor_na_conta || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                                R$ {(f.valor_na_conta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-right">
                                                <ChevronRight size={16} className="text-muted" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Card de Detalhes */}
                {selectedFechamento && (
                    <div className="card flex flex-col h-full overflow-y-auto max-h-[80vh]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Detalhes do Turno</h3>
                            <button onClick={() => setSelectedFechamento(null)} className="btn btn-ghost btn-sm px-2">
                                fechar
                            </button>
                        </div>

                        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-surface-subtle border border-border">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-warning/10 text-warning">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <div className="text-lg font-bold">{selectedFechamento.terminal_id}</div>
                                <div className="text-xs text-muted">{selectedFechamento.operador_nome} • {formatarDataLocal(selectedFechamento.data_turno)}</div>
                            </div>
                        </div>

                        {/* Totais */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-center">
                                <div className="flex items-center justify-center gap-1 mb-2">
                                    <TrendingUp size={14} className="text-success" />
                                    <span className="text-[9px] text-success uppercase font-bold">ENTRADA</span>
                                </div>
                                <p className="text-xl font-black text-success">
                                    R$ {((selectedFechamento.total_pix || 0) + (selectedFechamento.total_dinheiro || 0)).toFixed(2)}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-center">
                                <div className="flex items-center justify-center gap-1 mb-2">
                                    <TrendingDown size={14} className="text-danger" />
                                    <span className="text-[9px] text-danger uppercase font-bold">SAÍDA</span>
                                </div>
                                <p className="text-xl font-black text-danger">
                                    R$ {((selectedFechamento.total_sangrias || 0) + (selectedFechamento.total_depositos || 0) + (selectedFechamento.total_boletos || 0)).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {/* Valor na Conta */}
                        <div className="p-4 rounded-xl bg-primary-blue-light/10 border border-primary-blue-light/20 mb-4 text-center">
                            <p className="text-[9px] font-bold text-primary-blue-light uppercase mb-1">💰 VALOR NA CONTA</p>
                            <p className="text-2xl font-black text-primary-blue-light">R$ {(selectedFechamento.valor_na_conta || 0).toFixed(2)}</p>
                            <p className="text-[9px] text-muted mt-1">PIX Externo + (Entradas - Saídas)</p>
                        </div>

                        {/* Informações adicionais */}
                        {(selectedFechamento.valor_cofre || 0) > 0 && (
                            <div className="bg-surface-subtle p-3 rounded-lg border border-border mb-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted">Valor no cofre</span>
                                    <span className="font-bold">R$ {(selectedFechamento.valor_cofre || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* Justificativa */}
                        {selectedFechamento.justificativa && (
                            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <span className="text-[9px] text-yellow-500 font-bold uppercase">Justificativa do Operador</span>
                                <p className="text-xs text-yellow-600 dark:text-yellow-200 mt-1 italic">"{selectedFechamento.justificativa}"</p>
                            </div>
                        )}

                        {/* Botão de auditoria */}
                        {selectedFechamento.status_validacao === 'pendente' && (
                            <div className="mt-auto">
                                <button
                                    className="btn btn-primary w-full py-4 text-lg font-bold"
                                    onClick={() => setShowValidationModal(true)}
                                >
                                    <ShieldCheck className="mr-2" />
                                    Auditar Agora
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showValidationModal && selectedFechamento && (
                <ModalAuditoriaSimplificada
                    fechamento={selectedFechamento}
                    onClose={handleCloseModal}
                    onAprovar={(obs) => handleAprovar(parseInt(selectedFechamento.id), obs)}
                    onRejeitar={({ justificativa }) => handleRejeitar(parseInt(selectedFechamento.id), justificativa)}
                />
            )}
        </div>
    );
}
