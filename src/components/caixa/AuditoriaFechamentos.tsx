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
    User,
    X
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoneyInput } from '@/components/ui/MoneyInput';

interface Fechamento {
    id: string;
    data_turno: string;               // nova
    data_fechamento: string;
    terminal_id: string;
    operador_id: string;
    operador_nome?: string;
    valor_inicial: number;             // novo
    total_lancamentos: number;          // valor_final_calculado - valor_inicial
    saldo_no_caixa: number;             // valor_final_declarado
    divergencia: number;                 // diferença (saldo_no_caixa - (total_lancamentos + valor_inicial)?)
    total_pix: number;
    total_dinheiro: number;
    total_sangrias: number;
    total_depositos: number;
    status_validacao: string;
    tipo: 'tfl' | 'bolao';
    justificativa?: string;
    valor_cofre?: number;
    valor_pix_externo?: number;
    diferenca_apurada?: number;
    justificativa_divergencia?: string;
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

    // Calcular totais com base nos campos do fechamento
    const saldoInicial = fechamento.saldo_sistema ?? 0;
    const totalEntradas = fechamento.total_pix + fechamento.total_dinheiro;
    const totalSaidas = (fechamento.total_sangrias ?? 0) + (fechamento.total_depositos ?? 0);
    const saldoCalculado = saldoInicial + totalEntradas - totalSaidas;

    return (
        <>
            <div className="fixed inset-0 bg-black/80 z-9998" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl bg-bg-card border border-border rounded-2xl z-9999 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Auditoria de Fechamento</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-3 mb-6">
                    <p><span className="font-semibold">Terminal:</span> {fechamento.terminal_id}</p>
                    <p><span className="font-semibold">Operador:</span> {fechamento.operador_nome}</p>
                    <p><span className="font-semibold">Data:</span> {format(new Date(fechamento.data_fechamento), 'dd/MM/yyyy HH:mm')}</p>
                    <hr className="border-border" />
                    <p><span className="font-semibold">Valor inicial:</span> R$ {saldoInicial.toFixed(2)}</p>
                    <p><span className="font-semibold">Total entradas:</span> R$ {totalEntradas.toFixed(2)}</p>
                    <p><span className="font-semibold">Total saídas:</span> R$ {totalSaidas.toFixed(2)}</p>
                    <p><span className="font-semibold">Saldo calculado:</span> R$ {saldoCalculado.toFixed(2)}</p>
                    <hr className="border-border" />
                    <p><span className="font-semibold">Valor informado para cofre:</span> R$ {fechamento.valor_cofre?.toFixed(2) ?? '0,00'}</p>
                    <p><span className="font-semibold">Valor informado de PIX externo:</span> R$ {fechamento.valor_pix_externo?.toFixed(2) ?? '0,00'}</p>
                </div>

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
            // ---------- QUERY TFL (caixa_sessoes) sem aliases ----------
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
                // Mapeia o filtro para o status do TFL
                let statusFilter: string;
                if (filtroStatus === 'fechado') statusFilter = 'fechado';
                else if (filtroStatus === 'batido') statusFilter = 'conferido'; // ou 'batido'? No TFL, status pode ser 'conferido' ou 'batido'? Ajuste conforme seu enum.
                else if (filtroStatus === 'divergente') statusFilter = 'discrepante';
                else statusFilter = filtroStatus;
                queryTFL = queryTFL.eq('status', statusFilter);
            }

            const { data: dataTFL, error: errorTFL } = await queryTFL;
            if (errorTFL) throw errorTFL;

            // ---------- QUERY BOLÃO (caixa_bolao_sessoes) com valores de enum válidos ----------
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

