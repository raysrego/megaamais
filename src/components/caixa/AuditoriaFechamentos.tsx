'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    ChevronRight,
    CheckCircle2,
    AlertTriangle,
    FileText,
    RefreshCw,
    ShieldCheck,
    Loader2,
    XCircle,
    UploadCloud,
    FileSearch,
    User,
    ArrowRight,
    X
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Fechamento {
    id: string;
    data_fechamento: string;
    terminal_id: string;
    operador_id: string;
    operador_nome?: string;
    saldo_sistema: number;
    saldo_informado: number;
    divergencia: number;
    total_pix: number;
    total_dinheiro: number;
    total_cartao?: number;
    total_sangrias: number;
    total_depositos: number;
    status_validacao: 'pendente' | 'aprovado' | 'discrepante' | 'rejeitado' | 'fechado' | 'batido' | 'divergente';
    tipo: 'tfl' | 'bolao';
    justificativa?: string;
    detalhado?: any;
}

interface ExtratoPixItem {
    id: string;
    data: string;
    descricao: string;
    valor: number;
    classificacao: string;
    conciliado?: boolean;
}

interface Divergencia {
    tipo: 'SISTEMA' | 'EXTRATO';
    desc: string;
    valor: number;
}

const CLASSIFICACOES_VALIDAS_PIX = [
    'CRED PIX QR COD EST',
    'PIX RECEBIDO',
    'PIX RECEBIDO DADOS DA CONTA',
    'CRED PIX CHAVE'
];

