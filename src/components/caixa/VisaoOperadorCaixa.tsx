'use client';

import { useState } from 'react';
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
    Lock,
    Loader2,
    AlertTriangle
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

export function VisaoOperadorCaixa() {
    const {
        perfil,
        isAdmin,
        isGerente,
        isOpAdmin,
        isOperador,
        podeGerenciarCaixaBolao
    } = usePerfil();

    // Todos podem ver a aba Bolao (Operadores veem Caixa Virtual, Op.Admin/Gerente gerenciam)
    const canSeeBolao = true;

    const [categoriasOperacionais, setCategoriasOperacionais] = useState<any[]>([]);

    const {
        sessaoAtiva,
        movimentacoes,
        loading: loadingCaixa,
        abrirCaixa,
        registrarMovimentacao,
        fecharCaixa
    } = useCaixa();

    const { terminais, loading: loadingTerminais } = useTerminais();

    const [tipoSelecionado, setTipoSelecionado] = useState<TipoLancamento | null>(null);
    const [showFechamento, setShowFechamento] = useState(false);
    const [showMovimentacaoGeral, setShowMovimentacaoGeral] = useState(false);
    const [valorInicial, setValorInicial] = useState<number>(100.00); // Fundo de troco padrÃ£o
    const [terminalSelecionado, setTerminalSelecionado] = useState<string>(''); // CÃ³digo do terminal
    const [terminalId, setTerminalId] = useState<number | undefined>(); // ID do terminal
    const [temFundoCaixa, setTemFundoCaixa] = useState<boolean>(true); // Confirmação de fundo R$100
    const { toast } = useToast();
    const [isOpening, setIsOpening] = useState(false);

    // Novo Estado para Abas de Caixa
    const [abaCaixa, setAbaCaixa] = useState<'tfl' | 'bolao'>('tfl');

    const handleSaveEntry = async (data: any) => {
        try {
            await registrarMovimentacao({
                tipo: data.tipo,
                valor: data.valor,
                descricao: data.descricao || data.observacao || null,
                metodo_pagamento: data.metodo || data.metodo_pagamento || 'dinheiro',
                referencia_id: null,
                classificacao_pix: null,
                categoria_operacional_id: data.categoria_operacional_id || null
            });
            setTipoSelecionado(null);
        } catch (error) {
            console.error('Erro ao registrar movimentação:', error);
            toast({ message: 'Erro ao registrar movimentação no banco de dados.', type: 'error' });
        }
    };

    const handleFinishCaixa = async (result: any) => {
        try {
            const { totalInformado, justificativa, ...tflData } = result;
            await fecharCaixa(totalInformado, justificativa, tflData);
            setShowFechamento(false);
            toast({ message: 'Caixa fechado com sucesso e enviado para validação do gestor!', type: 'success' });
        } catch (error) {
            console.error('Erro ao fechar caixa:', error);
            toast({ message: 'Erro ao fechar caixa no banco de dados.', type: 'error' });
        }
    };

    const handleAbrirCaixa = async () => {
        if (!terminalSelecionado) {
            toast({ message: 'Por favor, selecione um terminal para operar.', type: 'warning' });
            return;
        }
        setIsOpening(true);
        try {
            await abrirCaixa(valorInicial, terminalSelecionado, terminalId, temFundoCaixa);
            toast({ message: 'Caixa aberto com sucesso!', type: 'success' });
        } catch (error: any) {
            console.error('Erro ao abrir caixa - Detalhes:', {
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint,
                fullError: error
            });
            toast({
                message: `Erro ao abrir caixa: ${error?.message || 'Erro desconhecido no banco de dados'}`,
                type: 'error'
            });
        } finally {
            setIsOpening(false);
        }
    };

    const getIcon = (tipo: TipoLancamento) => {
        switch (tipo) {
            case 'pix': return <Smartphone size={16} className="text-success" />;
            case 'sangria': return <Building size={16} className="text-danger" />;
            case 'trocados': return <ArrowRightLeft size={16} className="text-blue-500" />;
            case 'deposito': return <Building size={16} className="text-muted" />;
            case 'boleto': return <FileText size={16} className="text-orange-500" />;
            default: return <DollarSign size={16} />;
        }
    };

    const getLabel = (tipo: string) => {
        switch (tipo) {
            case 'pix': return 'Pix';
            case 'sangria': return 'Sangria';
            case 'trocados': return 'Trocados';
            case 'deposito': return 'Deposito';
            case 'boleto': return 'Boleto';
            case 'venda': return 'Venda Balcao';
            default: return 'Lancamento';
        }
    };

    if (loadingCaixa || loadingTerminais) {
        return (
            <div className="flex items-center justify-center p-24">
                <Loader2 className="animate-spin text-primary" size={48} />
                <span className="ml-4 font-bold text-muted">Acessando sistema financeiro...</span>
            </div>
        );
    }

    if (!sessaoAtiva) {
        return (
            <div className="dashboard-content max-w-2xl mx-auto py-12">
                <div className="card p-8 border-t-4 border-primary-blue-light">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-primary-blue/10 flex items-center justify-center mb-6">
                            <Unlock size={40} className="text-primary-blue-light" />
                        </div>
                        <h2 className="text-2xl font-black mb-2 uppercase">Abertura de Turno</h2>
                        <p className="text-muted mb-8">Nenhum caixa aberto para este terminal. Informe o saldo inicial para comecar as operacoes.</p>

                        <div className="w-full space-y-4 text-left">
                            <div className="form-group">
                                <label className="text-[10px] font-black uppercase text-muted mb-1 block">Terminal de Operacao</label>
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
                                {terminais.length === 0 && (
                                    <p className="text-[10px] text-danger mt-1 font-bold">âš ï¸ Nenhum terminal cadastrado. VÃ¡ em Cadastros &gt; Terminais TFL.</p>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="text-[10px] font-black uppercase text-muted mb-1 block">Fundo de Troco (Saldo Inicial)</label>
                                <div className="relative">
                                    <MoneyInput
                                        value={valorInicial}
                                        onValueChange={setValorInicial}
                                        className="w-full pl-12 text-2xl font-black"
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>

                            {/* Confirmação de Fundo de Caixa */}
                            <div className="card bg-primary-blue/5 border-primary-blue/20 p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={temFundoCaixa}
                                        onChange={(e) => setTemFundoCaixa(e.target.checked)}
                                        className="mt-1 w-5 h-5 rounded border-2 border-primary-blue-light checked:bg-primary-blue-light checked:border-primary-blue-light"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-primary-blue-light">
                                            Confirmo que há R$ 100,00 de Fundo de Caixa
                                        </p>
                                        <p className="text-xs text-muted mt-1">
                                            O fundo de caixa é um valor fixo que fica no caixa e <strong>não entra nos cálculos de fechamento</strong>.
                                            Marque apenas se os R$100 estiverem fisicamente na gaveta.
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
                            INICIAR OPERACOES
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="visao-operador-container mt-4">
            <div className="card mb-6 bg-surface-subtle border-border flex items-center gap-6 p-5">
                <div className="w-11 h-11 bg-success rounded-xl flex items-center justify-center">
                    <Unlock size={20} className="text-white" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text-primary">Caixa em Operacao: {sessaoAtiva.terminal_id}</h3>
                        <span className="badge success text-[0.6rem]">ABERTO</span>
                    </div>
                    <p className="text-xs text-text-muted">Aberto em {new Date(sessaoAtiva.data_abertura).toLocaleString('pt-BR')}</p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Saldo em Tela</div>
                    <div className="text-xl font-extrabold text-success">
                        R$ {(sessaoAtiva?.valor_final_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* SELETOR DE CAIXA (TFL vs BOLÃƒO) */}
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
                            <Ticket size={16} /> Caixa BolÃ£o
                        </button>
                    )}
                </div>

                {(abaCaixa === 'bolao' && canSeeBolao) && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/5 rounded-full border border-indigo-500/10">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">Controle Central de BolÃµes</span>
                    </div>
                )}
            </div>

            {abaCaixa === 'bolao' ? (
                podeGerenciarCaixaBolao ? (
                    <GerenciamentoCaixaBolao />
                ) : (
                    <CaixaVirtualOperador />
                )
            ) : (
                <div className="grid grid-cols-[1fr_320px] gap-6 animate-in fade-in slide-in-from-left-4">
                    <div className="calculadora-area">
                        <div className="card">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Calculator size={22} className="text-primary-blue-light" />
                                Painel de Lancamentos
                            </h3>

                            <div className="grid gap-4">
                                {/* Botao Principal - Movimentacoes Gerais */}
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
                                            <div className="text-lg font-black text-white">Movimentacoes Gerais</div>
                                            <div className="text-xs text-white/80 mt-1">Entradas e saidas personalizadas</div>
                                        </div>
                                    </div>
                                    <div className="text-white/60">
                                        <TrendingUp size={24} />
                                    </div>
                                </button>

                                {/* Botoes Rapidos */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setTipoSelecionado('trocados')}
                                        className="btn btn-ghost h-20 flex items-center gap-3 border-border bg-surface-subtle hover:scale-105 transition-transform"
                                    >
                                        <div className="bg-primary-blue-light/10 p-2 rounded-xl">
                                            <ArrowRightLeft size={20} className="text-primary-blue-light" />
                                        </div>
                                        <span className="text-sm font-bold">Trocados</span>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-10 p-8 bg-surface-subtle rounded-3xl border border-dashed border-border text-center">
                                <div className="opacity-30 mb-4">
                                    <Calculator size={48} className="mx-auto" />
                                </div>
                                <h4 className="font-bold text-lg text-text-primary">Registro em tempo real</h4>
                                <p className="text-text-muted text-sm max-w-xs mx-auto mt-2">Cada lancamento e computado instantaneamente para a conciliacao final.</p>
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-area">
                        <div className="card h-full flex flex-col p-5">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide opacity-80 text-text-primary">
                                    <History size={16} className="text-text-muted" />
                                    MovimentaÃ§Ãµes
                                </h3>
                                <span className="badge text-[0.6rem]">TURNO ATIVO</span>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {movimentacoes.length === 0 ? (
                                    <div className="text-center py-16 px-4">
                                        <Clock size={40} className="mx-auto mb-6 text-text-muted opacity-10" />
                                        <p className="text-xs text-text-muted">Aguardando seu primeiro lancamento...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {movimentacoes.map((mov, idx) => (
                                            <div key={mov.id || idx} className="card p-3.5 bg-bg-dark border-border">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {getIcon(mov.tipo as TipoLancamento)}
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.8rem] font-bold text-text-primary">{mov.categorias_operacionais?.nome || getLabel(mov.tipo)}</span>
                                                            <span className="text-[0.65rem] text-text-muted flex items-center gap-1">
                                                                {mov.metodo_pagamento === 'pix' ? <Smartphone size={10} /> : <Wallet size={10} />}
                                                                {mov.metodo_pagamento === 'pix' ? 'Pix / Digital' : 'Dinheiro Fisico'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[0.9rem] font-extrabold ${(mov.tipo === 'sangria' || mov.tipo === 'pagamento') ? 'text-danger' : 'text-success'}`}>
                                                        {(mov.tipo === 'sangria' || mov.tipo === 'pagamento') ? '-' : '+'} R$ {(mov.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>

                                                {mov.descricao && (
                                                    <p className="text-[0.65rem] text-text-muted mt-2 italic border-t border-border/30 pt-2">
                                                        "{mov.descricao}"
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-6 border-t-2 border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Saldo em Caixa</span>
                                    <span className="font-extrabold text-xl text-text-primary">
                                        R$ {(sessaoAtiva?.valor_final_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

            {/* Modal de Movimentacao Geral */}
            {showMovimentacaoGeral && (
                <ModalMovimentacaoGeral
                    onClose={() => setShowMovimentacaoGeral(false)}
                    onSave={handleSaveEntry}
                />
            )}

            {/* Modal de Lancamento */}
            {tipoSelecionado && (
                <ModalLancamentoRapido
                    tipo={tipoSelecionado}
                    onClose={() => setTipoSelecionado(null)}
                    onSave={handleSaveEntry}
                />
            )}

            {/* Modal de Fechamento */}
            {showFechamento && (
                <ModalFechamentoCaixa
                    sessao={sessaoAtiva}
                    onClose={() => setShowFechamento(false)}
                    onFinish={handleFinishCaixa}
                />
            )}
        </div>
    );
}