            // Aplica filtro de status apenas se não for 'todos'
            if (filtroStatus !== 'todos') {
                // Mapeia o filtro para os valores reais do enum status_validacao_gerencial
                // Valores comuns: 'pendente', 'aprovado', 'rejeitado', 'discrepante'
                let statusFilter: string[] = [];
                if (filtroStatus === 'fechado') {
                    statusFilter = ['pendente']; // Aguardando auditoria
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

            // ---------- Normalizar dados TFL ----------
           const fechamentosTFL: Fechamento[] = (dataTFL || []).map((f: any) => {
    const totalLancamentos = (f.valor_final_calculado || 0) - (f.valor_inicial || 0);
    const saldoNoCaixa = f.valor_final_declarado || 0;
    // Divergência original: saldoNoCaixa - (totalLancamentos + valor_inicial)
    const divergencia = saldoNoCaixa - (totalLancamentos + (f.valor_inicial || 0));
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
        total_pix: 0, // se não houver campo, manter 0
        total_dinheiro: saldoNoCaixa,
        total_sangrias: f.total_sangrias || 0,
        total_depositos: f.total_depositos_filial || 0,
        status_validacao: f.status,
        tipo: 'tfl',
        justificativa: f.observacoes,
        valor_cofre: f.valor_cofre,
        valor_pix_externo: f.valor_pix_externo,
        diferenca_apurada: f.diferenca_apurada,
        justificativa_divergencia: f.justificativa_divergencia
    };
});

            // ---------- Normalizar dados Bolão ----------
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
                tipo: 'bolao',
                justificativa: f.observacoes_gerente
            }));

            setFechamentos([...fechamentosTFL, ...fechamentosBolao]);
        } catch (err: any) {
            console.error('Erro ao carregar histórico:', err);
            // Exibe detalhes do erro para depuração
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
            rejeitado: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        };

        const labels: Record<string, string> = {
            fechado: 'AGUARDANDO AUDITORIA',
            batido: 'APROVADO',
            divergente: 'REPROVADO',
            pendente: 'PENDENTE',
            discrepante: 'DIVERGENTE',
            aprovado: 'APROVADO',
            rejeitado: 'REJEITADO'
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
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedFechamento.status_validacao === 'batido' || selectedFechamento.status_validacao === 'aprovado'
                                ? 'bg-success/10 text-success'
                                : selectedFechamento.status_validacao === 'fechado' || selectedFechamento.status_validacao === 'pendente'
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-danger/10 text-danger'
                                }`}>
                                {selectedFechamento.status_validacao === 'batido' || selectedFechamento.status_validacao === 'aprovado'
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

                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
    <div className="p-3 rounded-lg bg-bg-card border border-border">
        <div className="text-[10px] text-muted uppercase font-bold mb-1">Total de Lançamentos</div>
        <div className="text-lg font-bold text-text-primary">
            R$ {selectedFechamento.total_lancamentos.toLocaleString('pt-BR')}
        </div>
    </div>
    <div className="p-3 rounded-lg bg-bg-card border border-border">
        <div className="text-[10px] text-muted uppercase font-bold mb-1">Saldo no caixa</div>
        <div className="text-lg font-bold text-text-primary">
            R$ {selectedFechamento.saldo_no_caixa.toLocaleString('pt-BR')}
        </div>
    </div>
</div>

                        {/* Exibir novos campos, se existirem */}
                        {(selectedFechamento.valor_cofre || selectedFechamento.valor_pix_externo) && (
                            <div className="border-t border-border pt-3 mb-4">
                                <div className="text-[10px] text-muted font-bold uppercase mb-2">Informações do Fechamento</div>
                                <div className="space-y-2">
                                    {selectedFechamento.valor_cofre !== undefined && selectedFechamento.valor_cofre > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted">Valor no cofre</span>
                                            <span className="font-bold">R$ {selectedFechamento.valor_cofre.toLocaleString('pt-BR')}</span>
                                        </div>
                                    )}
                                   {selectedFechamento.valor_pix_externo !== undefined && (
    <div className="flex justify-between text-xs mt-2 pt-2 border-t border-border">
        <span className="text-muted">Total do caixa (lançamentos + PIX externo)</span>
        <span className="font-bold">
            R$ {(selectedFechamento.total_lancamentos + (selectedFechamento.valor_pix_externo || 0)).toLocaleString('pt-BR')}
        </span>
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

                        {/* Botão de auditoria */}
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

                        const { error } = await supabase
                            .from(tabela)
                            .update({
                                [statusField]: selectedFechamento.tipo === 'tfl' ? 'conferido' : 'aprovado',
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
                        }
                    }}
                    onRejeitar={async ({ justificativa, diferenca }) => {
                        const tabela = selectedFechamento.tipo === 'tfl' ? 'caixa_sessoes' : 'caixa_bolao_sessoes';
                        const statusField = selectedFechamento.tipo === 'tfl' ? 'status' : 'status_validacao';

                        const { error } = await supabase
                            .from(tabela)
                            .update({
                                [statusField]: selectedFechamento.tipo === 'tfl' ? 'discrepante' : 'rejeitado',
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
                        }
                    }}
                />
            )}
        </div>
    );
}