export function AuditoriaFechamentos() {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
    const [selectedFechamento, setSelectedFechamento] = useState<Fechamento | null>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [filtroStatus, setFiltroStatus] = useState<'todos' | 'fechado' | 'divergente' | 'batido'>('todos');

    // Estados do Modal de Validação
    const [step, setStep] = useState(1); // 1: Info + Upload, 2: Resultado
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extratoParsed, setExtratoParsed] = useState<ExtratoPixItem[]>([]);
    const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
    const [observacoes, setObservacoes] = useState('');

    const fetchHistorico = useCallback(async () => {
        setLoading(true);
        try {
            // Buscar fechamentos de TFL (caixa_sessoes)
            let queryTFL = supabase
                .from('caixa_sessoes')
                .select(`
                    id,
                    created_at,
                    terminal_id,
                    operador_id,
                    valor_final_calculado,
                    valor_final_declarado,
                    status
                `)
                .neq('status', 'aberto')
                .order('created_at', { ascending: false });

            if (filtroStatus !== 'todos') {
                queryTFL = queryTFL.eq('status', filtroStatus);
            }

            const { data: dataTFL, error: errorTFL } = await queryTFL;
            if (errorTFL) throw errorTFL;

            // Buscar fechamentos de Bolão
            let queryBolao = supabase
                .from('caixa_bolao_sessoes')
                .select(`
                    id,
                    data_fechamento,
                    total_dinheiro,
                    total_pix,
                    total_vendido,
                    status_validacao
                `)
                .in('status_validacao', filtroStatus === 'todos'
                    ? ['pendente', 'discrepante', 'fechado', 'batido', 'divergente']
                    : [filtroStatus === 'fechado' ? 'pendente' : filtroStatus])
                .order('data_fechamento', { ascending: false });

            const { data: dataBolao, error: errorBolao } = await queryBolao;
            if (errorBolao) throw errorBolao;

            // Normalizar dados TFL
            const fechamentosTFL: Fechamento[] = (dataTFL || []).map((f: any) => {
                const diff = (f.valor_final_declarado || 0) - (f.valor_final_calculado || 0);
                return {
                    id: f.id,
                    data_fechamento: f.created_at,
                    terminal_id: f.terminal_id || 'TFL-WEB',
                    operador_id: f.operador_id || 'Sistema',
                    operador_nome: f.operador_id ? `${f.operador_id.split('-')[0]}...` : 'Sistema',
                    saldo_sistema: f.valor_final_calculado || 0,
                    saldo_informado: f.valor_final_declarado || 0,
                    divergencia: diff,
                    total_pix: 0,
                    total_dinheiro: f.valor_final_declarado || 0,
                    total_sangrias: 0,
                    total_depositos: 0,
                    status_validacao: f.status,
                    tipo: 'tfl'
                };
            });

            // Normalizar dados Bolão
            const fechamentosBolao: Fechamento[] = (dataBolao || []).map((f: any) => ({
                id: f.id,
                data_fechamento: f.data_fechamento,
                terminal_id: 'Bolão',
                operador_id: '',
                operador_nome: 'Sistema Bolão',
                saldo_sistema: f.total_vendido || 0,
                saldo_informado: (f.total_dinheiro || 0) + (f.total_pix || 0),
                divergencia: (f.total_vendido || 0) - ((f.total_dinheiro || 0) + (f.total_pix || 0)),
                total_pix: f.total_pix || 0,
                total_dinheiro: f.total_dinheiro || 0,
                total_sangrias: 0,
                total_depositos: 0,
                status_validacao: f.status_validacao || 'pendente',
                tipo: 'bolao'
            }));

            setFechamentos([...fechamentosTFL, ...fechamentosBolao]);
        } catch (err: any) {
            console.error('Erro ao carregar histórico:', err);
            toast({ message: 'Erro ao carregar fechamentos: ' + err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [supabase, filtroStatus, toast]);

    useEffect(() => {
        fetchHistorico();
    }, [fetchHistorico]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = event.target.files?.[0];
        if (uploadedFile) setFile(uploadedFile);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) setFile(droppedFile);
    };

    const parseExtratoCSV = (fileContent: string): ExtratoPixItem[] => {
        const lines = fileContent.split('\n');
        const parsed: ExtratoPixItem[] = [];

        // Assume formato: DATA;DESCRICAO;VALOR;CLASSIFICACAO
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const [data, descricao, valorStr, classificacao] = line.split(';');
            if (!data || !valorStr) continue;

            const valor = parseFloat(valorStr.replace(',', '.').replace(/[^\d.-]/g, ''));
            if (isNaN(valor)) continue;

            parsed.push({
                id: `e${i}`,
                data: data.trim(),
                descricao: descricao?.trim() || '',
                valor,
                classificacao: classificacao?.trim() || ''
            });
        }

        return parsed;
    };

    const analyzeExtract = async () => {
        if (!file || !selectedFechamento) return;

        setIsAnalyzing(true);
        try {
            // 1. Validar tipo de arquivo
            if (file.name.toLowerCase().endsWith('.pdf')) {
                toast({
                    message: 'PDFs ainda não são suportados. Por favor, exporte seu extrato como CSV.',
                    type: 'error'
                });
                setIsAnalyzing(false);
                return;
            }

            // 2. Ler arquivo CSV
            const fileContent = await file.text();
            const extratoItems = parseExtratoCSV(fileContent);

            // 3. Validar se conseguiu parsear algum item
            if (extratoItems.length === 0) {
                toast({
                    message: 'Nenhum item foi encontrado no extrato. Verifique se o arquivo está no formato correto (CSV com separador ponto-e-vírgula).',
                    type: 'error'
                });
                setIsAnalyzing(false);
                return;
            }

            // 4. Buscar movimentações PIX reais desta sessão
            let movimentacoes: any[] = [];

            if (selectedFechamento.tipo === 'tfl') {
                const { data, error } = await supabase
                    .from('caixa_movimentacoes')
                    .select('*')
                    .eq('sessao_id', selectedFechamento.id)
                    .eq('tipo', 'pix');

                if (error) throw error;
                movimentacoes = data || [];
            } else {
                // Para Bolão, usar total_pix informado
                if (selectedFechamento.total_pix > 0) {
                    movimentacoes = [{
                        valor: selectedFechamento.total_pix,
                        descricao: 'PIX Total Bolão',
                        classificacao_pix: 'PIX RECEBIDO'
                    }];
                }
            }

            // 5. Filtrar apenas PIX válidos do extrato
            const pixValidos = extratoItems.filter(item =>
                CLASSIFICACOES_VALIDAS_PIX.some(classif =>
                    item.classificacao.toUpperCase().includes(classif)
                )
            );

            // 6. Validar se encontrou PIX válidos
            if (pixValidos.length === 0 && movimentacoes.length > 0) {
                toast({
                    message: `Atenção: Nenhuma transação PIX válida encontrada no extrato, mas há ${movimentacoes.length} PIX no sistema!`,
                    type: 'warning'
                });
            }

            // 7. Algoritmo de Batimento (Valor + Classificação)
            const novasDivergencias: Divergencia[] = [];
            const extratoConciliado = pixValidos.map(item => {
                const match = movimentacoes.find((mov: any) =>
                    Math.abs(mov.valor - item.valor) < 0.01 &&
                    (!mov.classificacao_pix || item.classificacao.includes(mov.classificacao_pix))
                );

                if (!match) {
                    novasDivergencias.push({
                        tipo: 'EXTRATO',
                        desc: `Item não encontrado no caixa: ${item.descricao}`,
                        valor: item.valor
                    });
                }

                return { ...item, conciliado: !!match };
            });

            // 8. Verificar itens no caixa que não estão no extrato
            movimentacoes.forEach((mov: any) => {
                const match = pixValidos.find(item =>
                    Math.abs(item.valor - mov.valor) < 0.01
                );
                if (!match) {
                    novasDivergencias.push({
                        tipo: 'SISTEMA',
                        desc: `Lançamento sem correspondente no banco: ${mov.descricao || 'PIX'}`,
                        valor: mov.valor
                    });
                }
            });

            setExtratoParsed(extratoConciliado);
            setDivergencias(novasDivergencias);
            setStep(2);

            // 9. Feedback inteligente
            if (pixValidos.length === 0 && movimentacoes.length === 0) {
                toast({
                    message: 'Nenhuma transação PIX encontrada no extrato nem no sistema. Validação concluída.',
                    type: 'info'
                });
            } else if (novasDivergencias.length === 0) {
                toast({
                    message: `✅ Conciliação perfeita! ${pixValidos.length} PIX batidos com sucesso.`,
                    type: 'success'
                });
            } else {
                toast({
                    message: `⚠️ ${novasDivergencias.length} divergência(s) detectada(s) de ${pixValidos.length + movimentacoes.length} itens analisados`,
                    type: 'warning'
                });
            }
        } catch (error: any) {
            console.error('Erro na auditoria:', error);
            toast({ message: 'Falha ao processar conciliação: ' + error.message, type: 'error' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAprovar = async () => {
        if (!selectedFechamento) return;

        const tabela = selectedFechamento.tipo === 'tfl' ? 'caixa_sessoes' : 'caixa_bolao_sessoes';
        const statusField = selectedFechamento.tipo === 'tfl' ? 'status' : 'status_validacao';

        const { error } = await supabase
            .from(tabela)
            .update({
                [statusField]: 'batido',
                observacoes: observacoes,
                data_validacao: new Date().toISOString()
            })
            .eq('id', selectedFechamento.id);

        if (error) {
            toast({ message: 'Erro ao aprovar: ' + error.message, type: 'error' });
        } else {
            toast({ message: `Sessão ${selectedFechamento.terminal_id} validada com sucesso!`, type: 'success' });
            handleCloseModal();
            fetchHistorico();
        }
    };

    const handleRejeitar = async () => {
        if (!selectedFechamento) return;

        const tabela = selectedFechamento.tipo === 'tfl' ? 'caixa_sessoes' : 'caixa_bolao_sessoes';
        const statusField = selectedFechamento.tipo === 'tfl' ? 'status' : 'status_validacao';

        const { error } = await supabase
            .from(tabela)
            .update({
                [statusField]: 'divergente',
                observacoes: observacoes || 'Divergência confirmada via extrato',
                data_validacao: new Date().toISOString()
            })
            .eq('id', selectedFechamento.id);

        if (error) {
            toast({ message: 'Erro ao rejeitar: ' + error.message, type: 'error' });
        } else {
            toast({ message: 'Fechamento reprovado. Operador será notificado.', type: 'warning' });
            handleCloseModal();
            fetchHistorico();
        }
    };

    const handleCloseModal = () => {
        setShowValidationModal(false);
        setStep(1);
        setFile(null);
        setExtratoParsed([]);
        setDivergencias([]);
        setObservacoes('');
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            fechado: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            discrepante: 'bg-red-500/10 text-red-400 border-red-500/20',
            divergente: 'bg-red-500/10 text-red-400 border-red-500/20',
            aprovado: 'bg-green-500/10 text-green-400 border-green-500/20',
            batido: 'bg-green-500/10 text-green-400 border-green-500/20',
            rejeitado: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        };

        const labels: Record<string, string> = {
            fechado: 'AGUARDANDO AUDITORIA',
            batido: 'APROVADO',
            divergente: 'REPROVADO',
            pendente: 'PENDENTE'
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

            <div style={{ display: 'grid', gridTemplateColumns: selectedFechamento ? '1fr 400px' : '1fr', gap: '1.5rem', transition: 'all 0.3s ease' }}>
                {/* Tabela de Fechamentos */}
                <div className="card p-0 overflow-hidden">
                    {fechamentos.length === 0 ? (
                        <div className="p-12 text-center border-dashed">
                            <CheckCircle2 className="mx-auto mb-4 text-success opacity-20" size={48} />
                            <p className="font-bold text-muted">Nenhum encerramento encontrado</p>
                        </div>
                    ) : (
                        <div className="table-container pt-0">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Data / Hora</th>
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
                                            className={`cursor-pointer hover:bg-bg-card-hover transition-colors ${selectedFechamento?.id === f.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                                                }`}
                                        >
                                            <td className="text-xs">
                                                <div className="font-medium text-text-primary">
                                                    {format(new Date(f.data_fechamento), 'dd/MM/yyyy', { locale: ptBR })}
                                                </div>
                                                <div className="text-[10px] text-muted">
                                                    {format(new Date(f.data_fechamento), 'HH:mm', { locale: ptBR })}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-black ${f.tipo === 'tfl' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                                                    }`}>
                                                    {f.terminal_id}
                                                </span>
                                            </td>
                                            <td className="text-xs opacity-60">{f.operador_nome}</td>
                                            <td>{getStatusBadge(f.status_validacao)}</td>
                                            <td className={`font-bold text-right ${Math.abs(f.divergencia) < 0.01 ? 'text-success' : 'text-danger'
                                                }`}>
                                                R$ {f.divergencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    <div className="card flex flex-col h-full animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Detalhes do Turno</h3>
                            <button onClick={() => setSelectedFechamento(null)} className="btn btn-ghost btn-sm px-2">
                                fechar
                            </button>
                        </div>

                        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-surface-subtle border border-border">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedFechamento.status_validacao === 'batido'
                                ? 'bg-success/10 text-success'
                                : selectedFechamento.status_validacao === 'fechado'
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-danger/10 text-danger'
                                }`}>
                                {selectedFechamento.status_validacao === 'batido'
                                    ? <CheckCircle2 size={24} />
                                    : selectedFechamento.status_validacao === 'fechado'
                                        ? <ShieldCheck size={24} />
                                        : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <div className="text-lg font-bold">{selectedFechamento.terminal_id}</div>
                                <div className="text-xs text-muted font-mono">{selectedFechamento.operador_id}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="p-3 rounded-lg bg-bg-card border border-border">
                                <div className="text-[10px] text-muted uppercase font-bold mb-1">Saldo Sistema</div>
                                <div className="text-lg font-bold text-text-primary">
                                    R$ {selectedFechamento.saldo_sistema.toLocaleString('pt-BR')}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-bg-card border border-border">
                                <div className="text-[10px] text-muted uppercase font-bold mb-1">Saldo Informado</div>
                                <div className="text-lg font-bold text-text-primary">
                                    R$ {selectedFechamento.saldo_informado.toLocaleString('pt-BR')}
                                </div>
                            </div>
                        </div>

                        {selectedFechamento.tipo === 'bolao' && (
                            <div className="border-t border-border pt-3 mb-4">
                                <div className="text-[10px] text-muted font-bold uppercase mb-2">Composição</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">PIX</span>
                                        <span className="font-bold">R$ {selectedFechamento.total_pix.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Dinheiro</span>
                                        <span className="font-bold">R$ {selectedFechamento.total_dinheiro.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedFechamento.justificativa && (
                            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <span className="text-[10px] text-yellow-500 font-bold uppercase">Justificativa do Operador</span>
                                <p className="text-sm text-yellow-600 dark:text-yellow-200 mt-1 italic">"{selectedFechamento.justificativa}"</p>
                            </div>
                        )}

                        {Math.abs(selectedFechamento.divergencia) > 0.01 && (
                            <div className="bg-danger/10 border border-danger/20 p-3 rounded-lg flex items-start gap-2 mb-4">
                                <AlertTriangle className="text-danger shrink-0" size={16} />
                                <div>
                                    <div className="text-xs font-bold text-danger">Divergência Detectada</div>
                                    <div className="text-[10px] text-muted mt-1">
                                        Diferença de R$ {Math.abs(selectedFechamento.divergencia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mostrar botão de auditoria para fechamentos pendentes ou com divergência */}
                        {['fechado', 'divergente', 'pendente', 'discrepante'].includes(selectedFechamento.status_validacao) && (
                            <div className="mt-auto">
                                <button
                                    className="btn btn-primary w-full py-4 text-lg font-bold"
                                    onClick={() => setShowValidationModal(true)}
                                >
                                    <ShieldCheck className="mr-2" />
                                    {selectedFechamento.status_validacao === 'divergente' || selectedFechamento.status_validacao === 'discrepante'
                                        ? 'Revalidar Fechamento'
                                        : 'Auditar Agora'}
                                </button>
                                <p className="text-xs text-center text-muted mt-2">Confrontar com Extrato Bancário</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Validação */}
            {showValidationModal && selectedFechamento && (
                <>
                    <div onClick={handleCloseModal} className="fixed inset-0 bg-black/80 z-9998" />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-4xl max-h-[85vh] bg-bg-card border border-border rounded-2xl z-9999 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-border">
                            <div className="flex items-center gap-3">
                                <ShieldCheck size={20} className="text-primary" />
                                <h2 className="text-lg font-bold">Validação de Turno - {selectedFechamento.terminal_id}</h2>
                            </div>
                            <button onClick={handleCloseModal} className="btn btn-ghost btn-sm">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 bg-bg-dark">
                            {step === 1 ? (
                                <div className="grid grid-cols-2 gap-6 animate-in fade-in">
                                    {/* Info do Fechamento */}
                                    <div className="bg-surface-subtle p-6 rounded-2xl border border-border">
                                        <div className="text-xs font-bold uppercase text-muted mb-4 flex items-center gap-2">
                                            <User size={14} className="text-primary" /> Dados do Fechamento
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-muted text-sm">Operador</span>
                                                <span className="font-semibold">{selectedFechamento.operador_nome}</span>
                                            </div>
                                            <div className="flex justify-between pt-3 border-t border-border">
                                                <span className="text-muted text-sm">Saldo Declarado</span>
                                                <span className="font-bold text-lg">R$ {selectedFechamento.saldo_informado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className={`flex justify-between pt-3 border-t border-border ${selectedFechamento.divergencia < 0 ? 'text-danger' : 'text-success'
                                                }`}>
                                                <span className="font-bold text-sm">Diferença</span>
                                                <span className="font-black text-xl">
                                                    {selectedFechamento.divergencia > 0 ? '+' : ''} R$ {selectedFechamento.divergencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {selectedFechamento.justificativa && (
                                            <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                                                <div className="text-[10px] font-bold uppercase text-yellow-500 mb-2 flex items-center gap-1">
                                                    <AlertTriangle size={12} /> Justificativa do Operador
                                                </div>
                                                <div className="text-sm italic text-muted">"{selectedFechamento.justificativa}"</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload de Extrato */}
                                    <div className="flex flex-col gap-4">
                                        <div
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={handleDrop}
                                            onClick={() => !file && document.getElementById('extract-upload')?.click()}
                                            className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer transition-all ${file ? 'bg-primary/5 border-primary' : 'bg-bg-card-hover border-border hover:border-primary/50'
                                                }`}
                                        >
                                            <input
                                                id="extract-upload"
                                                type="file"
                                                accept=".csv,.ofx,.pdf"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />

                                            {!file ? (
                                                <>
                                                    <div className="w-14 h-14 rounded-2xl bg-bg-card flex items-center justify-center mb-4">
                                                        <UploadCloud size={28} className="text-muted" />
                                                    </div>
                                                    <div className="text-base font-bold text-center">Importar Extrato Bancário</div>
                                                    <div className="text-xs text-muted mt-2 uppercase font-semibold">.CSV, .OFX ou .PDF</div>
                                                </>
                                            ) : (
                                                <div className="text-center">
                                                    <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center mb-4 mx-auto">
                                                        <CheckCircle2 size={32} className="text-success" />
                                                    </div>
                                                    <div className="text-sm font-bold mb-2 max-w-[200px] truncate">{file.name}</div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                                        className="text-xs text-danger hover:underline"
                                                    >
                                                        Alterar Arquivo
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Avisos Importantes */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                                                <ShieldCheck size={14} className="text-primary shrink-0" />
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                                                    Conciliação automática de PIX ativada
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                                                <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                                                <div className="text-[10px] text-muted">
                                                    <span className="font-bold text-orange-500 block mb-1">FORMATO OBRIGATÓRIO: CSV</span>
                                                    Arquivos PDF não são suportados. Exporte seu extrato bancário em formato CSV com separador ponto-e-vírgula (;)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-in slide-in-from-right">
                                    {/* Resultado da Auditoria */}
                                    <div className={`flex items-center gap-5 p-6 rounded-2xl border mb-8 ${divergencias.length === 0
                                        ? 'bg-success/8 border-success/20'
                                        : 'bg-danger/8 border-danger/20'
                                        }`}>
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${divergencias.length === 0 ? 'bg-success text-white' : 'bg-danger text-white'
                                            }`}>
                                            {divergencias.length === 0 ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
                                        </div>
                                        <div>
                                            <div className="text-xl font-black mb-1">
                                                {divergencias.length === 0 ? 'Auditoria Concluída com Sucesso' : 'Discrepância Detectada'}
                                            </div>
                                            <div className="text-sm text-muted">
                                                {divergencias.length === 0
                                                    ? 'O fechamento está em plena conformidade com o extrato.'
                                                    : `${divergencias.length} divergência(s) encontrada(s) que requer(em) tomada de decisão.`}
                                            </div>
                                        </div>
                                    </div>

                                    {divergencias.length > 0 && (
                                        <div className="mb-8">
                                            <div className="text-xs font-bold uppercase text-danger mb-4 flex items-center gap-2">
                                                <AlertTriangle size={14} /> Inconsistências Detectadas
                                            </div>
                                            <div className="space-y-3">
                                                {divergencias.map((div, i) => (
                                                    <div key={i} className="flex justify-between items-center p-4 bg-danger/5 border border-danger/10 rounded-xl">
                                                        <div>
                                                            <div className={`text-[10px] font-black mb-1 ${div.tipo === 'SISTEMA' ? 'text-primary' : 'text-orange-500'
                                                                }`}>
                                                                {div.tipo}
                                                            </div>
                                                            <div className="text-sm font-semibold">{div.desc}</div>
                                                        </div>
                                                        <span className="text-base font-black text-danger">
                                                            R$ {div.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tabela do Extrato */}
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted mb-4 flex items-center gap-2">
                                            <FileSearch size={14} /> Itens do Extrato Processados
                                        </div>
                                        <div className="table-container bg-bg-dark rounded-xl border border-border">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Classificação</th>
                                                        <th>Descrição</th>
                                                        <th className="text-right">Valor</th>
                                                        <th className="text-center">Batimento</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {extratoParsed.map((item, i) => (
                                                        <tr key={i}>
                                                            <td className="text-[10px] font-bold">{item.classificacao}</td>
                                                            <td className="text-xs">{item.descricao}</td>
                                                            <td className="text-right font-bold text-xs">
                                                                R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="text-center">
                                                                {item.conciliado ? (
                                                                    <CheckCircle2 size={16} className="text-success mx-auto" />
                                                                ) : (
                                                                    <XCircle size={16} className="text-danger mx-auto" />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Campo de Observações */}
                                    <div className="mt-8">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
                                            Observações do Gerente
                                        </label>
                                        <textarea
                                            value={observacoes}
                                            onChange={(e) => setObservacoes(e.target.value)}
                                            className="input w-full h-24 resize-none"
                                            placeholder="Adicione suas observações sobre esta validação..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-4 p-5 border-t border-border bg-bg-card">
                            {step === 1 ? (
                                <>
                                    <button onClick={handleCloseModal} className="btn btn-ghost">
                                        Cancelar
                                    </button>
                                    <button
                                        disabled={!file || isAnalyzing}
                                        onClick={analyzeExtract}
                                        className="btn btn-primary flex items-center gap-2"
                                    >
                                        {isAnalyzing ? 'Processando Auditoria...' : 'Iniciar Conciliação'}
                                        {!isAnalyzing && <ArrowRight size={16} />}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={handleCloseModal} className="btn btn-ghost">
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleRejeitar}
                                        className="btn bg-danger/10 text-danger hover:bg-danger/20 border-danger/20"
                                    >
                                        <XCircle size={16} /> Reprovar & Gerar Débito
                                    </button>
                                    <button onClick={handleAprovar} className="btn btn-success">
                                        <CheckCircle2 size={16} /> Aprovar Auditoria
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
