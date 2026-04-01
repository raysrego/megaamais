'use client';

import { useState, useEffect, useCallback } from 'react';
import { Vault, CircleArrowUp as ArrowUpCircle, CircleArrowDown as ArrowDownCircle, Building, Loader as Loader2, DollarSign, CircleCheck as CheckCircle2, Clock, ExternalLink, Plus, ListFilter as Filter, Calendar } from 'lucide-react';
import {
    getSaldoCofre,
    getEntradasCofrePorFechamento,
    getHistoricoCofre,
    registrarDepositoCofre
} from '@/actions/cofre';
import { getEmpresas } from '@/actions/admin';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { useToast } from '@/contexts/ToastContext';

export default function CofrePage() {
    const { toast } = useToast();
    const [saldo, setSaldo] = useState(0);
    const [entradas, setEntradas] = useState<any[]>([]);
    const [historico, setHistorico] = useState<any[]>([]);
    const [historicoFiltrado, setHistoricoFiltrado] = useState<any[]>([]);
    const [filiais, setFiliais] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeposito, setShowDeposito] = useState(false);
    const [depositoValor, setDepositoValor] = useState(0);
    const [depositoFilial, setDepositoFilial] = useState('');
    const [depositoData, setDepositoData] = useState(new Date().toISOString().split('T')[0]);
    const [depositoObs, setDepositoObs] = useState('');
    const [depositing, setDepositing] = useState(false);
    const [tab, setTab] = useState<'entradas' | 'historico'>('entradas');

    // Filtros do histórico
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const [s, e, h, f] = await Promise.all([
                getSaldoCofre(),
                getEntradasCofrePorFechamento(),
                getHistoricoCofre(),
                getEmpresas(),
            ]);
            setSaldo(s);
            setEntradas(e);
            setHistorico(h);
            setFiliais(f);
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    // Aplicar filtros no histórico
    useEffect(() => {
        let filtered = [...historico];

        // Filtro por tipo
        if (filtroTipo !== 'todos') {
            if (filtroTipo === 'entrada') {
                filtered = filtered.filter(m => m.tipo.includes('entrada'));
            } else if (filtroTipo === 'saida') {
                filtered = filtered.filter(m => m.tipo.includes('saida'));
            } else {
                filtered = filtered.filter(m => m.tipo === filtroTipo);
            }
        }

        // Filtro por data início
        if (filtroDataInicio) {
            filtered = filtered.filter(m => {
                const dataMovimentacao = new Date(m.data_movimentacao || m.created_at);
                return dataMovimentacao >= new Date(filtroDataInicio);
            });
        }

        // Filtro por data fim
        if (filtroDataFim) {
            filtered = filtered.filter(m => {
                const dataMovimentacao = new Date(m.data_movimentacao || m.created_at);
                return dataMovimentacao <= new Date(filtroDataFim + 'T23:59:59');
            });
        }

        setHistoricoFiltrado(filtered);
    }, [historico, filtroTipo, filtroDataInicio, filtroDataFim]);

    const handleDeposito = async () => {
        if (depositoValor <= 0 || !depositoFilial || !depositoData) {
            toast({ message: 'Informe valor, data e filial destino', type: 'warning' });
            return;
        }
        setDepositing(true);
        try {
            await registrarDepositoCofre(depositoValor, depositoFilial, depositoObs || undefined, depositoData);
            toast({ message: 'Depósito registrado com sucesso!', type: 'success' });
            setShowDeposito(false);
            setDepositoValor(0);
            setDepositoFilial('');
            setDepositoData(new Date().toISOString().split('T')[0]);
            setDepositoObs('');
            carregarDados();
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setDepositing(false);
        }
    };

    const limparFiltros = () => {
        setFiltroTipo('todos');
        setFiltroDataInicio('');
        setFiltroDataFim('');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-muted" size={32} />
            </div>
        );
    }

    const entradasPendentes = entradas.filter(e => e.auditoria_status === 'aprovado' && !e.cofre_confirmado);
    const totalDisponivel = entradas
        .filter(e => e.auditoria_status === 'aprovado')
        .reduce((sum, e) => sum + (e.valor_enviado_cofre || 0), 0);

    return (
        <div className="space-y-6 p-4 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-blue-light/10 flex items-center justify-center">
                        <Vault size={20} className="text-primary-blue-light" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black">Cofre</h1>
                        <p className="text-xs text-muted">Controle de valores em espécie</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowDeposito(true)}
                    className="btn btn-primary"
                >
                    <Building size={14} /> Registrar Depósito
                </button>
            </div>

            {/* Saldo */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-primary-blue-light/10 to-primary-blue-light/5 border border-primary-blue-light/20 text-center">
                <p className="text-[10px] uppercase font-black text-muted tracking-widest mb-1">Saldo Atual do Cofre</p>
                <p className="text-3xl font-black text-primary-blue-light">
                    R$ {saldo.toFixed(2)}
                </p>
            </div>

            {/* Abas */}
            <div className="flex gap-1 bg-surface-subtle rounded-xl p-1">
                <button
                    onClick={() => setTab('entradas')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        tab === 'entradas' ? 'bg-bg-card text-text-primary shadow' : 'text-muted'
                    }`}
                >
                    Entradas por Fechamento
                </button>
                <button
                    onClick={() => setTab('historico')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        tab === 'historico' ? 'bg-bg-card text-text-primary shadow' : 'text-muted'
                    }`}
                >
                    Histórico Completo
                </button>
            </div>

            {/* Tab: Entradas por Fechamento */}
            {tab === 'entradas' && (
                <div className="space-y-2">
                    {entradas.length === 0 ? (
                        <p className="text-center text-muted text-sm py-8">
                            Nenhum fechamento aprovado com valor de cofre.
                        </p>
                    ) : (
                        entradas.map((e: any) => (
                            <div key={e.sessao_id} className="p-3 rounded-xl border border-border bg-bg-card flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                        e.auditoria_status === 'aprovado' ? 'bg-success/10' : 'bg-warning/10'
                                    }`}>
                                        {e.auditoria_status === 'aprovado' ? (
                                            <CheckCircle2 size={14} className="text-success" />
                                        ) : (
                                            <Clock size={14} className="text-warning" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">
                                            {e.terminal_id} — {e.operador_nome || 'Operador'}
                                        </p>
                                        <p className="text-[10px] text-muted">
                                            Turno {e.data_turno} • {e.auditoria_status === 'aprovado' ? 'Aprovado' : 'Pendente'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-success">
                                        R$ {(e.valor_enviado_cofre || 0).toFixed(2)}
                                    </p>
                                    {e.cofre_movimentacao_id && (
                                        <p className="text-[10px] text-muted">Confirmado no cofre</p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Tab: Histórico */}
            {tab === 'historico' && (
                <div className="space-y-4">
                    {/* Filtros */}
                    <div className="p-4 rounded-xl border border-border bg-bg-card">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter size={16} className="text-primary-blue-light" />
                            <h3 className="text-sm font-bold">Filtros</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase block mb-1">Tipo de Movimentação</label>
                                <select
                                    value={filtroTipo}
                                    onChange={e => setFiltroTipo(e.target.value)}
                                    className="input w-full text-sm"
                                >
                                    <option value="todos">Todas</option>
                                    <option value="entrada">Todas Entradas</option>
                                    <option value="saida">Todas Saídas</option>
                                    <option value="entrada_fechamento">Fechamento de Turno</option>
                                    <option value="entrada_sangria">Sangria Recebida</option>
                                    <option value="saida_deposito">Depósito Bancário</option>
                                </select>
                            </div>

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

                            <div className="flex items-end">
                                <button
                                    onClick={limparFiltros}
                                    className="btn btn-ghost w-full text-sm"
                                >
                                    Limpar Filtros
                                </button>
                            </div>
                        </div>

                        <p className="text-[10px] text-muted mt-2">
                            {historicoFiltrado.length} de {historico.length} movimentações
                        </p>
                    </div>

                    {/* Lista de Movimentações */}
                    <div className="space-y-2">
                        {historicoFiltrado.length === 0 ? (
                            <p className="text-center text-muted text-sm py-8">
                                {historico.length === 0 ? 'Nenhuma movimentação.' : 'Nenhuma movimentação corresponde aos filtros aplicados.'}
                            </p>
                        ) : (
                            historicoFiltrado.map((m: any) => {
                                const isEntrada = m.tipo.includes('entrada');
                                return (
                                    <div key={m.id} className="p-3 rounded-xl border border-border bg-bg-card flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                isEntrada ? 'bg-success/10' : 'bg-danger/10'
                                            }`}>
                                                {isEntrada ? (
                                                    <ArrowUpCircle size={14} className="text-success" />
                                                ) : (
                                                    <ArrowDownCircle size={14} className="text-danger" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {m.tipo === 'entrada_fechamento' ? 'Fechamento de Turno' :
                                                     m.tipo === 'entrada_sangria' ? 'Sangria Recebida' :
                                                     m.tipo === 'saida_deposito' ? 'Depósito Bancário' :
                                                     m.tipo}
                                                </p>
                                                <p className="text-[10px] text-muted">
                                                    {new Date(m.data_movimentacao || m.created_at).toLocaleString('pt-BR')}
                                                    {m.observacoes && ` — ${m.observacoes}`}
                                                </p>
                                            </div>
                                        </div>
                                        <p className={`text-sm font-black ${isEntrada ? 'text-success' : 'text-danger'}`}>
                                            {isEntrada ? '+' : '-'}R$ {Math.abs(m.valor).toFixed(2)}
                                        </p>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Modal Depósito */}
            {showDeposito && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowDeposito(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-sm bg-bg-card border border-border rounded-2xl z-50 p-6 space-y-4">
                        <h3 className="text-base font-black flex items-center gap-2">
                            <Building size={16} className="text-primary-blue-light" />
                            Registrar Depósito Bancário
                        </h3>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted uppercase">Filial Destino</label>
                            <select
                                value={depositoFilial}
                                onChange={e => setDepositoFilial(e.target.value)}
                                className="input w-full"
                            >
                                <option value="">Selecione...</option>
                                {filiais.map((f: any) => (
                                    <option key={f.id} value={f.id}>
                                        {f.nome_fantasia || f.nome}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted uppercase">Valor do Depósito</label>
                            <MoneyInput value={depositoValor} onValueChange={setDepositoValor} className="text-lg font-bold" />
                            {depositoValor > saldo && (
                                <p className="text-xs text-danger font-bold">
                                    Valor superior ao saldo do cofre (R$ {saldo.toFixed(2)})
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted uppercase">Data do Depósito</label>
                            <input
                                type="date"
                                className="input w-full"
                                value={depositoData}
                                onChange={e => setDepositoData(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted uppercase">Observação (opcional)</label>
                            <input
                                className="input w-full"
                                value={depositoObs}
                                onChange={e => setDepositoObs(e.target.value)}
                                placeholder="Ex: Depósito ref. turnos 26/03"
                            />
                        </div>

                        <p className="text-xs text-muted">
                            Sobram R$ {Math.max(0, saldo - depositoValor).toFixed(2)} no cofre após o depósito.
                        </p>

                        <div className="flex gap-3">
                            <button className="btn btn-ghost flex-1" onClick={() => setShowDeposito(false)} disabled={depositing}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary flex-1 font-black"
                                onClick={handleDeposito}
                                disabled={depositing || depositoValor <= 0 || !depositoFilial || depositoValor > saldo}
                            >
                                {depositing ? <Loader2 className="animate-spin" size={14} /> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
