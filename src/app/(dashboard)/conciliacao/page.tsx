'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    Building, Loader2, CheckCircle2, AlertTriangle, 
    Calendar, DollarSign, TrendingUp, TrendingDown, 
    Smartphone, Coins, Banknote, Receipt, Plus, 
    RefreshCw, Filter, ArrowDownCircle, ArrowUpCircle,
    Save, Edit, X, Wallet
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { MoneyInput } from '@/components/ui/MoneyInput';

interface Loja {
    id: string;
    nome_fantasia: string;
}

interface ContaBancaria {
    id: string;
    nome: string;
    banco: string;
    banco_id: number;
    agencia?: string;
    conta_numero?: string;
}

interface ResumoConciliacao {
    saldo_inicial: number;
    total_entradas_pix: number;
    total_entradas_dinheiro: number;
    total_entradas_bolao_pix: number;
    total_entradas_bolao_dinheiro: number;
    total_entradas_geral: number;
    total_enviado_cofre: number;
    total_depositado: number;
    saldo_esperado_cofre: number;
    saldo_real_cofre: number;
    diferenca: number;
    total_fechamentos: number;
    total_aprovados: number;
    total_pendentes: number;
}

export default function ConciliacaoPage() {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [lojas, setLojas] = useState<Loja[]>([]);
    const [contas, setContas] = useState<ContaBancaria[]>([]);
    
    const [lojaSelecionada, setLojaSelecionada] = useState('');
    const [contaSelecionada, setContaSelecionada] = useState('');
    const [mesReferencia, setMesReferencia] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    
    const [resumo, setResumo] = useState<ResumoConciliacao | null>(null);
    const [depositos, setDepositos] = useState<any[]>([]);
    const [showDepositoModal, setShowDepositoModal] = useState(false);
    const [showSaldoModal, setShowSaldoModal] = useState(false);
    const [saldoInicialForm, setSaldoInicialForm] = useState({
        saldo: 0,
        observacoes: ''
    });
    const [depositoForm, setDepositoForm] = useState({
        valor: 0,
        data: new Date().toISOString().split('T')[0],
        observacoes: ''
    });
    const [processando, setProcessando] = useState(false);

    // Carregar lojas do usuário
    const carregarLojas = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setInitialLoad(false);
                setLoading(false);
                return;
            }

            // Buscar a empresa do usuário
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('empresa_id')
                .eq('id', user.id)
                .single();

            if (userError) {
                console.error('Erro ao buscar usuário:', userError);
                setInitialLoad(false);
                setLoading(false);
                return;
            }

            if (userData?.empresa_id) {
                // Buscar os dados da empresa
                const { data: empresaData, error: empresaError } = await supabase
                    .from('empresas')
                    .select('id, nome_fantasia')
                    .eq('id', userData.empresa_id)
                    .single();

                if (empresaError) {
                    console.error('Erro ao buscar empresa:', empresaError);
                    setInitialLoad(false);
                    setLoading(false);
                    return;
                }

                if (empresaData) {
                    const loja: Loja = {
                        id: empresaData.id,
                        nome_fantasia: empresaData.nome_fantasia || 'Minha Loja'
                    };
                    setLojas([loja]);
                    setLojaSelecionada(loja.id);
                }
            }
            setInitialLoad(false);
        } catch (err) {
            console.error('Erro carregar lojas:', err);
            setInitialLoad(false);
            setLoading(false);
        }
    }, [supabase]);

    // Carregar contas bancárias
    const carregarContas = useCallback(async () => {
        if (!lojaSelecionada) return;

        try {
            // Buscar contas bancárias
            const { data: contasData, error: contasError } = await supabase
                .from('financeiro_contas_bancarias')
                .select(`
                    id,
                    nome,
                    banco_id,
                    agencia,
                    conta_numero
                `)
                .eq('loja_id', lojaSelecionada);

            if (contasError) {
                console.error('Erro ao carregar contas:', contasError);
                return;
            }

            if (!contasData || contasData.length === 0) {
                setContas([]);
                setLoading(false);
                return;
            }

            // Buscar dados dos bancos separadamente
            const bancosIds = [...new Set(contasData.map(c => c.banco_id).filter(id => id))];
            let bancosMap = new Map();
            
            if (bancosIds.length > 0) {
                const { data: bancosData, error: bancosError } = await supabase
                    .from('financeiro_bancos')
                    .select('id, nome')
                    .in('id', bancosIds);
                
                if (!bancosError && bancosData) {
                    bancosData.forEach((banco: any) => {
                        bancosMap.set(banco.id, banco.nome);
                    });
                }
            }

            const contasFormatadas: ContaBancaria[] = contasData.map(c => ({
                id: c.id,
                nome: c.nome,
                banco: bancosMap.get(c.banco_id) || 'Banco não informado',
                banco_id: c.banco_id,
                agencia: c.agencia,
                conta_numero: c.conta_numero
            }));
            
            setContas(contasFormatadas);
            if (contasFormatadas.length > 0 && !contaSelecionada) {
                setContaSelecionada(contasFormatadas[0].id);
            }
        } catch (err) {
            console.error('Erro carregar contas:', err);
        } finally {
            setLoading(false);
        }
    }, [supabase, lojaSelecionada, contaSelecionada]);

    // Buscar resumo da conciliação
    const buscarResumo = useCallback(async () => {
        if (!lojaSelecionada || !contaSelecionada || !mesReferencia) return;

        setLoading(true);
        try {
            const dataInicio = `${mesReferencia}-01`;
            
            const { data, error } = await supabase
                .rpc('get_resumo_conciliacao_completo', {
                    p_loja_id: lojaSelecionada,
                    p_conta_bancaria_id: contaSelecionada,
                    p_mes_referencia: dataInicio
                });

            if (error) throw error;
            
            if (data && data.length > 0) {
                setResumo(data[0] as ResumoConciliacao);
            } else {
                setResumo(null);
            }

            // Buscar saldo inicial atual
            const { data: saldoData } = await supabase
                .from('conciliacao_saldo_inicial')
                .select('saldo_inicial, observacoes')
                .eq('loja_id', lojaSelecionada)
                .eq('conta_bancaria_id', contaSelecionada)
                .eq('mes_referencia', dataInicio)
                .maybeSingle();

            if (saldoData) {
                setSaldoInicialForm({
                    saldo: saldoData.saldo_inicial || 0,
                    observacoes: saldoData.observacoes || ''
                });
            }

            // Buscar depósitos do mês
            const { data: depositosData } = await supabase
                .from('vw_historico_depositos')
                .select('*')
                .eq('loja_id', lojaSelecionada)
                .eq('conta_bancaria_id', contaSelecionada)
                .gte('data_movimentacao', dataInicio)
                .lte('data_movimentacao', `${mesReferencia}-31`);

            setDepositos(depositosData || []);

        } catch (err: any) {
            console.error('Erro ao buscar resumo:', err);
            toast({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [supabase, lojaSelecionada, contaSelecionada, mesReferencia, toast]);

    // Efeito para carregar lojas inicialmente
    useEffect(() => {
        carregarLojas();
    }, [carregarLojas]);

    // Efeito para carregar contas quando loja for selecionada
    useEffect(() => {
        if (lojaSelecionada && !initialLoad) {
            carregarContas();
        }
    }, [lojaSelecionada, initialLoad, carregarContas]);

    // Efeito para carregar resumo quando todos os filtros estiverem prontos
    useEffect(() => {
        if (lojaSelecionada && contaSelecionada && mesReferencia && !initialLoad) {
            buscarResumo();
        }
    }, [lojaSelecionada, contaSelecionada, mesReferencia, initialLoad, buscarResumo]);

    const handleRegistrarSaldoInicial = async () => {
        if (!lojaSelecionada || !contaSelecionada) return;
        
        setProcessando(true);
        try {
            const dataInicio = `${mesReferencia}-01`;
            const { data: { user } } = await supabase.auth.getUser();
            
            const { data, error } = await supabase
                .rpc('registrar_saldo_inicial', {
                    p_loja_id: lojaSelecionada,
                    p_conta_bancaria_id: contaSelecionada,
                    p_mes_referencia: dataInicio,
                    p_saldo_inicial: saldoInicialForm.saldo,
                    p_observacoes: saldoInicialForm.observacoes || null,
                    p_usuario_id: user?.id
                });

            if (error) throw error;
            
            toast({ message: 'Saldo inicial registrado com sucesso!', type: 'success' });
            setShowSaldoModal(false);
            buscarResumo();
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setProcessando(false);
        }
    };

    const handleRegistrarDeposito = async () => {
        if (!lojaSelecionada || !contaSelecionada || depositoForm.valor <= 0) return;
        
        setProcessando(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            const { data, error } = await supabase
                .rpc('registrar_deposito_conciliacao', {
                    p_loja_id: lojaSelecionada,
                    p_conta_bancaria_id: contaSelecionada,
                    p_valor: depositoForm.valor,
                    p_data_deposito: depositoForm.data,
                    p_observacoes: depositoForm.observacoes || null,
                    p_usuario_id: user?.id
                });

            if (error) throw error;
            
            toast({ message: 'Depósito registrado com sucesso!', type: 'success' });
            setShowDepositoModal(false);
            setDepositoForm({ valor: 0, data: new Date().toISOString().split('T')[0], observacoes: '' });
            buscarResumo();
        } catch (err: any) {
            toast({ message: err.message, type: 'error' });
        } finally {
            setProcessando(false);
        }
    };

    const formatarMoeda = (valor: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    };

    const formatarData = (data: string) => {
        return new Date(data).toLocaleDateString('pt-BR');
    };

    const formatarMes = (mes: string) => {
        const [ano, mesNum] = mes.split('-');
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
    };

    // Mostrar loading apenas no carregamento inicial
    if (initialLoad || (loading && !resumo && lojaSelecionada && contaSelecionada)) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-blue-light/10 flex items-center justify-center">
                        <Wallet size={20} className="text-primary-blue-light" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black">Conciliação Bancária</h1>
                        <p className="text-xs text-muted">Controle de entradas e depósitos</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowSaldoModal(true)} 
                        className="btn btn-ghost btn-sm"
                    >
                        <Edit size={14} /> Saldo Inicial
                    </button>
                    <button 
                        onClick={() => setShowDepositoModal(true)} 
                        className="btn btn-primary"
                    >
                        <Plus size={14} /> Registrar Depósito
                    </button>
                    <button onClick={buscarResumo} className="btn btn-ghost btn-sm">
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Filial</label>
                    <select 
                        value={lojaSelecionada} 
                        onChange={e => setLojaSelecionada(e.target.value)}
                        className="input w-full"
                    >
                        {lojas.map(loja => (
                            <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Conta Bancária</label>
                    <select 
                        value={contaSelecionada} 
                        onChange={e => setContaSelecionada(e.target.value)}
                        className="input w-full"
                        disabled={contas.length === 0}
                    >
                        {contas.map(conta => (
                            <option key={conta.id} value={conta.id}>{conta.banco} - {conta.nome}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Mês de Referência</label>
                    <input 
                        type="month" 
                        value={mesReferencia} 
                        onChange={e => setMesReferencia(e.target.value)}
                        className="input w-full"
                    />
                </div>
            </div>

            {/* Cards de Resumo */}
            {resumo ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="card p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold text-muted uppercase">Saldo Inicial</p>
                                <button 
                                    onClick={() => setShowSaldoModal(true)}
                                    className="text-primary-blue-light hover:underline text-[10px]"
                                >
                                    editar
                                </button>
                            </div>
                            <p className="text-2xl font-bold">{formatarMoeda(resumo.saldo_inicial)}</p>
                        </div>

                        <div className="card p-4 bg-success/5 border-success/20">
                            <p className="text-[10px] font-bold text-success uppercase">Total Entradas TFL</p>
                            <p className="text-2xl font-bold text-success">{formatarMoeda(resumo.total_entradas_geral)}</p>
                            <div className="text-xs text-muted mt-1">
                                <span className="inline-flex items-center gap-1 mr-3"><Smartphone size={10} /> PIX: {formatarMoeda(resumo.total_entradas_pix + resumo.total_entradas_bolao_pix)}</span>
                                <span className="inline-flex items-center gap-1"><Banknote size={10} /> Dinheiro: {formatarMoeda(resumo.total_entradas_dinheiro + resumo.total_entradas_bolao_dinheiro)}</span>
                            </div>
                        </div>

                        <div className="card p-4 bg-warning/5 border-warning/20">
                            <p className="text-[10px] font-bold text-warning uppercase">Enviado ao Cofre</p>
                            <p className="text-2xl font-bold text-warning">{formatarMoeda(resumo.total_enviado_cofre)}</p>
                            <p className="text-xs text-muted mt-1">
                                {resumo.total_aprovados} de {resumo.total_fechamentos} fechamentos aprovados
                            </p>
                        </div>

                        <div className="card p-4 bg-primary-blue-light/5 border-primary-blue-light/20">
                            <p className="text-[10px] font-bold text-primary-blue-light uppercase">Total Depositado</p>
                            <p className="text-2xl font-bold text-primary-blue-light">{formatarMoeda(resumo.total_depositado)}</p>
                        </div>
                    </div>

                    {/* Conciliação do Cofre */}
                    <div className="card p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Coins size={18} className="text-primary-blue-light" />
                            Conciliação do Cofre
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center p-4 rounded-xl bg-surface-subtle">
                                <p className="text-xs text-muted font-bold mb-1">Saldo Esperado</p>
                                <p className="text-2xl font-bold text-primary">
                                    {formatarMoeda(resumo.saldo_esperado_cofre)}
                                </p>
                                <p className="text-[10px] text-muted mt-1">
                                    Saldo Inicial + Enviado ao Cofre
                                </p>
                            </div>
                            
                            <div className="text-center p-4 rounded-xl bg-surface-subtle">
                                <p className="text-xs text-muted font-bold mb-1">Saldo Real</p>
                                <p className="text-2xl font-bold text-primary">
                                    {formatarMoeda(resumo.saldo_real_cofre)}
                                </p>
                                <p className="text-[10px] text-muted mt-1">
                                    Saldo Esperado - Depósitos
                                </p>
                            </div>
                            
                            <div className={`text-center p-4 rounded-xl ${
                                resumo.diferenca === 0 ? 'bg-success/10' : 
                                resumo.diferenca > 0 ? 'bg-warning/10' : 'bg-danger/10'
                            }`}>
                                <p className="text-xs text-muted font-bold mb-1">Diferença</p>
                                <p className={`text-2xl font-bold ${
                                    resumo.diferenca === 0 ? 'text-success' : 
                                    resumo.diferenca > 0 ? 'text-warning' : 'text-danger'
                                }`}>
                                    {resumo.diferenca > 0 ? '+' : ''}{formatarMoeda(resumo.diferenca)}
                                </p>
                                <p className="text-[10px] text-muted mt-1">
                                    {resumo.diferenca === 0 ? 'Conciliado' : 
                                      resumo.diferenca > 0 ? 'Saldo a depositar' : 'Saldo excedente'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Histórico de Depósitos */}
                    {depositos.length > 0 && (
                        <div className="card p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Receipt size={18} className="text-primary-blue-light" />
                                Histórico de Depósitos
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-2 px-2">Data</th>
                                            <th className="text-left py-2 px-2">Conta</th>
                                            <th className="text-right py-2 px-2">Valor</th>
                                            <th className="text-left py-2 px-2">Observações</th>
                                            <th className="text-left py-2 px-2">Registrado por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {depositos.map((dep) => (
                                            <tr key={dep.id} className="border-b border-border/50 hover:bg-surface-subtle">
                                                <td className="py-2 px-2">{formatarData(dep.data_movimentacao)}</td>
                                                <td className="py-2 px-2">{dep.banco_nome} - {dep.conta_nome}</td>
                                                <td className="py-2 px-2 text-right font-bold text-success">{formatarMoeda(dep.valor)}</td>
                                                <td className="py-2 px-2 text-muted text-sm">{dep.observacoes || '-'}</td>
                                                <td className="py-2 px-2 text-muted text-sm">{dep.operador_nome || 'Sistema'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="card p-12 text-center">
                    <Wallet size={48} className="mx-auto mb-4 text-muted opacity-50" />
                    <p className="text-muted">Selecione uma conta e mês para visualizar a conciliação</p>
                </div>
            )}

            {/* Modal Saldo Inicial */}
            {showSaldoModal && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowSaldoModal(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black flex items-center gap-2">
                                <Wallet size={16} className="text-primary-blue-light" />
                                Saldo Inicial - {formatarMes(mesReferencia)}
                            </h3>
                            <button onClick={() => setShowSaldoModal(false)} className="p-1 hover:bg-white/5 rounded">
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase">Saldo Inicial da Conta</label>
                            <MoneyInput 
                                value={saldoInicialForm.saldo}
                                onValueChange={(v) => setSaldoInicialForm(prev => ({ ...prev, saldo: v }))}
                                className="text-xl font-bold"
                            />
                            <p className="text-[10px] text-muted mt-1">
                                Saldo disponível na conta no início do mês
                            </p>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase">Observações (opcional)</label>
                            <textarea 
                                className="input w-full text-sm"
                                rows={2}
                                value={saldoInicialForm.observacoes}
                                onChange={(e) => setSaldoInicialForm(prev => ({ ...prev, observacoes: e.target.value }))}
                                placeholder="Informações adicionais..."
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button className="btn btn-ghost flex-1" onClick={() => setShowSaldoModal(false)}>
                                Cancelar
                            </button>
                            <button 
                                className="btn btn-primary flex-1 font-black"
                                onClick={handleRegistrarSaldoInicial}
                                disabled={processando}
                            >
                                {processando ? <Loader2 className="animate-spin" size={16} /> : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Modal Registrar Depósito */}
            {showDepositoModal && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowDepositoModal(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-bg-card border border-border rounded-2xl z-50 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black flex items-center gap-2">
                                <ArrowDownCircle size={16} className="text-danger" />
                                Registrar Depósito
                            </h3>
                            <button onClick={() => setShowDepositoModal(false)} className="p-1 hover:bg-white/5 rounded">
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase">Valor Depositado</label>
                            <MoneyInput 
                                value={depositoForm.valor}
                                onValueChange={(v) => setDepositoForm(prev => ({ ...prev, valor: v }))}
                                className="text-xl font-bold"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase">Data do Depósito</label>
                            <input 
                                type="date" 
                                className="input w-full"
                                value={depositoForm.data}
                                onChange={(e) => setDepositoForm(prev => ({ ...prev, data: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase">Observações (opcional)</label>
                            <textarea 
                                className="input w-full text-sm"
                                rows={2}
                                value={depositoForm.observacoes}
                                onChange={(e) => setDepositoForm(prev => ({ ...prev, observacoes: e.target.value }))}
                                placeholder="Referência do depósito, comprovante, etc..."
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button className="btn btn-ghost flex-1" onClick={() => setShowDepositoModal(false)}>
                                Cancelar
                            </button>
                            <button 
                                className="btn btn-primary flex-1 font-black"
                                onClick={handleRegistrarDeposito}
                                disabled={processando || depositoForm.valor <= 0}
                            >
                                {processando ? <Loader2 className="animate-spin" size={16} /> : 'Registrar Depósito'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
