'use client';

import { useState, useRef, useCallback } from 'react';
import {
    X,
    Upload,
    FileText,
    AlertCircle,
    CheckCircle2,
    Loader2,
    TrendingUp,
    TrendingDown,
    ChevronDown,
    Info
} from 'lucide-react';
import { parseOFX, OFXTransacao, OFXDados } from '@/lib/ofx-parser';
import { ItemFinanceiro } from '@/hooks/useItensFinanceiros';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    categorias: ItemFinanceiro[];
    lojaId: string | null;
    onSuccess: () => void;
}

interface LinhaImportacao extends OFXTransacao {
    selecionada: boolean;
    categoriaId: number | null;
    detalhe: string;
}

type Etapa = 'upload' | 'preview' | 'importando' | 'concluido';

export function ModalImportacaoOFX({ isOpen, onClose, categorias, lojaId, onSuccess }: Props) {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const [etapa, setEtapa] = useState<Etapa>('upload');
    const [ofxDados, setOfxDados] = useState<OFXDados | null>(null);
    const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);
    const [erroArquivo, setErroArquivo] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [resultadoImportacao, setResultadoImportacao] = useState<{ importados: number; ignorados: number } | null>(null);
    const [abaFiltro, setAbaFiltro] = useState<'todas' | 'credito' | 'debito'>('todas');

    const categoriasPai = categorias.filter(c => !c.parent_id);
    const categoriasPaiReceita = categoriasPai.filter(c => c.tipo === 'receita');
    const categoriasPaiDespesa = categoriasPai.filter(c => c.tipo === 'despesa');

    const processarArquivo = useCallback((file: File) => {
        setErroArquivo(null);
        if (!file.name.toLowerCase().endsWith('.ofx') && !file.name.toLowerCase().endsWith('.qfx')) {
            setErroArquivo('Arquivo inválido. Selecione um arquivo .OFX ou .QFX.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const dados = parseOFX(content);

                if (dados.transacoes.length === 0) {
                    setErroArquivo('Nenhuma transação encontrada no arquivo.');
                    return;
                }

                setOfxDados(dados);
                setLinhas(
                    dados.transacoes.map((t) => ({
                        ...t,
                        selecionada: true,
                        categoriaId: null,
                        detalhe: t.memo
                    }))
                );
                setEtapa('preview');
            } catch {
                setErroArquivo('Erro ao processar o arquivo OFX. Verifique se o arquivo é válido.');
            }
        };
        reader.readAsText(file, 'ISO-8859-1');
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processarArquivo(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processarArquivo(file);
    };

    const toggleLinha = (idx: number) => {
        setLinhas(prev => prev.map((l, i) => i === idx ? { ...l, selecionada: !l.selecionada } : l));
    };

    const toggleTodas = (selecionada: boolean) => {
        setLinhas(prev => prev.map(l => ({ ...l, selecionada })));
    };

    const setCategoriaLinha = (idx: number, catId: number | null) => {
        setLinhas(prev => prev.map((l, i) => i === idx ? { ...l, categoriaId: catId } : l));
    };

    const setDetalheLinha = (idx: number, detalhe: string) => {
        setLinhas(prev => prev.map((l, i) => i === idx ? { ...l, detalhe } : l));
    };

    const setCategoriaEmMassa = (tipo: 'CREDIT' | 'DEBIT', catId: number | null) => {
        setLinhas(prev => prev.map(l => l.tipo === tipo ? { ...l, categoriaId: catId } : l));
    };

    const linhasFiltradas = linhas.filter(l => {
        if (abaFiltro === 'credito') return l.tipo === 'CREDIT';
        if (abaFiltro === 'debito') return l.tipo === 'DEBIT';
        return true;
    });

    const selecionadas = linhas.filter(l => l.selecionada);
    const totalCreditos = selecionadas.filter(l => l.tipo === 'CREDIT').reduce((s, l) => s + l.valor, 0);
    const totalDebitos = selecionadas.filter(l => l.tipo === 'DEBIT').reduce((s, l) => s + l.valor, 0);

    const handleImportar = async () => {
        if (!lojaId) {
            toast({ message: 'Selecione uma filial antes de importar.', type: 'error' });
            return;
        }
        const paraImportar = linhas.filter(l => l.selecionada);
        if (paraImportar.length === 0) {
            toast({ message: 'Selecione ao menos uma transação.', type: 'warning' });
            return;
        }

        setEtapa('importando');

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const payloads = paraImportar.map(l => {
                const tipo = l.tipo === 'CREDIT' ? 'receita' : 'despesa';
                const cat = l.categoriaId ? categorias.find(c => c.id === l.categoriaId) : null;

                return {
                    tipo,
                    descricao: l.detalhe || l.memo || 'Importado OFX',
                    valor: l.valor,
                    item: l.detalhe || l.memo || 'Importado OFX',
                    data_vencimento: l.data,
                    data_pagamento: l.data,
                    status: 'pago',
                    recorrente: false,
                    frequencia: null,
                    loja_id: lojaId,
                    item_financeiro_id: l.categoriaId || null,
                    metodo_pagamento: 'outros',
                    usuario_id: user?.id || null
                };
            });

            const { error } = await supabase.from('financeiro_contas').insert(payloads);

            if (error) throw new Error(error.message);

            setResultadoImportacao({ importados: payloads.length, ignorados: linhas.length - paraImportar.length });
            setEtapa('concluido');
        } catch (err: any) {
            toast({ message: 'Erro ao importar: ' + (err.message || 'Tente novamente.'), type: 'error' });
            setEtapa('preview');
        }
    };

    const handleFechar = () => {
        if (etapa === 'concluido') onSuccess();
        setEtapa('upload');
        setOfxDados(null);
        setLinhas([]);
        setErroArquivo(null);
        setResultadoImportacao(null);
        setAbaFiltro('todas');
        onClose();
    };

    const formatarData = (d: string) => {
        if (!d) return '-';
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    };

    const formatarMoeda = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (!isOpen) return null;

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={(e) => { if (e.target === e.currentTarget && etapa !== 'importando') handleFechar(); }}
        >
            <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                            <FileText size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold">Importar Extrato OFX</h3>
                            <p className="text-xs text-muted">
                                {etapa === 'upload' && 'Selecione o arquivo exportado pelo seu banco'}
                                {etapa === 'preview' && `${linhas.length} transações encontradas — revise e confirme`}
                                {etapa === 'importando' && 'Importando transações...'}
                                {etapa === 'concluido' && 'Importação concluída'}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleFechar} disabled={etapa === 'importando'} className="text-muted hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="overflow-y-auto flex-1 px-6 py-5">

                    {/* ETAPA: Upload */}
                    {etapa === 'upload' && (
                        <div className="flex flex-col gap-5">
                            <div
                                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${dragging ? 'border-blue-400 bg-blue-500/10' : 'border-white/15 hover:border-white/30 hover:bg-white/3'}`}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => inputRef.current?.click()}
                            >
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${dragging ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                                    <Upload size={28} className={dragging ? 'text-blue-400' : 'text-muted'} />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold">Arraste o arquivo ou clique para selecionar</p>
                                    <p className="text-xs text-muted mt-1">Formatos aceitos: .OFX, .QFX</p>
                                </div>
                                <input ref={inputRef} type="file" accept=".ofx,.qfx" className="hidden" onChange={handleFileInput} />
                            </div>

                            {erroArquivo && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    <AlertCircle size={16} className="shrink-0" />
                                    {erroArquivo}
                                </div>
                            )}

                            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/8 border border-blue-500/15 text-xs text-blue-300">
                                <Info size={14} className="mt-0.5 shrink-0" />
                                <span>O arquivo OFX é gerado pelo internet banking do seu banco. Procure por "exportar extrato" ou "baixar extrato" no site do banco.</span>
                            </div>
                        </div>
                    )}

                    {/* ETAPA: Preview */}
                    {etapa === 'preview' && ofxDados && (
                        <div className="flex flex-col gap-4">
                            {/* Info do arquivo */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-muted">Banco</p>
                                    <p className="font-bold mt-1">{ofxDados.bankid || '-'}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-muted">Conta</p>
                                    <p className="font-bold mt-1">{ofxDados.acctid || '-'}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-muted">Período</p>
                                    <p className="font-bold mt-1">{formatarData(ofxDados.dtstart)} – {formatarData(ofxDados.dtend)}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-muted">Saldo Final</p>
                                    <p className="font-bold mt-1 text-blue-300">{formatarMoeda(ofxDados.saldoFinal)}</p>
                                </div>
                            </div>

                            {/* Categorização em massa */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/3 rounded-xl border border-white/8">
                                <div>
                                    <label className="text-[10px] font-bold text-emerald-400 uppercase mb-1 flex items-center gap-1"><TrendingUp size={10} /> Categoria padrão para Entradas (créditos)</label>
                                    <div className="relative">
                                        <select
                                            className="input w-full text-xs pr-8"
                                            onChange={e => setCategoriaEmMassa('CREDIT', e.target.value ? Number(e.target.value) : null)}
                                        >
                                            <option value="">Sem categoria padrão</option>
                                            {categoriasPaiReceita.map(c => <option key={c.id} value={c.id}>{c.item}</option>)}
                                        </select>
                                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-red-400 uppercase mb-1 flex items-center gap-1"><TrendingDown size={10} /> Categoria padrão para Saídas (débitos)</label>
                                    <div className="relative">
                                        <select
                                            className="input w-full text-xs pr-8"
                                            onChange={e => setCategoriaEmMassa('DEBIT', e.target.value ? Number(e.target.value) : null)}
                                        >
                                            <option value="">Sem categoria padrão</option>
                                            {categoriasPaiDespesa.map(c => <option key={c.id} value={c.id}>{c.item}</option>)}
                                        </select>
                                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Resumo selecionados */}
                            <div className="flex items-center gap-4 text-xs flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={linhas.every(l => l.selecionada)}
                                        onChange={e => toggleTodas(e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-muted">Selecionar todas ({linhas.length})</span>
                                </label>
                                <span className="text-muted">|</span>
                                <span className="text-emerald-400 font-bold">
                                    Créditos: {formatarMoeda(totalCreditos)}
                                </span>
                                <span className="text-red-400 font-bold">
                                    Débitos: {formatarMoeda(totalDebitos)}
                                </span>
                                <span className="text-muted ml-auto">{selecionadas.length} selecionada(s)</span>
                            </div>

                            {/* Filtro por tipo */}
                            <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
                                {([
                                    { key: 'todas', label: 'Todas' },
                                    { key: 'credito', label: 'Entradas' },
                                    { key: 'debito', label: 'Saídas' }
                                ] as const).map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setAbaFiltro(tab.key)}
                                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${abaFiltro === tab.key ? 'bg-bg-card text-white shadow' : 'text-muted hover:text-white'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tabela de transações */}
                            <div className="overflow-x-auto rounded-xl border border-white/8">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-white/8 bg-white/3">
                                            <th className="py-2 px-3 text-left w-8"></th>
                                            <th className="py-2 px-3 text-left font-bold text-muted uppercase">Data</th>
                                            <th className="py-2 px-3 text-left font-bold text-muted uppercase">Descrição</th>
                                            <th className="py-2 px-3 text-left font-bold text-muted uppercase">Detalhe (editável)</th>
                                            <th className="py-2 px-3 text-left font-bold text-muted uppercase min-w-[160px]">Categoria</th>
                                            <th className="py-2 px-3 text-right font-bold text-muted uppercase">Valor</th>
                                            <th className="py-2 px-3 text-center font-bold text-muted uppercase">Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {linhasFiltradas.map((l, i) => {
                                            const idxGlobal = linhas.findIndex(x => x === l);
                                            const isCredit = l.tipo === 'CREDIT';
                                            const catOpts = isCredit ? categoriasPaiReceita : categoriasPaiDespesa;
                                            return (
                                                <tr
                                                    key={`${l.data}-${l.fitid}-${i}`}
                                                    className={`border-b border-white/5 transition-colors ${l.selecionada ? 'bg-white/2 hover:bg-white/4' : 'opacity-40 hover:opacity-60'}`}
                                                >
                                                    <td className="py-2 px-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={l.selecionada}
                                                            onChange={() => toggleLinha(idxGlobal)}
                                                            className="rounded"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-muted">{formatarData(l.data)}</td>
                                                    <td className="py-2 px-3 max-w-[140px] truncate" title={l.memo}>{l.memo}</td>
                                                    <td className="py-2 px-3 min-w-[140px]">
                                                        <input
                                                            type="text"
                                                            value={l.detalhe}
                                                            onChange={e => setDetalheLinha(idxGlobal, e.target.value)}
                                                            className="input text-xs py-1 px-2 w-full"
                                                            placeholder="Detalhe..."
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3 min-w-[160px]">
                                                        <select
                                                            value={l.categoriaId ?? ''}
                                                            onChange={e => setCategoriaLinha(idxGlobal, e.target.value ? Number(e.target.value) : null)}
                                                            className="input text-xs py-1 px-2 w-full"
                                                        >
                                                            <option value="">Sem categoria</option>
                                                            {catOpts.map(c => <option key={c.id} value={c.id}>{c.item}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className={`py-2 px-3 text-right font-bold font-mono ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {isCredit ? '+' : '-'}{formatarMoeda(l.valor)}
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isCredit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                                            {isCredit ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                            {isCredit ? 'Entrada' : 'Saída'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ETAPA: Importando */}
                    {etapa === 'importando' && (
                        <div className="flex flex-col items-center justify-center gap-4 py-16">
                            <Loader2 size={48} className="animate-spin text-blue-400" />
                            <p className="font-semibold text-lg">Importando transações...</p>
                            <p className="text-muted text-sm">Aguarde enquanto os dados são salvos.</p>
                        </div>
                    )}

                    {/* ETAPA: Concluído */}
                    {etapa === 'concluido' && resultadoImportacao && (
                        <div className="flex flex-col items-center justify-center gap-6 py-12">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 size={44} className="text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-xl mb-2">Importação concluída!</p>
                                <p className="text-muted text-sm">
                                    <span className="text-emerald-400 font-bold">{resultadoImportacao.importados}</span> transação(ões) importada(s)
                                    {resultadoImportacao.ignorados > 0 && (
                                        <> · <span className="text-muted">{resultadoImportacao.ignorados} ignorada(s)</span></>
                                    )}
                                </p>
                            </div>
                            <button className="btn btn-primary px-8" onClick={handleFechar}>
                                Fechar e Atualizar
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(etapa === 'upload' || etapa === 'preview') && (
                    <div className="flex justify-between items-center px-6 py-4 border-t border-white/10 gap-3">
                        <button className="btn btn-ghost" onClick={handleFechar}>Cancelar</button>
                        {etapa === 'preview' && (
                            <button
                                className="btn btn-primary px-6"
                                onClick={handleImportar}
                                disabled={selecionadas.length === 0 || !lojaId}
                            >
                                <Upload size={15} />
                                Importar {selecionadas.length} transação(ões)
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
