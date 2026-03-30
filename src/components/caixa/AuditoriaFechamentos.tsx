'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    ChevronRight,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    ShieldCheck,
    Loader2,
    X,
    Smartphone,
    DollarSign,
    Building,
    FileText,
    ArrowRightLeft,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoneyInput } from '@/components/ui/MoneyInput';

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
    diferenca_apurada?: number;
    justificativa_divergencia?: string;
    // Campos brutos para debug
    _raw?: {
        entradas_pix?: number;
        entradas_dinheiro?: number;
        entradas_bolao_dinheiro?: number;
        entradas_bolao_pix?: number;
        saidas_sangria?: number;
        saidas_deposito?: number;
        saidas_boleto?: number;
        saidas_trocados?: number;
    };
}

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
    const [diferenca, setDiferenca] = useState<number | undefined>();
    const [tipoDiferenca, setTipoDiferenca] = useState<'falta' | 'sobra'>('falta');
    const [observacoes, setObservacoes] = useState('');

    // Cálculos baseados na interface Fechamento
    const valorInicial = fechamento.valor_inicial;
    const totalLancamentos = fechamento.total_lancamentos;
    const valorFinalCalculado = valorInicial + totalLancamentos;
    const totalCofre = fechamento.valor_cofre || 0;
    const totalPixExterno = fechamento.valor_pix_externo || 0;
    const saldoGeral = valorFinalCalculado + totalPixExterno;
    const totalEntradas = (fechamento.total_pix || 0) + (fechamento.total_dinheiro || 0);
    const totalSaidas = (fechamento.total_sangrias || 0) + 
                        (fechamento.total_depositos || 0) + 
                        (fechamento.total_boletos || 0) + 
                        (fechamento.total_trocados || 0);

    return (
        <>
            <div className="fixed inset-0 bg-black/80 z-9998" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl bg-bg-card border border-border rounded-2xl z-9999 p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Auditoria de Fechamento</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm">
                        <X size={18} />
                    </button>
                </div>

                {/* Informações básicas em grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-surface-subtle border border-border">
                    <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Terminal</p>
                        <p className="text-sm font-bold">{fechamento.terminal_id}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Operador</p>
                        <p className="text-sm font-bold">{fechamento.operador_nome}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Data do turno</p>
                        <p className="text-sm font-bold">
                            {fechamento.data_turno ? format(new Date(fechamento.data_turno), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Fechamento</p>
                        <p className="text-sm font-bold">
                            {fechamento.data_fechamento ? format(new Date(fechamento.data_fechamento), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                        </p>
                    </div>
                </div>

                {/* Detalhamento de Entradas e Saídas */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Entradas */}
                    <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp size={14} className="text-success" />
                            <span className="text-[10px] text-success uppercase font-bold">Entradas</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1 text-muted">
                                    <Smartphone size={12} /> PIX
                                </span>
                                <span className="font-bold font-mono">R$ {(fechamento.total_pix || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1 text-muted">
                                    <DollarSign size={12} /> Dinheiro
                                </span>
                                <span className="font-bold font-mono">R$ {(fechamento.total_dinheiro || 0).toFixed(2)}</span>
                            </div>
                            <div className="border-t border-success/20 my-2" />
                            <div className="flex justify-between text-sm font-bold">
                                <span>Total Entradas</span>
                                <span className="text-success">R$ {totalEntradas.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Saídas */}
                    <div className="p-4 rounded-xl bg-danger/5 border border-danger/20">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingDown size={14} className="text-danger" />
                            <span className="text-[10px] text-danger uppercase font-bold">Saídas</span>
                        </div>
                        <div className="space-y-2">
                            {(fechamento.total_sangrias || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="flex items-center gap-1 text-muted">
                                        <Building size={12} /> Sangrias
                                    </span>
                                    <span className="font-bold font-mono">R$ {(fechamento.total_sangrias || 0).toFixed(2)}</span>
                                </div>
                            )}
                            {(fechamento.total_depositos || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="flex items-center gap-1 text-muted">
                                        <Building size={12} /> Depósitos
                                    </span>
                                    <span className="font-bold font-mono">R$ {(fechamento.total_depositos || 0).toFixed(2)}</span>
                                </div>
                            )}
                            {(fechamento.total_boletos || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="flex items-center gap-1 text-muted">
                                        <FileText size={12} /> Boletos
                                    </span>
                                    <span className="font-bold font-mono">R$ {(fechamento.total_boletos || 0).toFixed(2)}</span>
                                </div>
                            )}
                            {(fechamento.total_trocados || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="flex items-center gap-1 text-muted">
                                        <ArrowRightLeft size={12} /> Trocados
                                    </span>
                                    <span className="font-bold font-mono">R$ {(fechamento.total_trocados || 0).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t border-danger/20 my-2" />
                            <div className="flex justify-between text-sm font-bold">
                                <span>Total Saídas</span>
                                <span className="text-danger">R$ {totalSaidas.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Totais principais */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-bg-card border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Valor Inicial</p>
                        <p className="text-xl font-bold text-text-primary">R$ {valorInicial.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-bg-card border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Total de Lançamentos</p>
                        <p className="text-xl font-bold text-text-primary">R$ {totalLancamentos.toFixed(2)}</p>
                    </div>
                </div>

                {/* Informações do cofre e pix externo */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-bg-card border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Total Cofre</p>
                        <p className="text-xl font-bold text-primary">R$ {totalCofre.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-bg-card border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">PIX Externo</p>
                        <p className="text-xl font-bold text-primary">R$ {totalPixExterno.toFixed(2)}</p>
                    </div>
                </div>

                {/* Saldo Esperado e Declarado */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Saldo Esperado</p>
                        <p className="text-lg font-bold font-mono">
                            R$ {(fechamento.saldo_esperado || 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Declarado pelo Operador</p>
                        <p className="text-lg font-bold font-mono">
                            R$ {(fechamento.saldo_no_caixa || 0).toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Saldo geral (final calculado + pix externo) */}
                <div className={`p-4 rounded-xl mb-6 ${
                    Math.abs(fechamento.divergencia) < 0.01 
                        ? 'bg-success/10 border border-success/20' 
                        : 'bg-warning/10 border border-warning/20'
                }`}>
                    <p className="text-[10px] font-bold uppercase mb-1">
                        {Math.abs(fechamento.divergencia) < 0.01 ? '✓ VALORES CONFEREM' : '⚠ DIVERGÊNCIA DETECTADA'}
                    </p>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted">Diferença apurada</span>
                        <span className={`text-2xl font-black ${
                            fechamento.divergencia > 0 ? 'text-warning' : 
                            fechamento.divergencia < 0 ? 'text-danger' : 'text-success'
                        }`}>
                            {fechamento.divergencia > 0 ? '+' : ''}R$ {Math.abs(fechamento.divergencia).toFixed(2)}
                        </span>
                    </div>
                    {Math.abs(fechamento.divergencia) > 0.01 && (
                        <p className="text-xs text-muted mt-2">
                            {fechamento.divergencia > 0 
                                ? 'Sobra de caixa - valor maior que o esperado' 
                                : 'Falta de caixa - valor menor que o esperado'}
                        </p>
                    )}
                </div>

                {/* Fundo de Caixa */}
                {fechamento.fundo_caixa_devolvido !== undefined && (
                    <div className="p-3 rounded-lg bg-surface-subtle border border-border mb-4">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted">Fundo de Caixa</span>
                            <span className={`font-bold ${fechamento.fundo_caixa_devolvido ? 'text-success' : 'text-warning'}`}>
                                {fechamento.fundo_caixa_devolvido ? 'Devolvido (R$ 100,00)' : 'Não devolvido'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Justificativa do Operador */}
                {fechamento.justificativa && (
                    <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-[10px] text-yellow-500 font-bold uppercase">Justificativa do Operador</span>
                        <p className="text-sm text-yellow-600 dark:text-yellow-200 mt-1 italic">"{fechamento.justificativa}"</p>
                    </div>
                )}

                {/* Ações (aprovar/rejeitar) */}
                {!modoRejeitar ? (
                    <div className="flex gap-4 justify-end">
                        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                        <button
                            className="btn bg-danger/10 text-danger hover:bg-danger/20"
                            onClick={() => setModoRejeitar(true)}
                        >
                            Rejeitar
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={() => onAprovar(observacoes)}
                        >
                            Aprovar
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="form-group">
                            <label className="text-sm font-bold">Justificativa da rejeição</label>
                            <textarea
                                className="input w-full"
                                rows={3}
                                value={justificativa}
                                onChange={(e) => setJustificativa(e.target.value)}
                                placeholder="Descreva o motivo da rejeição"
                            />
                        </div>

                        <div className="form-group">
                            <label className="text-sm font-bold">Diferença apurada (opcional)</label>
                            <div className="flex gap-2 items-center">
                                <select
                                    className="input w-24"
                                    value={tipoDiferenca}
                                    onChange={(e) => setTipoDiferenca(e.target.value as any)}
                                >
                                    <option value="falta">Falta</option>
                                    <option value="sobra">Sobra</option>
                                </select>
                                <MoneyInput
                                    value={diferenca || 0}
                                    onValueChange={(val) => setDiferenca(val)}
                                    placeholder="0,00"
                                    className="flex-1"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 justify-end">
                            <button className="btn btn-ghost" onClick={() => setModoRejeitar(false)}>
                                Voltar
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => {
                                    const valorDiferenca = diferenca
                                        ? (tipoDiferenca === 'falta' ? -diferenca : diferenca)
                                        : undefined;
                                    onRejeitar({ justificativa, diferenca: valorDiferenca });
                                }}
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
    const [filtroStatus, setFiltroStatus] = useState<'todos' | 'fechado' | 'divergente' | 'batido'>('todos');

   const fetchHistorico = useCallback(async () => {
    setLoading(true);
    try {
        // ---------- QUERY TFL (caixa_sessoes) - CORRIGIDA ----------
        let queryTFL = supabase
            .from('caixa_sessoes')
            .select(`
                id,
                data_turno,
                data_fechamento,
                terminal_id,
                operador_id,
                valor_inicial,
                valor_final_calculado,
                valor_final_declarado,
                status,
                observacoes,
                resumo_entradas_pix,
                resumo_entradas_dinheiro,
                resumo_entradas_bolao_dinheiro,
                resumo_entradas_bolao_pix,
                resumo_saidas_sangria,
                resumo_saidas_deposito,
                resumo_saidas_boleto,
                resumo_saidas_trocados,
                resumo_total_entradas,
                resumo_total_saidas,
                dinheiro_em_maos,
                valor_enviado_cofre,
                pix_externo_informado,
                fundo_caixa_devolvido,
                saldo_esperado_dinheiro,
                diferenca_caixa,
                total_sangrias,
                total_depositos_filial,
                valor_cofre,
                valor_pix_externo,
                diferenca_apurada,
                justificativa_divergencia
            `)
            .neq('status', 'aberto')
            .order('created_at', { ascending: false });

        if (filtroStatus !== 'todos') {
            let statusFilter: string;
            if (filtroStatus === 'fechado') statusFilter = 'fechado';
            else if (filtroStatus === 'batido') statusFilter = 'conferido';
            else if (filtroStatus === 'divergente') statusFilter = 'discrepante';
            else statusFilter = filtroStatus;
            queryTFL = queryTFL.eq('status', statusFilter);
        }

        const { data: dataTFL, error: errorTFL } = await queryTFL;
        if (errorTFL) throw errorTFL;

        // ---------- QUERY BOLÃO (caixa_bolao_sessoes) ----------
        let queryBolao = supabase
            .from('caixa_bolao_sessoes')
            .select(`
                id,
                data_fechamento,
                total_dinheiro,
                total_pix,
                total_vendido,
                status_validacao,
                observacoes_gerente
            `)
            .order('data_fechamento', { ascending: false });

        if (filtroStatus !== 'todos') {
            let statusFilter: string[] = [];
            if (filtroStatus === 'fechado') {
                statusFilter = ['pendente'];
            } else if (filtroStatus === 'batido') {
                statusFilter = ['aprovado'];
            } else if (filtroStatus === 'divergente') {
                statusFilter = ['rejeitado', 'discrepante'];
            }
            if (statusFilter.length > 0) {
                queryBolao = queryBolao.in('status_validacao', statusFilter);
            }
        }

        const { data: dataBolao, error: errorBolao } = await queryBolao;
        if (errorBolao) throw errorBolao;

        // ---------- Normalizar dados TFL com TODOS os campos ----------
        const fechamentosTFL: Fechamento[] = (dataTFL || []).map((f: any) => {
            // Calcula totais a partir dos resumos
            const totalPix = (f.resumo_entradas_pix || 0) + (f.resumo_entradas_bolao_pix || 0);
            const totalDinheiro = (f.resumo_entradas_dinheiro || 0) + (f.resumo_entradas_bolao_dinheiro || 0);
            const totalEntradas = totalPix + totalDinheiro;
            const totalSaidas = (f.resumo_saidas_sangria || 0) + 
                                (f.resumo_saidas_deposito || 0) + 
                                (f.resumo_saidas_boleto || 0) + 
                                (f.resumo_saidas_trocados || 0);
            const totalLancamentos = totalEntradas - totalSaidas;
            const saldoNoCaixa = f.dinheiro_em_maos || f.valor_final_declarado || 0;
            const divergencia = f.diferenca_caixa || (saldoNoCaixa - ((f.valor_inicial || 0) + totalLancamentos));

            return {
                id: f.id,
                data_turno: f.data_turno,
                data_fechamento: f.data_fechamento,
                terminal_id: f.terminal_id || 'TFL-WEB',
                operador_id: f.operador_id || 'Sistema',
                operador_nome: f.operador_id ? `${f.operador_id.split('-')[0]}...` : 'Sistema',
                valor_inicial: f.valor_inicial || 0,
                total_lancamentos: totalLancamentos,
                saldo_no_caixa: saldoNoCaixa,
                divergencia: divergencia,
                total_pix: totalPix,
                total_dinheiro: totalDinheiro,
                total_sangrias: f.resumo_saidas_sangria || 0,
                total_depositos: f.resumo_saidas_deposito || 0,
                total_boletos: f.resumo_saidas_boleto || 0,
                total_trocados: f.resumo_saidas_trocados || 0,
                status_validacao: f.status,
                tipo: 'tfl',
                justificativa: f.observacoes,
                valor_cofre: f.valor_enviado_cofre || f.valor_cofre || 0,
                valor_pix_externo: f.pix_externo_informado || f.valor_pix_externo || 0,
                fundo_caixa_devolvido: f.fundo_caixa_devolvido,
                saldo_esperado: f.saldo_esperado_dinheiro,
                diferenca_apurada: f.diferenca_apurada,
                justificativa_divergencia: f.justificativa_divergencia
            };
        });

        // ---------- Normalizar dados Bolão ----------
        const fechamentosBolao: Fechamento[] = (dataBolao || []).map((f: any) => {
            const totalLancamentos = f.total_vendido || 0;
            const saldoNoCaixa = (f.total_dinheiro || 0) + (f.total_pix || 0);
            const divergencia = totalLancamentos - saldoNoCaixa;
            return {
                id: f.id,
                data_turno: f.data_fechamento,
                data_fechamento: f.data_fechamento,
                terminal_id: 'Bolão',
                operador_id: '',
                operador_nome: 'Sistema Bolão',
                valor_inicial: 0,
                total_lancamentos: totalLancamentos,
                saldo_no_caixa: saldoNoCaixa,
                divergencia: divergencia,
                total_pix: f.total_pix || 0,
                total_dinheiro: f.total_dinheiro || 0,
                total_sangrias: 0,
                total_depositos: 0,
                total_boletos: 0,
                total_trocados: 0,
                status_validacao: f.status_validacao || 'pendente',
                tipo: 'bolao',
                justificativa: f.observacoes_gerente,
                valor_cofre: undefined,
                valor_pix_externo: undefined,
                fundo_caixa_devolvido: undefined,
                saldo_esperado: undefined,
                diferenca_apurada: undefined,
                justificativa_divergencia: undefined
            };
        });

        const todosFechamentos = [...fechamentosTFL, ...fechamentosBolao];
        setFechamentos(todosFechamentos);
        
        // Log para debug
        console.log('[fetchHistorico] Fechamentos carregados:', fechamentosTFL.length, 'TFL,', fechamentosBolao.length, 'Bolão');
        if (fechamentosTFL.length > 0) {
            console.log('[fetchHistorico] Primeiro fechamento TFL:', {
                id: fechamentosTFL[0].id,
                total_pix: fechamentosTFL[0].total_pix,
                total_dinheiro: fechamentosTFL[0].total_dinheiro,
                total_sangrias: fechamentosTFL[0].total_sangrias,
                total_boletos: fechamentosTFL[0].total_boletos,
                total_lancamentos: fechamentosTFL[0].total_lancamentos,
                saldo_esperado: fechamentosTFL[0].saldo_esperado,
                saldo_no_caixa: fechamentosTFL[0].saldo_no_caixa,
                divergencia: fechamentosTFL[0].divergencia
            });
        }
        
    } catch (err: any) {
        console.error('Erro ao carregar histórico:', err);
        const errorMsg = err?.message || err?.error_description || err?.details || 'Erro desconhecido';
        toast({ message: 'Erro ao carregar fechamentos: ' + errorMsg, type: 'error' });
    } finally {
        setLoading(false);
    }
}, [supabase, filtroStatus, toast]);

    useEffect(() => {
        fetchHistorico();
    }, [fetchHistorico]);

    const handleCloseModal = () => {
        setShowValidationModal(false);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            fechado: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            discrepante: 'bg-red-500/10 text-red-400 border-red-500/20',
            divergente: 'bg-red-500/10 text-red-400 border-red-500/20',
            aprovado: 'bg-green-500/10 text-green-400 border-green-500/20',
            batido: 'bg-green-500/10 text-green-400 border-green-500/20',
            rejeitado: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
            conferido: 'bg-green-500/10 text-green-400 border-green-500/20',
            correcao_solicitada: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
        };

        const labels: Record<string, string> = {
            fechado: 'AGUARDANDO',
            batido: 'APROVADO',
            divergente: 'REPROVADO',
            pendente: 'PENDENTE',
            discrepante: 'DIVERGENTE',
            aprovado: 'APROVADO',
            rejeitado: 'REJEITADO',
            conferido: 'CONFERIDO',
            correcao_solicitada: 'CORREÇÃO'
        };

        return (
            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${styles[status] || ''}`}>
                {labels[status] || status}
            </span>
        );
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
                        <p className="text-xs text-muted">Validação de encerramentos de turno (TFL + Bolão)</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <select
                        className="input text-xs"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value as any)}
                    >
                        <option value="todos">Todos os Encerramentos</option>
                        <option value="fechado">Pendentes (Aguardando Auditoria)</option>
                        <option value="batido">Batidos (Aprovados)</option>
                        <option value="divergente">Divergentes (Reprovados)</option>
                    </select>
                    <button onClick={fetchHistorico} className="btn btn-ghost btn-sm">
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedFechamento ? '1fr 480px' : '1fr', gap: '1.5rem', transition: 'all 0.3s ease' }}>
                {/* Tabela de Fechamentos */}
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
                                    <tr>
                                        <th>Data Turno</th>
                                        <th>Data Fechamento</th>
                                        <th>Terminal</th>
                                        <th>Operador</th>
                                        <th>Status</th>
                                        <th className="text-right">Diferença</th>
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
                                            <td className="text-xs">
                                                {f.data_turno ? format(new Date(f.data_turno), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                                            </td>
                                            <td className="text-xs">
                                                {f.data_fechamento ? format(new Date(f.data_fechamento), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                                            </td>
                                            <td>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                                                    f.tipo === 'tfl' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                                                }`}>
                                                    {f.terminal_id}
                                                </span>
                                            </td>
                                            <td className="text-xs opacity-60">{f.operador_nome}</td>
                                            <td>{getStatusBadge(f.status_validacao)}</td>
                                            <td className={`font-bold text-right ${
                                                Math.abs(f.divergencia) < 0.01 ? 'text-success' : 'text-danger'
                                            }`}>
                                                {f.divergencia > 0 ? '+' : ''}R$ {f.divergencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    <div className="card flex flex-col h-full animate-in slide-in-from-right duration-300 overflow-y-auto max-h-[80vh]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Detalhes do Turno</h3>
                            <button onClick={() => setSelectedFechamento(null)} className="btn btn-ghost btn-sm px-2">
                                fechar
                            </button>
                        </div>

                        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-surface-subtle border border-border">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                selectedFechamento.status_validacao === 'batido' || selectedFechamento.status_validacao === 'aprovado' || selectedFechamento.status_validacao === 'conferido'
                                    ? 'bg-success/10 text-success'
                                    : selectedFechamento.status_validacao === 'fechado' || selectedFechamento.status_validacao === 'pendente'
                                        ? 'bg-warning/10 text-warning'
                                        : 'bg-danger/10 text-danger'
                            }`}>
                                {selectedFechamento.status_validacao === 'batido' || selectedFechamento.status_validacao === 'aprovado' || selectedFechamento.status_validacao === 'conferido'
                                    ? <CheckCircle2 size={24} />
                                    : selectedFechamento.status_validacao === 'fechado' || selectedFechamento.status_validacao === 'pendente'
                                        ? <ShieldCheck size={24} />
                                        : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <div className="text-lg font-bold">{selectedFechamento.terminal_id}</div>
                                <div className="text-xs text-muted font-mono">{selectedFechamento.operador_id}</div>
                            </div>
                        </div>

                        {/* Detalhamento de Entradas e Saídas */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {/* Entradas */}
                            <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                                <div className="flex items-center gap-1 mb-2">
                                    <TrendingUp size={12} className="text-success" />
                                    <span className="text-[9px] text-success uppercase font-bold">Entradas</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="flex items-center gap-1 text-muted"><Smartphone size={10} /> PIX</span>
                                        <span className="font-bold">R$ {(selectedFechamento.total_pix || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="flex items-center gap-1 text-muted"><DollarSign size={10} /> Dinheiro</span>
                                        <span className="font-bold">R$ {(selectedFechamento.total_dinheiro || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-success/20 my-1" />
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Total</span>
                                        <span className="text-success">R$ {((selectedFechamento.total_pix || 0) + (selectedFechamento.total_dinheiro || 0)).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Saídas */}
                            <div className="p-3 rounded-xl bg-danger/5 border border-danger/20">
                                <div className="flex items-center gap-1 mb-2">
                                    <TrendingDown size={12} className="text-danger" />
                                    <span className="text-[9px] text-danger uppercase font-bold">Saídas</span>
                                </div>
                                <div className="space-y-1">
                                    {(selectedFechamento.total_sangrias || 0) > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1 text-muted"><Building size={10} /> Sangria</span>
                                            <span className="font-bold">R$ {(selectedFechamento.total_sangrias || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(selectedFechamento.total_depositos || 0) > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1 text-muted"><Building size={10} /> Depósito</span>
                                            <span className="font-bold">R$ {(selectedFechamento.total_depositos || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(selectedFechamento.total_boletos || 0) > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1 text-muted"><FileText size={10} /> Boleto</span>
                                            <span className="font-bold">R$ {(selectedFechamento.total_boletos || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-danger/20 my-1" />
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Total</span>
                                        <span className="text-danger">R$ {((selectedFechamento.total_sangrias || 0) + (selectedFechamento.total_depositos || 0) + (selectedFechamento.total_boletos || 0) + (selectedFechamento.total_trocados || 0)).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Totais principais */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3 rounded-lg bg-bg-card border border-border">
                                <div className="text-[9px] text-muted uppercase font-bold">Valor Inicial</div>
                                <div className="text-base font-bold">R$ {(selectedFechamento.valor_inicial || 0).toFixed(2)}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-bg-card border border-border">
                                <div className="text-[9px] text-muted uppercase font-bold">Total Lançamentos</div>
                                <div className="text-base font-bold">R$ {(selectedFechamento.total_lancamentos || 0).toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Informações do Fechamento */}
                        <div className="border-t border-border pt-3 mb-4">
                            <div className="text-[9px] text-muted font-bold uppercase mb-2">Informações do Fechamento</div>
                            <div className="space-y-2">
                                {(selectedFechamento.valor_cofre || 0) > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Valor no cofre</span>
                                        <span className="font-bold">R$ {(selectedFechamento.valor_cofre || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {(selectedFechamento.valor_pix_externo || 0) > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">PIX externo</span>
                                        <span className="font-bold">R$ {(selectedFechamento.valor_pix_externo || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {selectedFechamento.fundo_caixa_devolvido !== undefined && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Fundo de Caixa</span>
                                        <span className={`font-bold ${selectedFechamento.fundo_caixa_devolvido ? 'text-success' : 'text-warning'}`}>
                                            {selectedFechamento.fundo_caixa_devolvido ? 'Devolvido' : 'Não devolvido'}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs pt-2 border-t border-border">
                                    <span className="text-muted font-bold">Saldo Esperado</span>
                                    <span className="font-bold">R$ {(selectedFechamento.saldo_esperado || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted">Declarado pelo Operador</span>
                                    <span className="font-bold">R$ {(selectedFechamento.saldo_no_caixa || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Divergência */}
                        {Math.abs(selectedFechamento.divergencia) > 0.01 && (
                            <div className="bg-danger/10 border border-danger/20 p-3 rounded-lg flex items-start gap-2 mb-4">
                                <AlertTriangle className="text-danger shrink-0" size={16} />
                                <div>
                                    <div className="text-xs font-bold text-danger">Divergência Detectada</div>
                                    <div className="text-[10px] text-muted mt-1">
                                        Diferença de R$ {Math.abs(selectedFechamento.divergencia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        {selectedFechamento.divergencia > 0 ? ' (sobra)' : ' (falta)'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Justificativa do Operador */}
                        {selectedFechamento.justificativa && (
                            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <span className="text-[9px] text-yellow-500 font-bold uppercase">Justificativa do Operador</span>
                                <p className="text-xs text-yellow-600 dark:text-yellow-200 mt-1 italic">"{selectedFechamento.justificativa}"</p>
                            </div>
                        )}

                        {/* Botão de auditoria */}
                        {['fechado', 'divergente', 'pendente', 'discrepante', 'correcao_solicitada'].includes(selectedFechamento.status_validacao) && (
                            <div className="mt-auto">
                                <button
                                    className="btn btn-primary w-full py-4 text-lg font-bold"
                                    onClick={() => setShowValidationModal(true)}
                                >
                                    <ShieldCheck className="mr-2" />
                                    {selectedFechamento.status_validacao === 'divergente' || selectedFechamento.status_validacao === 'discrepante'
                                        ? 'Revalidar Fechamento'
                                        : selectedFechamento.status_validacao === 'correcao_solicitada'
                                            ? 'Avaliar Correção'
                                            : 'Auditar Agora'}
                                </button>
                                <p className="text-xs text-center text-muted mt-2">Valide os valores informados</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Auditoria Simplificada */}
            {showValidationModal && selectedFechamento && (
                <ModalAuditoriaSimplificada
                    fechamento={selectedFechamento}
                    onClose={handleCloseModal}
                    onAprovar={async (obs) => {
                        const tabela = selectedFechamento.tipo === 'tfl' ? 'caixa_sessoes' : 'caixa_bolao_sessoes';
                        const statusField = selectedFechamento.tipo === 'tfl' ? 'status' : 'status_validacao';
                        const novoStatus = selectedFechamento.tipo === 'tfl' ? 'conferido' : 'aprovado';

                        const { error } = await supabase
                            .from(tabela)
                            .update({
                                [statusField]: novoStatus,
                                observacoes_gerente: obs,
                                data_validacao: new Date().toISOString()
                            })
                            .eq('id', selectedFechamento.id);

                        if (error) {
                            toast({ message: 'Erro ao aprovar: ' + error.message, type: 'error' });
                        } else {
                            toast({ message: `Sessão ${selectedFechamento.terminal_id} validada com sucesso!`, type: 'success' });
                            handleCloseModal();
                            fetchHistorico();
                            setSelectedFechamento(null);
                        }
                    }}
                    onRejeitar={async ({ justificativa, diferenca }) => {
                        const tabela = selectedFechamento.tipo === 'tfl' ? 'caixa_sessoes' : 'caixa_bolao_sessoes';
                        const statusField = selectedFechamento.tipo === 'tfl' ? 'status' : 'status_validacao';
                        const novoStatus = selectedFechamento.tipo === 'tfl' ? 'discrepante' : 'rejeitado';

                        const { error } = await supabase
                            .from(tabela)
                            .update({
                                [statusField]: novoStatus,
                                observacoes_gerente: justificativa,
                                diferenca_apurada: diferenca || 0,
                                data_validacao: new Date().toISOString()
                            })
                            .eq('id', selectedFechamento.id);

                        if (error) {
                            toast({ message: 'Erro ao rejeitar: ' + error.message, type: 'error' });
                        } else {
                            toast({ message: 'Fechamento reprovado.', type: 'warning' });
                            handleCloseModal();
                            fetchHistorico();
                            setSelectedFechamento(null);
                        }
                    }}
                />
            )}
        </div>
    );
}
