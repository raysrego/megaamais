'use client';

import { useState, useRef, useEffect } from 'react';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import { useItensFinanceiros } from '@/hooks/useItensFinanceiros';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil'; // Access Control
import { useToast } from '@/contexts/ToastContext';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'; // Direct DB Access
import {
    Save,
    Calendar,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Loader2,
    CheckCircle2,
    RotateCcw,
    Table2,
    Trash2,
    Database,
    CalendarRange,
    Filter,
    Shield,
    Plus,
    Minus,
    Copy,
    ListPlus
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';

interface LancamentoHistorico {
    id: number;
    data_vencimento: string;
    tipo: 'receita' | 'despesa';
    descricao: string;
    valor: number;
    item: string;
    loja_id: string;
    created_at: string;
}

export function SaneamentoDadosFinanceiros() {
    const supabase = createBrowserSupabaseClient();
    const { salvarTransacao } = useFinanceiro();
    const { itens: categorias, fetchItens } = useItensFinanceiros();
    const { lojaAtual, lojasDisponiveis } = useLoja();
    const { isAdmin, loading: loadingPerfil } = usePerfil(); // Access Check
    const { toast } = useToast();

    // Estados do Formulário (Persistentes Globais)
    const [lojaId, setLojaId] = useState<string>(lojaAtual?.id || '');
    const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');

    const [numLinhas, setNumLinhas] = useState<number>(0);
    const [replicarCategoria, setReplicarCategoria] = useState(false);
    const [batchRows, setBatchRows] = useState<Array<{
        id: string; // unique temp id
        modoData: 'unica' | 'periodo';
        data: string;
        dataFim: string;
        categoriaId: string;
        valor: number;
        descricao: string;
    }>>([]);

    const [loading, setLoading] = useState(false);

    // Histórico Real (DB)
    const [historico, setHistorico] = useState<LancamentoHistorico[]>([]);
    const [filtroLojaHistorico, setFiltroLojaHistorico] = useState<string>(''); // Filtro independente para histórico

    // Inicializa Batch Rows quando numLinhas muda
    useEffect(() => {
        setBatchRows(prev => {
            const currentCount = prev.length;
            if (numLinhas > currentCount) {
                // Se estiver replicando, pegar a categoria da primeira linha
                const firstCat = (replicarCategoria && prev.length > 0) ? prev[0].categoriaId : '';

                // Adicionar linhas
                const newRows = Array.from({ length: numLinhas - currentCount }).map(() => ({
                    id: Math.random().toString(36).substring(7), // ID Simples compatível
                    modoData: 'unica',
                    data: new Date().toISOString().split('T')[0],
                    dataFim: new Date().toISOString().split('T')[0],
                    categoriaId: firstCat,
                    valor: 0,
                    descricao: ''
                }));
                return [...prev, ...newRows as any];
            } else if (numLinhas < currentCount) {
                // Remover linhas (do final)
                return prev.slice(0, numLinhas);
            }
            return prev;
        });
    }, [numLinhas, replicarCategoria]);

    // Carregar categorias ao iniciar ou mudar loja
    useEffect(() => {
        // Busca itens da loja selecionada + Globais
        fetchItens(lojaId || null);
    }, [lojaId, fetchItens]);

    // Sincronizar com a loja do contexto se o usuário mudar lá em cima
    useEffect(() => {
        if (lojaAtual?.id && !lojaId) {
            setLojaId(lojaAtual.id);
        }
    }, [lojaAtual]);

    // Busca Histórico Real do Banco
    const fetchHistorico = async () => {
        let query = supabase
            .from('financeiro_contas')
            .select('id, data_vencimento, tipo, descricao, valor, item, loja_id, created_at')
            .order('created_at', { ascending: false }) // Mais recentes primeiro
            .limit(50); // Últimos 50

        if (filtroLojaHistorico) {
            query = query.eq('loja_id', filtroLojaHistorico);
        }

        const { data, error } = await query;
        if (!error && data) {
            setHistorico(data as LancamentoHistorico[]);
        }
    };

    // Atualiza histórico ao mudar filtro
    useEffect(() => {
        fetchHistorico();
    }, [filtroLojaHistorico]);

    // Setar loja padrão se houver apenas uma
    useEffect(() => {
        if (lojasDisponiveis.length === 1 && !lojaId) {
            setLojaId(lojasDisponiveis[0].id);
        }
    }, [lojasDisponiveis, lojaId]);

    // Função para ligar/desligar replicação e aplicar imediatamente
    const toggleReplicar = (checked: boolean) => {
        setReplicarCategoria(checked);
        if (checked && batchRows.length > 0) {
            const firstCat = batchRows[0].categoriaId;
            if (firstCat) {
                setBatchRows(prev => prev.map(row => ({ ...row, categoriaId: firstCat })));
            }
        }
    };

    // Atualizar campo de uma linha específica
    const updateRow = (id: string, field: string, value: any) => {
        setBatchRows(prev => {
            const isFirstRow = prev.length > 0 && prev[0].id === id;

            return prev.map((row) => {
                // Se for a linha que está sendo editada
                if (row.id === id) {
                    const updatedRow = { ...row, [field]: value };

                    // Lógica especial para Categoria: Auto-ajuste de valor padrão se houver
                    if (field === 'categoriaId') {
                        const cat = categorias.find(c => c.id.toString() === value);
                        if (cat && row.valor === 0 && cat.valor_padrao) {
                            updatedRow.valor = cat.valor_padrao;
                        }
                    }

                    return updatedRow;
                }

                // Lógica de REDUPLICAÇÃO: se eu editar a primeira linha e a flag estiver ativa
                if (replicarCategoria && isFirstRow && field === 'categoriaId') {
                    return { ...row, [field]: value };
                }

                return row;
            });
        });
    };

    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // Validação Global
        if (!lojaId) {
            toast({ message: 'Selecione a Loja no cabeçalho.', type: 'warning' });
            return;
        }

        // Filtrar linhas válidas (com Categoria e Valor)
        const validRows = batchRows.filter(row => row.categoriaId && row.valor > 0);

        if (validRows.length === 0) {
            toast({ message: 'Preencha pelo menos uma linha com Categoria e Valor.', type: 'warning' });
            return;
        }

        setLoading(true);
        // Inicializa progresso visual
        setProgress({ current: 0, total: validRows.length });

        let successCount = 0;
        let failCount = 0;

        try {
            // Processamento Sequencial (Batch)
            // Alterado de Promise.all para loop for..of para evitar gargalos de conexão e race conditions
            for (let i = 0; i < validRows.length; i++) {
                const row = validRows[i];

                // Atualiza progresso (visual)
                setProgress({ current: i + 1, total: validRows.length });

                try {
                    const cat = categorias.find(c => c.id.toString() === row.categoriaId);
                    let descricaoBase = row.descricao.trim() || cat?.item || 'Movimento Financeiro';

                    let descricaoFinal = descricaoBase;
                    let dataTransacao = row.data;

                    if (row.modoData === 'periodo') {
                        const fmt = (d: string) => d.split('-').reverse().join('/');
                        const periodoStr = `[Ref: ${fmt(row.data)} à ${fmt(row.dataFim)}]`;
                        descricaoFinal = `${periodoStr} ${descricaoBase}`;
                        dataTransacao = row.dataFim;
                    }

                    // Pequeno delay artificial para garantir que o banco não trave por concorrência excessiva
                    // e permitir que o UI thread atualize a barra de progresso
                    await new Promise(r => setTimeout(r, 100));

                    await salvarTransacao({
                        tipo,
                        descricao: descricaoFinal,
                        valor: row.valor,
                        item: cat?.item || 'Movimento Diverso', // Fallback melhor que 'Outtros'
                        data_vencimento: dataTransacao,
                        recorrente: false,
                        frequencia: null,
                        loja_id: lojaId,
                        metodo_pagamento: 'dinheiro',
                        status: 'pago',
                        data_pagamento: dataTransacao,
                        item_financeiro_id: cat ? cat.id : null
                    });

                    successCount++;
                } catch (err: any) {
                    console.error(`Falha na linha ${i + 1}:`, err);
                    failCount++;
                    // Não para o loop, tenta salvar o restante
                    toast({ message: `Erro na linha ${i + 1}: ${err.message || 'Falha ao salvar'}`, type: 'error' });
                }
            }

            // Refresh no histórico real apenas no final
            await fetchHistorico();

            if (failCount === 0) {
                toast({ message: `${successCount} lançamentos registrados com sucesso!`, type: 'success' });
                // Resetar Grid Somente se TUDO deu certo
                setBatchRows(prev => prev.map(row => ({
                    id: Math.random().toString(36).substring(7),
                    modoData: 'unica',
                    data: new Date().toISOString().split('T')[0],
                    dataFim: new Date().toISOString().split('T')[0],
                    categoriaId: '',
                    valor: 0,
                    descricao: ''
                })));
            } else {
                toast({ message: `${successCount} salvos, mas ${failCount} falharam. Verifique o console.`, type: 'warning' });
            }

        } catch (error) {
            console.error(error);
            toast({ message: 'Erro crítico no processamento do lote.', type: 'error' });
        } finally {
            setLoading(false);
            setProgress(null);
        }
    };

    // Atalho F12 Global
    useEffect(() => {
        const handleKeyDownGlobal = (e: KeyboardEvent) => {
            if (e.key === 'F12') {
                e.preventDefault();
                handleSubmit();
            }
        };

        window.addEventListener('keydown', handleKeyDownGlobal);
        return () => window.removeEventListener('keydown', handleKeyDownGlobal);
    }, [batchRows, lojaId, tipo, loading]); // Dependências necessárias para o submit

    // Navegação por Enter
    const handleEnterNavigation = (e: React.KeyboardEvent, rowIndex: number, fieldName: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            const fields = ['data', 'dataFim', 'categoriaId', 'valor', 'descricao'];
            const currentRow = batchRows[rowIndex];
            let currentFieldIndex = fields.indexOf(fieldName);

            // Se for 'data' e não tiver 'periodo', pula dataFim
            if (fieldName === 'data' && currentRow.modoData === 'unica') {
                currentFieldIndex = fields.indexOf('dataFim'); // pula para o índice da dataFim para que o próximo seja categoria
            }

            const nextFieldIndex = currentFieldIndex + 1;

            if (nextFieldIndex < fields.length) {
                // Focar próximo campo da mesma linha
                const nextFieldName = fields[nextFieldIndex];
                const selector = `[data-row="${rowIndex}"][data-field="${nextFieldName}"]`;
                const nextElement = document.querySelector(selector) as HTMLElement;
                nextElement?.focus();
            } else if (rowIndex < numLinhas - 1) {
                // Focar primeiro campo da PRÓXIMA linha
                const selector = `[data-row="${rowIndex + 1}"][data-field="data"]`;
                const nextElement = document.querySelector(selector) as HTMLElement;
                nextElement?.focus();
            }
            // Se for o final da última linha, não faz nada (trava)
        }
    };

    const handleReset = () => {
        if (confirm('Deseja realmente cancelar e limpar todos os lançamentos atuais?')) {
            setNumLinhas(0);
            setReplicarCategoria(false);
            setBatchRows([]);
            toast({ message: 'Lançamentos cancelados e formulário resetado.', type: 'info' });
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                    <Database size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-foreground">Saneamento de Dados (Batch)</h2>
                    <p className="text-sm text-muted-foreground font-medium">Lançamento em lote para preenchimento histórico</p>
                </div>
            </div>

            {/* LAYOUT VERTICAL: FORMULÁRIO ACIMA, HISTÓRICO ABAIXO */}
            <div className="space-y-8">
                {/* ÁREA DE LANÇAMENTO (Full Width) */}
                <div className="bg-card border border-border rounded-3xl p-6 relative overflow-hidden group">
                    {/* Glow Effect apenas no Dark Mode */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none dark:block hidden" />

                    <form onSubmit={handleSubmit} className="relative z-10 space-y-6">

                        {/* CABEÇALHO GLOBAL DO LOTE */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-muted/20 rounded-2xl border border-border items-end">
                            {/* Loja (Fixo) */}
                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-[10px] uppercase font-black tracking-wider text-muted-foreground ml-1">Loja (Global)</label>
                                <select
                                    value={lojaId}
                                    onChange={e => setLojaId(e.target.value)}
                                    className="w-full bg-bg-dark text-text-primary border border-border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-primary-blue-light transition-all"
                                >
                                    <option value="">Selecione...</option>
                                    {lojasDisponiveis.map(loja => (
                                        <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Tipo (Fixo) */}
                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-[10px] uppercase font-black tracking-wider text-muted-foreground ml-1">Tipo de Movimento</label>
                                <div className="flex bg-background rounded-xl p-1 border border-border">
                                    <button
                                        type="button"
                                        onClick={() => setTipo('receita')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${tipo === 'receita' ? 'bg-[#1DB954] text-white' : 'text-muted-foreground hover:bg-muted/50'}`}
                                    >
                                        <TrendingUp size={14} /> Receita
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTipo('despesa')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${tipo === 'despesa' ? 'bg-red-500 text-white' : 'text-muted-foreground hover:bg-muted/50'}`}
                                    >
                                        <TrendingDown size={14} /> Despesa
                                    </button>
                                </div>
                            </div>

                            {/* Controle de Linhas (Batch Size) */}
                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-[10px] uppercase font-black tracking-wider text-muted-foreground ml-1">Quantidade de Registros</label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNumLinhas(Math.max(1, numLinhas - 1))}
                                        className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={numLinhas}
                                        onChange={(e) => setNumLinhas(parseInt(e.target.value) || 1)}
                                        className="flex-1 h-10 rounded-xl border border-border bg-bg-dark text-text-primary text-center font-black text-lg focus:outline-none focus:border-primary-blue-light"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setNumLinhas(Math.min(50, numLinhas + 1))}
                                        className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* GRID DE LANÇAMENTOS OU EMPTY STATE */}
                        <div className="space-y-3">
                            {numLinhas === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center bg-muted/5 border-2 border-dashed border-border rounded-2xl animate-in fade-in zoom-in-95 duration-500">
                                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
                                        <ListPlus size={32} />
                                    </div>
                                    <h3 className="text-lg font-black text-foreground mb-1">Pronto para iniciar?</h3>
                                    <p className="text-sm text-muted-foreground font-medium max-w-xs">
                                        Adicione a quantidade de registros acima e inicie os lançamentos históricos agora mesmo!
                                    </p>
                                </div>
                            ) : (
                                batchRows.map((row, index) => (
                                    <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-background/50 border border-dashed border-border rounded-xl hover:border-blue-500/30 transition-colors items-start animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>

                                        {/* Contador de Linha - Compactado */}
                                        <div className="md:col-span-1 flex items-center justify-start h-full pt-6">
                                            <span className="text-[10px] font-black text-muted-foreground/30 px-1 py-1 rounded-md">#{index + 1}</span>
                                        </div>

                                        {/* Data - Expandido para 4 colunas para não quebrar no período */}
                                        <div className="md:col-span-4 space-y-1">
                                            <div className="flex gap-1 mb-1">
                                                <button
                                                    type="button"
                                                    onClick={() => updateRow(row.id, 'modoData', row.modoData === 'unica' ? 'periodo' : 'unica')}
                                                    className="text-[9px] uppercase font-bold text-blue-400 hover:text-blue-300 ml-auto flex items-center gap-1"
                                                >
                                                    {row.modoData === 'unica' ? 'Add Período' : 'Remover Período'}
                                                </button>
                                            </div>
                                            <div className="flex gap-1">
                                                <input
                                                    type="date"
                                                    value={row.data}
                                                    data-row={index}
                                                    data-field="data"
                                                    onKeyDown={(e) => handleEnterNavigation(e, index, 'data')}
                                                    onChange={e => updateRow(row.id, 'data', e.target.value)}
                                                    className="w-full bg-bg-dark text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-primary-blue-light"
                                                />
                                                {row.modoData === 'periodo' && (
                                                    <input
                                                        type="date"
                                                        value={row.dataFim}
                                                        data-row={index}
                                                        data-field="dataFim"
                                                        onKeyDown={(e) => handleEnterNavigation(e, index, 'dataFim')}
                                                        onChange={e => updateRow(row.id, 'dataFim', e.target.value)}
                                                        className="w-full bg-bg-dark text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-primary-blue-light animate-in fade-in zoom-in-95 duration-200"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Categoria */}
                                        <div className={`md:col-span-3 space-y-1 ${index === 0 ? '' : 'pt-4'}`}>
                                            {index === 0 && (
                                                <div className="flex gap-1 mb-1">
                                                    <label className="text-[9px] uppercase font-bold text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1.5 ml-auto">
                                                        <input
                                                            type="checkbox"
                                                            checked={replicarCategoria}
                                                            onChange={(e) => toggleReplicar(e.target.checked)}
                                                            className="w-3 h-3 rounded bg-background border-border accent-blue-500"
                                                        />
                                                        Aplicar a todos?
                                                    </label>
                                                </div>
                                            )}
                                            <select
                                                value={row.categoriaId}
                                                data-row={index}
                                                data-field="categoriaId"
                                                onKeyDown={(e) => handleEnterNavigation(e, index, 'categoriaId')}
                                                onChange={e => updateRow(row.id, 'categoriaId', e.target.value)}
                                                className="w-full bg-bg-dark text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-primary-blue-light transition-colors"
                                            >
                                                <option value="">Categoria...</option>
                                                <optgroup label={`Deste Tipo (${tipo})`}>
                                                    {categorias.filter(c => c.tipo === tipo).map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.item}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Outros Tipos">
                                                    {categorias.filter(c => c.tipo !== tipo).map(cat => (
                                                        <option key={cat.id} value={cat.id} disabled className="bg-muted text-muted-foreground">{cat.item}</option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </div>

                                        {/* Valor */}
                                        <div className="md:col-span-2 space-y-1 pt-4">
                                            <MoneyInput
                                                value={row.valor}
                                                data-row={index}
                                                data-field="valor"
                                                onKeyDown={(e: any) => handleEnterNavigation(e, index, 'valor')}
                                                onValueChange={(val) => updateRow(row.id, 'valor', val)}
                                                className="w-full bg-bg-dark text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-primary-blue-light"
                                                placeholder="0,00"
                                                showCurrency={false}
                                            />
                                        </div>

                                        {/* Descrição - Reduzido para 2 colunas para equilibrar o grid */}
                                        <div className="md:col-span-2 space-y-1 pt-4">
                                            <input
                                                type="text"
                                                value={row.descricao}
                                                data-row={index}
                                                data-field="descricao"
                                                onKeyDown={(e) => handleEnterNavigation(e, index, 'descricao')}
                                                onChange={e => updateRow(row.id, 'descricao', e.target.value)}
                                                placeholder="Desc. Opcional"
                                                className="w-full bg-bg-dark text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-primary-blue-light"
                                            />
                                        </div>

                                    </div>
                                ))
                            )}
                        </div>

                        {numLinhas > 0 && (
                            <div className="flex items-center justify-between border-t border-border mt-4 pt-6 animate-in slide-in-from-bottom-2 duration-500">
                                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
                                    <ListPlus size={14} />
                                    Lançando {batchRows.length} registros em lote para <strong>{tipo.toUpperCase()}</strong>
                                </p>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-muted-foreground hover:text-red-500 hover:bg-red-500/5 transition-all active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        title="Atalho: F12"
                                        className="btn btn-primary px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 relative overflow-hidden"
                                    >
                                        {loading ? (
                                            progress ? (
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="animate-spin" size={16} />
                                                    <span>Salvando {progress.current}/{progress.total}</span>
                                                    {/* Barra de Progresso de Fundo */}
                                                    <div
                                                        className="absolute bottom-0 left-0 h-1 bg-white/50 transition-all duration-300"
                                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                                    />
                                                </div>
                                            ) : (
                                                <Loader2 className="animate-spin" size={16} />
                                            )
                                        ) : (
                                            <>
                                                <Save size={16} />
                                                <span className="ml-2">Registrar Tudo ({batchRows.length})</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                    </form>
                </div>

                {/* HISTÓRICO DA SESSÃO - MOVIDO PARA BAIXO */}
                <div className="bg-card border border-border rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <RotateCcw size={14} /> Histórico Recente (DB)
                        </h3>

                        {/* Filtro de Loja para o Histórico */}
                        <div className="flex items-center gap-2">
                            <Filter size={12} className="text-muted-foreground" />
                            <select
                                value={filtroLojaHistorico}
                                onChange={(e) => setFiltroLojaHistorico(e.target.value)}
                                className="bg-background border border-border rounded-lg px-2 py-1 text-[10px] font-bold text-foreground focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">Todas as Lojas</option>
                                {lojasDisponiveis.map(loja => (
                                    <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                ))}
                            </select>
                            <span className="text-[10px] font-bold bg-muted px-2 py-1 rounded-md text-muted-foreground">
                                {historico.length} regs
                            </span>
                        </div>
                    </div>
                    {historico.length > 0 && (
                        <button
                            onClick={() => setHistorico([])}
                            className="text-[10px] font-black uppercase text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                            <Trash2 size={12} /> Limpar Visualização
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* COLUNA DE RECEITAS */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-2 h-6 bg-[#1DB954] rounded-full" />
                            <h4 className="text-xs font-black uppercase tracking-widest text-[#1DB954]">Receitas Recentes</h4>
                        </div>

                        <div className="bg-background/50 border border-border rounded-2xl overflow-hidden">
                            <div className="max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/20">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-md border-b border-border">
                                        <tr className="bg-muted/30">
                                            <th className="px-3 py-2 text-[10px] font-black uppercase text-muted-foreground">Data</th>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase text-muted-foreground">Descrição / Categoria</th>
                                            <th className="px-3 py-2 text-right text-[10px] font-black uppercase text-muted-foreground">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historico.filter(h => h.tipo === 'receita').length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-3 py-8 text-center text-[10px] text-muted-foreground italic">Nenhuma receita encontrada</td>
                                            </tr>
                                        ) : (
                                            historico.filter(h => h.tipo === 'receita').map(item => (
                                                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                                    <td className="px-3 py-2.5 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                                                        {new Date(item.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <p className="text-[10px] font-bold text-foreground truncate max-w-[150px]" title={item.descricao}>{item.descricao}</p>
                                                        <p className="text-[9px] text-muted-foreground truncate">{item.item}</p>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-black text-xs text-[#1DB954]">
                                                        R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* COLUNA DE DESPESAS */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-2 h-6 bg-red-500 rounded-full" />
                            <h4 className="text-xs font-black uppercase tracking-widest text-red-500">Despesas Recentes</h4>
                        </div>

                        <div className="bg-background/50 border border-border rounded-2xl overflow-hidden">
                            <div className="max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/20">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-md border-b border-border">
                                        <tr className="bg-muted/30">
                                            <th className="px-3 py-2 text-[10px] font-black uppercase text-muted-foreground">Data</th>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase text-muted-foreground">Descrição / Categoria</th>
                                            <th className="px-3 py-2 text-right text-[10px] font-black uppercase text-muted-foreground">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historico.filter(h => h.tipo === 'despesa').length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-3 py-8 text-center text-[10px] text-muted-foreground italic">Nenhuma despesa encontrada</td>
                                            </tr>
                                        ) : (
                                            historico.filter(h => h.tipo === 'despesa').map(item => (
                                                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                                    <td className="px-3 py-2.5 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                                                        {new Date(item.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <p className="text-[10px] font-bold text-foreground truncate max-w-[150px]" title={item.descricao}>{item.descricao}</p>
                                                        <p className="text-[9px] text-muted-foreground truncate">{item.item}</p>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-black text-xs text-red-500">
                                                        R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {historico.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-border flex justify-between items-center opacity-70">
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Registros salvos em tempo real no banco de dados</p>
                        <div className="flex gap-4">
                            <div className="text-right">
                                <p className="text-[8px] text-muted-foreground uppercase font-bold">Total Receitas</p>
                                <p className="text-sm font-black text-[#1DB954]">R$ {historico.filter(h => h.tipo === 'receita').reduce((acc, curr) => acc + curr.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] text-muted-foreground uppercase font-bold">Total Despesas</p>
                                <p className="text-sm font-black text-red-500">R$ {historico.filter(h => h.tipo === 'despesa').reduce((acc, curr) => acc + curr.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Dicas de Atalho */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-black text-xs text-foreground">TAB</div>
                    <p className="text-[10px] font-medium text-muted-foreground">Navegar entre colunas</p>
                </div>
                <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                    <div className="w-24 h-8 rounded-lg bg-muted flex items-center justify-center font-black text-xs text-foreground">F12</div>
                    <p className="text-[10px] font-medium text-muted-foreground">Registrar Lote</p>
                </div>
                <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                    <div className="w-24 h-8 rounded-lg bg-muted flex items-center justify-center font-black text-xs text-foreground">ENTER</div>
                    <p className="text-[10px] font-medium text-muted-foreground">Pular para o próximo campo/linha</p>
                </div>
            </div>
        </div >
    );
}

// Import necessário para o ícone customizado se não existir
