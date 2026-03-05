'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import {
    Calculator,
    Smartphone,
    ArrowRightLeft,
    Wallet,
    Building,
    FileText,
    History,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Clock,
    CheckCircle2,
    Unlock,
    Loader2,
    AlertTriangle,
    ArrowUpCircle,
    ArrowDownCircle,
    Pencil,
    Trash2
} from 'lucide-react';
import { ModalLancamentoRapido, type TipoLancamento } from '@/components/financeiro/ModalLancamentoRapido';
import { ModalFechamentoCaixa } from '@/components/financeiro/ModalFechamentoCaixa';
import { ModalMovimentacaoGeral } from './ModalMovimentacaoGeral';
import { GerenciamentoCaixaBolao } from './GerenciamentoCaixaBolao';
import { CaixaVirtualOperador } from './CaixaVirtualOperador';
import { usePerfil } from '@/hooks/usePerfil';
import { Ticket } from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { useCaixa } from '@/hooks/useCaixa';
import { useTerminais } from '@/hooks/useTerminais';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

// Componente memoizado para cada item da lista
const MovimentacaoItem = memo(({ mov, onEdit, onDelete, getIcon, getLabel }: any) => {
    return (
        <div className="card p-3.5 bg-bg-dark border-border relative group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {getIcon(mov.tipo)}
                    <div className="flex flex-col">
                        <span className="text-[0.8rem] font-bold text-text-primary">
                            {mov.categorias_operacionais?.nome || getLabel(mov.tipo)}
                        </span>
                        <span className="text-[0.65rem] text-muted flex items-center gap-1">
                            {mov.metodo_pagamento === 'pix' ? <Smartphone size={10} /> : <Wallet size={10} />}
                            {mov.metodo_pagamento === 'pix' ? 'Pix / Digital' : 'Dinheiro Físico'}
                        </span>
                    </div>
                </div>
                <span className={`text-[0.9rem] font-extrabold ${mov.valor < 0 ? 'text-danger' : 'text-success'}`}>
                    {mov.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>

            {mov.descricao && (
                <p className="text-[0.65rem] text-muted mt-2 italic border-t border-border/30 pt-2">
                    "{mov.descricao}"
                </p>
            )}

            {/* Botões de ação */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onEdit(mov)}
                    className="p-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
                    title="Editar"
                >
                    <Pencil size={14} />
                </button>
                <button
                    onClick={() => onDelete(mov)}
                    className="p-1 rounded bg-danger/10 hover:bg-danger/20 text-danger"
                    title="Excluir"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
});

MovimentacaoItem.displayName = 'MovimentacaoItem';

export function VisaoOperadorCaixa() {
    const supabase = createBrowserSupabaseClient();
    const { perfil, podeGerenciarCaixaBolao } = usePerfil();
    const { toast } = useToast();
    const confirm = useConfirm();

    const {
        sessaoAtiva,
        movimentacoes,
        loading: loadingCaixa,
        abrirCaixa,
        registrarMovimentacao,
        fecharCaixa,
        refresh
    } = useCaixa();

    const { terminais, loading: loadingTerminais } = useTerminais();

    const [tipoSelecionado, setTipoSelecionado] = useState<TipoLancamento | null>(null);
    const [editandoMovimentacao, setEditandoMovimentacao] = useState<any | null>(null);
    const [showFechamento, setShowFechamento] = useState(false);
    const [showMovimentacaoGeral, setShowMovimentacaoGeral] = useState(false);
    const [valorInicial, setValorInicial] = useState<number>(100.00);
    const [terminalSelecionado, setTerminalSelecionado] = useState<string>('');
    const [terminalId, setTerminalId] = useState<number | undefined>();
    const [temFundoCaixa, setTemFundoCaixa] = useState<boolean>(true);
    const [isOpening, setIsOpening] = useState(false);
    const [abaCaixa, setAbaCaixa] = useState<'tfl' | 'bolao'>('tfl');
    const [limiteExibicao, setLimiteExibicao] = useState(50); // limite inicial

    const canSeeBolao = true;

    // Função para salvar (criar ou editar)
    const handleSaveEntry = useCallback(async (data: any) => {
        try {
            if (editandoMovimentacao) {
                // Atualizar movimentação existente
                const { error } = await supabase
                    .from('caixa_movimentacoes')
                    .update({
                        tipo: data.tipo,
                        valor: data.valor,
                        descricao: data.descricao || data.observacao,
                        metodo_pagamento: data.metodo || data.metodo_pagamento || 'dinheiro',
                        categoria_operacional_id: data.categoria_operacional_id || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editandoMovimentacao.id);
                if (error) throw error;
                toast({ message: 'Lançamento atualizado!', type: 'success' });
            } else {
                // Criar novo
                await registrarMovimentacao({
                    tipo: data.tipo,
                    valor: data.valor,
                    descricao: data.descricao || data.observacao || null,
                    metodo_pagamento: data.metodo || data.metodo_pagamento || 'dinheiro',
                    referencia_id: null,
                    classificacao_pix: data.classificacao_pix || null,
                    categoria_operacional_id: data.categoria_operacional_id || null
                });
            }
            setTipoSelecionado(null);
            setEditandoMovimentacao(null);
            refresh(); // recarrega a lista
        } catch (error: any) {
            console.error('Erro ao salvar movimentação:', error);
            toast({ message: 'Erro: ' + error.message, type: 'error' });
        }
    }, [registrarMovimentacao, editandoMovimentacao, supabase, toast, refresh]);

    // Função para deletar
    const handleDelete = useCallback(async (movimentacao: any) => {
        const confirmed = await confirm({
            title: 'Excluir Lançamento',
            description: `Tem certeza que deseja excluir este lançamento de R$ ${movimentacao.valor.toLocaleString('pt-BR')}?`,
            confirmLabel: 'Excluir',
            variant: 'danger'
        });
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('caixa_movimentacoes')
                .update({ deleted_at: new Date().toISOString() }) // soft delete
                .eq('id', movimentacao.id);
            if (error) throw error;
            toast({ message: 'Lançamento excluído!', type: 'success' });
            refresh();
        } catch (error: any) {
            toast({ message: 'Erro: ' + error.message, type: 'error' });
        }
    }, [supabase, toast, confirm, refresh]);

    const handleFinishCaixa = async (result: { observacoes?: string; tflData?: any }) => {
    try {
        await fecharCaixa(result.observacoes, result.tflData);
        setShowFechamento(false);
        toast({ message: 'Caixa fechado com sucesso!', type: 'success' });
    } catch (error) {
        console.error('Erro ao fechar caixa:', error);
        toast({ message: 'Erro ao fechar caixa.', type: 'error' });
    }
};

    const handleAbrirCaixa = async () => {
        if (!terminalSelecionado) {
            toast({ message: 'Selecione um terminal.', type: 'warning' });
            return;
        }
        setIsOpening(true);
        try {
            await abrirCaixa(valorInicial, terminalSelecionado, terminalId, temFundoCaixa);
            toast({ message: 'Caixa aberto!', type: 'success' });
        } catch (error: any) {
            toast({ message: 'Erro ao abrir caixa: ' + error.message, type: 'error' });
        } finally {
            setIsOpening(false);
        }
    };

    const getIcon = useCallback((tipo: TipoLancamento) => {
        switch (tipo) {
            case 'pix': return <Smartphone size={16} className="text-success" />;
            case 'sangria': return <Building size={16} className="text-danger" />;
            case 'trocados': return <ArrowRightLeft size={16} className="text-blue-500" />;
            case 'deposito': return <Building size={16} className="text-muted" />;
            case 'boleto': return <FileText size={16} className="text-orange-500" />;
            default: return <DollarSign size={16} />;
        }
    }, []);

    const getLabel = useCallback((tipo: string) => {
        switch (tipo) {
            case 'pix': return 'Pix';
            case 'sangria': return 'Sangria';
            case 'trocados': return 'Trocados';
            case 'deposito': return 'Depósito';
            case 'boleto': return 'Boleto';
            default: return 'Lançamento';
        }
    }, []);

    const valorInicialSessao = sessaoAtiva?.valor_inicial || 0;

    const totalCreditos = useMemo(() => {
        return movimentacoes
            .filter(mov => mov.valor > 0)
            .reduce((acc, mov) => acc + mov.valor, 0);
    }, [movimentacoes]);

    const totalDebitos = useMemo(() => {
        return movimentacoes
            .filter(mov => mov.valor < 0)
            .reduce((acc, mov) => acc + Math.abs(mov.valor), 0);
    }, [movimentacoes]);

    const saldoFinal = useMemo(() => totalCreditos - totalDebitos, [totalCreditos, totalDebitos]);

    // Apenas as primeiras N movimentações para exibição
    const movimentacoesLimitadas = useMemo(() => {
        return movimentacoes.slice(0, limiteExibicao);
    }, [movimentacoes, limiteExibicao]);

    const podeCarregarMais = movimentacoes.length > limiteExibicao;

    if (loadingCaixa || loadingTerminais) {
        return (
            <div className="flex items-center justify-center p-24">
                <Loader2 className="animate-spin text-primary" size={48} />
                <span className="ml-4 font-bold text-muted">Acessando sistema financeiro...</span>
            </div>
        );
    }

    if (!sessaoAtiva) {
        // Tela de abertura de caixa (igual ao original)
        return (
            <div className="dashboard-content max-w-2xl mx-auto py-12">
                <div className="card p-8 border-t-4 border-primary-blue-light">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-primary-blue/10 flex items-center justify-center mb-6">
                            <Unlock size={40} className="text-primary-blue-light" />
                        </div>
                        <h2 className="text-2xl font-black mb-2 uppercase">Abertura de Turno</h2>
                        <p className="text-muted mb-8">Nenhum caixa aberto. Informe o saldo inicial para começar as operações.</p>
                        <div className="w-full space-y-4 text-left">
                            <div className="form-group">
                                <label className="text-[10px] font-black uppercase text-muted mb-1 block">Terminal de Operação</label>
                                <select
                                    className="input w-full font-extrabold"
                                    value={terminalId?.toString() || ''}
                                    onChange={(e) => {
                                        const t = terminais.find(term => term.id === parseInt(e.target.value));
                                        if (t) {
                                            setTerminalSelecionado(t.codigo);
                                            setTerminalId(t.id);
                                        } else {
                                            setTerminalSelecionado('');
                                            setTerminalId(undefined);
                                        }
                                    }}
                                >
                                    <option value="">Selecione o Terminal...</option>
                                    {terminais.filter(t => t.status === 'ativo').map(t => (
                                        <option key={t.id} value={t.id}>{t.codigo} - {t.descricao}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="text-[10px] font-black uppercase text-muted mb-1 block">Fundo de Troco (Saldo Inicial)</label>
                                <MoneyInput
                                    value={valorInicial}
                                    onValueChange={setValorInicial}
                                    className="w-full text-2xl font-black"
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="card bg-primary-blue/5 border-primary-blue/20 p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={temFundoCaixa}
                                        onChange={(e) => setTemFundoCaixa(e.target.checked)}
                                        className="mt-1 w-5 h-5 rounded border-2 border-primary-blue-light"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-primary-blue-light">
                                            Confirmo que há R$ 100,00 de Fundo de Caixa
                                        </p>
                                        <p className="text-xs text-muted mt-1">
                                            O fundo de caixa é fixo e <strong>não entra nos cálculos de fechamento</strong>.
                                        </p>
                                    </div>
                                </label>
                                {!temFundoCaixa && (
                                    <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                                        <p className="text-xs text-warning font-bold flex items-center gap-2">
                                            <AlertTriangle size={14} />
                                            Você precisará justificar a falta do fundo no fechamento
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            className="btn btn-primary w-full mt-8 py-4 text-xl font-black"
                            onClick={handleAbrirCaixa}
                            disabled={isOpening || !terminalSelecionado}
                        >
                            {isOpening ? <Loader2 className="animate-spin mr-2" /> : <Unlock className="mr-3" />}
                            INICIAR OPERAÇÕES
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="visao-operador-container mt-4">
            {/* Cabeçalho financeiro */}
            <div className="card mb-6 bg-surface-subtle border-border p-5">
                <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-[10px] text-muted uppercase font-bold">Valor Inicial</div>
                        <div className="text-lg font-extrabold">
                            R$ {valorInicialSessao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="text-center border-l border-border/30">
                        <div className="text-[10px] text-muted uppercase font-bold flex items-center justify-center gap-1">
                            <ArrowUpCircle size={12} className="text-success" /> Entradas
                        </div>
                        <div className="text-lg font-extrabold text-success">
                            R$ {totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="text-center border-l border-border/30">
                        <div className="text-[10px] text-muted uppercase font-bold flex items-center justify-center gap-1">
                            <ArrowDownCircle size={12} className="text-danger" /> Saídas
                        </div>
                        <div className="text-lg font-extrabold text-danger">
                            R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="text-center border-l border-border/30">
                        <div className="text-[10px] text-muted uppercase font-bold">Saldo Final</div>
                        <div className={`text-lg font-extrabold ${saldoFinal >= 0 ? 'text-success' : 'text-danger'}`}>
                            R$ {saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span className="text-xs text-muted">Caixa: {sessaoAtiva.terminal_id}</span>
                        <span className="badge success text-[0.6rem] ml-2">ABERTO</span>
                    </div>
                    <p className="text-xs text-muted">
                        Aberto em {new Date(sessaoAtiva.data_abertura).toLocaleString('pt-BR')}
                    </p>
                </div>
            </div>

            {/* Seletor de caixa (TFL vs Bolão) */}
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setAbaCaixa('tfl')}
                        className={`btn ${abaCaixa === 'tfl' ? 'btn-primary' : 'btn-ghost'} h-10 px-6 text-xs font-bold rounded-xl`}
                    >
                        <Calculator size={16} /> Caixa Terminal (TFL)
                    </button>
                    {canSeeBolao && (
                        <button
                            onClick={() => setAbaCaixa('bolao')}
                            className={`btn ${abaCaixa === 'bolao' ? 'bg-[#4f46e5] text-white' : 'btn-ghost'} h-10 px-6 text-xs font-bold rounded-xl`}
                        >
                            <Ticket size={16} /> Caixa Bolão
                        </button>
                    )}
                </div>
            </div>

            {abaCaixa === 'bolao' ? (
                podeGerenciarCaixaBolao ? <GerenciamentoCaixaBolao /> : <CaixaVirtualOperador />
            ) : (
                <div className="grid grid-cols-[1fr_320px] gap-6 animate-in fade-in slide-in-from-left-4">
                    {/* Painel de lançamentos */}
                    <div className="calculadora-area">
                        <div className="card">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Calculator size={22} className="text-primary-blue-light" />
                                Painel de Lançamentos
                            </h3>

                            <div className="grid gap-4">
                                {/* Botão principal - Movimentações Gerais */}
                                <button
                                    onClick={() => setShowMovimentacaoGeral(true)}
                                    className="btn btn-primary h-24 flex items-center justify-between px-6 hover:scale-[1.02] transition-transform"
                                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 p-3 rounded-2xl">
                                            <DollarSign size={28} className="text-white" />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-lg font-black text-white">Movimentações Gerais</div>
                                            <div className="text-xs text-white/80 mt-1">Entradas e saídas personalizadas</div>
                                        </div>
                                    </div>
                                    <div className="text-white/60">
                                        <TrendingUp size={24} />
                                    </div>
                                </button>

                                {/* Botões rápidos */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => { setEditandoMovimentacao(null); setTipoSelecionado('pix'); }}
                                        className="btn btn-ghost h-20 flex items-center gap-3 border-border bg-surface-subtle hover:scale-105 transition-transform"
                                    >
                                        <div className="bg-success/10 p-2 rounded-xl">
                                            <Smartphone size={20} className="text-success" />
                                        </div>
                                        <span className="text-sm font-bold">Pix</span>
                                    </button>
                                    <button
                                        onClick={() => { setEditandoMovimentacao(null); setTipoSelecionado('sangria'); }}
                                        className="btn btn-ghost h-20 flex items-center gap-3 border-border bg-surface-subtle hover:scale-105 transition-transform"
                                    >
                                        <div className="bg-danger/10 p-2 rounded-xl">
                                            <Building size={20} className="text-danger" />
                                        </div>
                                        <span className="text-sm font-bold">Sangria</span>
                                    </button>
                                    <button
                                        onClick={() => { setEditandoMovimentacao(null); setTipoSelecionado('trocados'); }}
                                        className="btn btn-ghost h-20 flex items-center gap-3 border-border bg-surface-subtle hover:scale-105 transition-transform"
                                    >
                                        <div className="bg-primary-blue-light/10 p-2 rounded-xl">
                                            <ArrowRightLeft size={20} className="text-primary-blue-light" />
                                        </div>
                                        <span className="text-sm font-bold">Trocados</span>
                                    </button>
                                    <button
                                        onClick={() => { setEditandoMovimentacao(null); setTipoSelecionado('deposito'); }}
                                        className="btn btn-ghost h-20 flex items-center gap-3 border-border bg-surface-subtle hover:scale-105 transition-transform"
                                    >
                                        <div className="bg-muted/10 p-2 rounded-xl">
                                            <Building size={20} className="text-muted" />
                                        </div>
                                        <span className="text-sm font-bold">Depósito</span>
                                    </button>
                                    <button
                                        onClick={() => { setEditandoMovimentacao(null); setTipoSelecionado('boleto'); }}
                                        className="btn btn-ghost h-20 flex items-center gap-3 border-border bg-surface-subtle hover:scale-105 transition-transform"
                                    >
                                        <div className="bg-orange-500/10 p-2 rounded-xl">
                                            <FileText size={20} className="text-orange-500" />
                                        </div>
                                        <span className="text-sm font-bold">Boleto</span>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-10 p-8 bg-surface-subtle rounded-3xl border border-dashed border-border text-center">
                                <Calculator size={48} className="mx-auto opacity-30 mb-4" />
                                <h4 className="font-bold text-lg">Registro em tempo real</h4>
                                <p className="text-muted text-sm max-w-xs mx-auto mt-2">Cada lançamento é computado instantaneamente.</p>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar com movimentações */}
                    <div className="sidebar-area">
                        <div className="card h-full flex flex-col p-5">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <History size={16} className="text-muted" />
                                    Movimentações
                                </h3>
                                <span className="badge text-[0.6rem]">TURNO ATIVO</span>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {movimentacoesLimitadas.length === 0 ? (
                                    <div className="text-center py-16 px-4">
                                        <Clock size={40} className="mx-auto mb-6 text-muted opacity-10" />
                                        <p className="text-xs text-muted">Aguardando seu primeiro lançamento...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {movimentacoesLimitadas.map((mov) => (
                                            <MovimentacaoItem
                                                key={mov.id}
                                                mov={mov}
                                                onEdit={() => {
                                                    setEditandoMovimentacao(mov);
                                                    setTipoSelecionado(mov.tipo as TipoLancamento);
                                                }}
                                                onDelete={handleDelete}
                                                getIcon={getIcon}
                                                getLabel={getLabel}
                                            />
                                        ))}
                                        {podeCarregarMais && (
                                            <button
                                                onClick={() => setLimiteExibicao(prev => prev + 50)}
                                                className="btn btn-ghost text-xs py-2 mt-2"
                                            >
                                                Carregar mais ({movimentacoes.length - limiteExibicao} restantes)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-6 border-t-2 border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold text-muted uppercase">Saldo em Caixa</span>
                                    <span className={`font-extrabold text-xl ${saldoFinal >= 0 ? 'text-success' : 'text-danger'}`}>
                                        R$ {saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <button
                                    className="btn btn-primary w-full p-5 h-auto flex flex-col gap-1 rounded-2xl"
                                    onClick={() => setShowFechamento(true)}
                                >
                                    <span className="text-base font-extrabold text-white">Encerrar Turno</span>
                                    <span className="text-[0.65rem] opacity-80 font-medium text-white">Bater caixa e conferir valores</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modais */}
            {showMovimentacaoGeral && (
                <ModalMovimentacaoGeral
                    onClose={() => setShowMovimentacaoGeral(false)}
                    onSave={handleSaveEntry}
                />
            )}

            {tipoSelecionado && (
                <ModalLancamentoRapido
                    key={editandoMovimentacao ? editandoMovimentacao.id : 'new'}
                    tipo={tipoSelecionado}
                    initialData={editandoMovimentacao}
                    onClose={() => {
                        setTipoSelecionado(null);
                        setEditandoMovimentacao(null);
                    }}
                    onSave={handleSaveEntry}
                />
            )}

               <ModalFechamentoCaixa
        sessao={sessaoAtiva}
        transacoes={movimentacoes}
        onClose={() => setShowFechamento(false)}
        onFinish={handleFinishCaixa}
    />
)}
        </div>
    );
}
