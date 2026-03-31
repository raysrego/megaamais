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
    TrendingUp,
    TrendingDown,
    ArrowRightLeft
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

                {/* Informações básicas */}
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
                        <p className="text-xl font-bold">R$ {(fechamento.valor_inicial || 0).toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-bg-card border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Total Lançamentos</p>
                        <p className="text-xl font-bold">R$ {(fechamento.total_lancamentos || 0).toFixed(2)}</p>
                        <p className="text-[8px] text-muted">Entradas - Saídas</p>
                    </div>
                </div>

                {/* Valor na Conta (desconsidera valor inicial) */}
                <div className={`p-4 rounded-xl mb-6 ${
                    (fechamento.valor_na_conta || 0) >= 0 
                        ? 'bg-primary-blue-light/10 border border-primary-blue-light/20' 
                        : 'bg-warning/10 border border-warning/20'
                }`}>
                    <p className="text-[10px] font-bold uppercase mb-1 text-primary-blue-light">
                        💰 VALOR NA CONTA
                    </p>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted">Total recebido (desconsidera fundo inicial)</span>
                        <span className="text-2xl font-black text-primary-blue-light">
                            R$ {(fechamento.valor_na_conta || 0).toFixed(2)}
                        </span>
                    </div>
                    <div className="text-[10px] text-muted mt-2">
                        Cálculo: PIX Externo + (Entradas - Saídas)
                    </div>
                </div>

                {/* Saldo Esperado e Declarado */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Saldo Esperado</p>
                        <p className="text-lg font-bold">
                            R$ {(fechamento.saldo_esperado || 0).toFixed(2)}
                        </p>
                        <p className="text-[8px] text-muted">Inclui fundo inicial</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                        <p className="text-[10px] text-muted uppercase font-bold">Declarado pelo Operador</p>
                        <p className="text-lg font-bold">
                            R$ {(fechamento.saldo_no_caixa || 0).toFixed(2)}
                        </p>
                        <p className="text-[8px] text-muted">Dinheiro em mãos + cofre</p>
                    </div>
                </div>

                {/* Informações do Fechamento */}
                <div className="p-4 rounded-xl bg-surface-subtle border border-border mb-6">
                    <p className="text-[10px] font-bold text-muted uppercase mb-3">Informações do Fechamento</p>
                    <div className="space-y-2">
                        {(fechamento.valor_cofre || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Valor no cofre</span>
                                <span className="font-bold">R$ {(fechamento.valor_cofre || 0).toFixed(2)}</span>
                            </div>
                        )}
                        {(fechamento.valor_pix_externo || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">PIX externo</span>
                                <span className="font-bold">R$ {(fechamento.valor_pix_externo || 0).toFixed(2)}</span>
                            </div>
                        )}
                        {fechamento.fundo_caixa_devolvido !== undefined && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Fundo de Caixa</span>
                                <span className={`font-bold ${fechamento.fundo_caixa_devolvido ? 'text-success' : 'text-warning'}`}>
                                    {fechamento.fundo_caixa_devolvido ? 'Devolvido' : 'Não devolvido'}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm pt-2 border-t border-border">
                            <span className="text-muted">Entradas totais</span>
                            <span className="font-bold">R$ {((fechamento.total_pix || 0) + (fechamento.total_dinheiro || 0)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">Saídas totais</span>
                            <span className="font-bold">R$ {((fechamento.total_sangrias || 0) + (fechamento.total_depositos || 0) + (fechamento.total_boletos || 0) + (fechamento.total_trocados || 0)).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Justificativa do Operador */}
                {fechamento.justificativa && (
                    <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-[10px] text-yellow-500 font-bold uppercase">Justificativa do Operador</span>
                        <p className="text-sm text-yellow-600 dark:text-yellow-200 mt-1 italic">"{fechamento.justificativa}"</p>
                    </div>
                )}

                {/* Ações */}
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
                        <div className="flex gap-4 justify-end">
                            <button className="btn btn-ghost" onClick={() => setModoRejeitar(false)}>
                                Voltar
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => onRejeitar({ justificativa, diferenca })}
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
            let query = supabase
                .from('caixa_sessoes')
                .select(`
                    id,
                    data_turno,
                    data_fechamento,
                    terminal_id,
                    operador_id,
                    valor_inicial,
                    valor_final_declarado,
                    status,
                    observacoes,
                    valor_enviado_cofre,
                    pix_externo_informado,
                    fundo_caixa_devolvido,
                    resumo_entradas_pix,
                    resumo_entradas_dinheiro,
                    resumo_entradas_bolao_dinheiro,
                    resumo_entradas_bolao_pix,
                    resumo_saidas_sangria,
                    resumo_saidas_deposito,
                    resumo_saidas_boleto,
                    resumo_saidas_trocados,
                    resumo_total_entradas,
                    resumo_total_saidas
                `)
                .neq('status', 'aberto')
                .order('created_at', { ascending: false });

            if (filtroStatus !== 'todos') {
                let statusFilter: string;
                if (filtroStatus === 'fechado') statusFilter = 'fechado';
                else if (filtroStatus === 'batido') statusFilter = 'conferido';
                else if (filtroStatus === 'divergente') statusFilter = 'discrepante';
                else statusFilter = filtroStatus;
                query = query.eq('status', statusFilter);
            }

            const { data: sessoes, error } = await query;
            if (error) throw error;

            const fechamentosProcessados: Fechamento[] = [];

            for (const sessao of (sessoes || [])) {
                // Buscar operador nome
                let operadorNome = 'Sistema';
                if (sessao.operador_id) {
                    const { data: userData } = await supabase
                        .from('usuarios')
                        .select('nome')
                        .eq('id', sessao.operador_id)
                        .single();
                    if (userData) operadorNome = userData.nome;
                }

                // Totais
                const totalPix = (sessao.resumo_entradas_pix || 0) + (sessao.resumo_entradas_bolao_pix || 0);
                const totalDinheiro = (sessao.resumo_entradas_dinheiro || 0) + (sessao.resumo_entradas_bolao_dinheiro || 0);
                const totalEntradas = sessao.resumo_total_entradas || (totalPix + totalDinheiro);
                const totalSaidas = sessao.resumo_total_saidas || 0;
                
                // Total de lançamentos = entradas - saídas
                const totalLancamentos = totalEntradas - totalSaidas;
                
                // Saldo esperado = valor inicial + total de lançamentos
                const saldoEsperado = (sessao.valor_inicial || 0) + totalLancamentos;
                
                // Valor na conta = PIX externo + total de lançamentos (desconsidera valor inicial)
                const valorNaConta = (sessao.pix_externo_informado || 0) + totalLancamentos;
                
                // Saldo declarado pelo operador
                const saldoDeclarado = sessao.valor_final_declarado || 0;
                
                // Divergência (mantida para referência)
                const divergencia = saldoDeclarado - saldoEsperado;
                
                // Informações do cofre
                const valorCofre = sessao.valor_enviado_cofre || 0;
                const pixExterno = sessao.pix_externo_informado || 0;

                fechamentosProcessados.push({
                    id: sessao.id,
                    data_turno: sessao.data_turno,
                    data_fechamento: sessao.data_fechamento,
                    terminal_id: sessao.terminal_id || 'TFL-WEB',
                    operador_id: sessao.operador_id || 'Sistema',
                    operador_nome: operadorNome,
                    valor_inicial: sessao.valor_inicial || 0,
                    total_lancamentos: totalLancamentos,
                    saldo_no_caixa: saldoDeclarado,
                    divergencia: divergencia,
                    valor_na_conta: valorNaConta,
                    total_pix: totalPix,
                    total_dinheiro: totalDinheiro,
                    total_sangrias: sessao.resumo_saidas_sangria || 0,
                    total_depositos: sessao.resumo_saidas_deposito || 0,
                    total_boletos: sessao.resumo_saidas_boleto || 0,
                    total_trocados: sessao.resumo_saidas_trocados || 0,
                    status_validacao: sessao.status,
                    tipo: 'tfl',
                    justificativa: sessao.observacoes,
                    valor_cofre: valorCofre,
                    valor_pix_externo: pixExterno,
                    fundo_caixa_devolvido: sessao.fundo_caixa_devolvido,
                    saldo_esperado: saldoEsperado
                });
            }

            setFechamentos(fechamentosProcessados);
            console.log('[fetchHistorico] Fechamentos processados:', fechamentosProcessados.length);
            
        } catch (err: any) {
            console.error('Erro ao carregar histórico:', err);
            toast({ message: 'Erro ao carregar fechamentos: ' + (err.message || 'Erro desconhecido'), type: 'error' });
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
                        <p className="text-xs text-muted">Validação de encerramentos de turno</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <select
                        className="input text-xs"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value as any)}
                    >
                        <option value="todos">Todos os Encerramentos</option>
                        <option value="fechado">Pendentes</option>
                        <option value="batido">Aprovados</option>
                        <option value="divergente">Divergentes</option>
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
                                        <th className="text-right">Valor na Conta</th>
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
                                                (f.valor_na_conta || 0) >= 0 ? 'text-success' : 'text-danger'
                                            }`}>
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

                        {/* Entradas e Saídas */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                                <div className="flex items-center gap-1 mb-2">
                                    <TrendingUp size={12} className="text-success" />
                                    <span className="text-[9px] text-success uppercase font-bold">Entradas</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Total Entradas</span>
                                        <span className="font-bold text-success">R$ {((selectedFechamento.total_pix || 0) + (selectedFechamento.total_dinheiro || 0)).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-danger/5 border border-danger/20">
                                <div className="flex items-center gap-1 mb-2">
                                    <TrendingDown size={12} className="text-danger" />
                                    <span className="text-[9px] text-danger uppercase font-bold">Saídas</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Total Saídas</span>
                                        <span className="font-bold text-danger">R$ {((selectedFechamento.total_sangrias || 0) + (selectedFechamento.total_depositos || 0) + (selectedFechamento.total_boletos || 0) + (selectedFechamento.total_trocados || 0)).toFixed(2)}</span>
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
                                <div className="text-[8px] text-muted">Entradas - Saídas</div>
                            </div>
                        </div>

                        {/* Valor na Conta */}
                        <div className={`p-4 rounded-xl mb-4 ${
                            (selectedFechamento.valor_na_conta || 0) >= 0 
                                ? 'bg-primary-blue-light/10 border border-primary-blue-light/20' 
                                : 'bg-warning/10 border border-warning/20'
                        }`}>
                            <p className="text-[10px] font-bold uppercase mb-1 text-primary-blue-light">
                                💰 VALOR NA CONTA
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted">Total recebido (desconsidera fundo inicial)</span>
                                <span className="text-xl font-black text-primary-blue-light">
                                    R$ {(selectedFechamento.valor_na_conta || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="text-[9px] text-muted mt-1">
                                PIX Externo + (Entradas - Saídas)
                            </div>
                        </div>

                        {/* Saldo Esperado e Declarado */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3 rounded-lg bg-surface-subtle border border-border">
                                <div className="text-[9px] text-muted uppercase font-bold">Saldo Esperado</div>
                                <div className="text-sm font-bold">R$ {(selectedFechamento.saldo_esperado || 0).toFixed(2)}</div>
                                <div className="text-[8px] text-muted">Inclui fundo inicial</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-subtle border border-border">
                                <div className="text-[9px] text-muted uppercase font-bold">Declarado pelo Operador</div>
                                <div className="text-sm font-bold">R$ {(selectedFechamento.saldo_no_caixa || 0).toFixed(2)}</div>
                                <div className="text-[8px] text-muted">Dinheiro em mãos + cofre</div>
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
                            </div>
                        </div>

                        {/* Justificativa */}
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
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Auditoria */}
            {showValidationModal && selectedFechamento && (
                <ModalAuditoriaSimplificada
                    fechamento={selectedFechamento}
                    onClose={handleCloseModal}
                    onAprovar={async (obs) => {
                        const { error } = await supabase
                            .from('caixa_sessoes')
                            .update({
                                status: 'conferido',
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
                        const { error } = await supabase
                            .from('caixa_sessoes')
                            .update({
                                status: 'discrepante',
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
