'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Brain, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, X, ChevronDown, ChevronRight, FileImage, Loader as Loader2, Trash2, ChartBar as BarChart3, DollarSign, Receipt, Banknote, TrendingUp, TrendingDown, Eye, RefreshCcw, Save, Calendar, Hash } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useLoja } from '@/contexts/LojaContext';
import { useToast } from '@/contexts/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Jogo {
    nome: string;
    quantidade: number;
    valor: number;
}

interface Servico {
    tipo: string;
    quantidade: number;
    valor: number;
}

interface Cedula {
    valor: number;
    quantidade: number;
}

interface Deposito {
    matricula: string;
    nome: string;
    totalDepositado: number;
}

interface Concurso {
    jogo: string;
    concurso: string;
    quantidade: number;
    valorCota: number;
    custoCota: number;
    meioPagamento: string;
}

interface Conta {
    descricao: string;
    valor: number;
}

type TipoDocumento =
    | 'RESUMO_DO_DIA'
    | 'TERMINAL_DEPOSITARIO'
    | 'LISTA_DEPOSITOS'
    | 'ACERTO_COTAS_DIGITAIS'
    | 'DESCONHECIDO';

interface FichaAnalisada {
    tipoDocumento: TipoDocumento;
    data: string | null;
    terminal: string | null;
    // RESUMO_DO_DIA
    jogos?: Jogo[];
    totalJogos?: number | null;
    contas?: Conta[];
    totalContas?: number | null;
    premiosPagos?: number | null;
    quantidadePremios?: number | null;
    servicos?: Servico[];
    totalEmCaixa?: number | null;
    // TERMINAL_DEPOSITARIO
    valorGeral?: number | null;
    valorCedulas?: number | null;
    valorEnvelopes?: number | null;
    cedulas?: Cedula[];
    // LISTA_DEPOSITOS
    depositos?: Deposito[];
    totalGeral?: number | null;
    dataInicio?: string | null;
    dataFim?: string | null;
    // ACERTO_COTAS_DIGITAIS
    concursos?: Concurso[];
    totalCreditos?: number | null;
    totalDebitos?: number | null;
}

type StatusArquivo = 'aguardando' | 'processando' | 'concluido' | 'erro';

interface ArquivoUpload {
    id: string;
    file: File;
    preview: string;
    status: StatusArquivo;
    resultado: FichaAnalisada | null;
    erro: string | null;
    savedId: string | null;
    expandido: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function labelTipo(tipo: TipoDocumento): string {
    const labels: Record<TipoDocumento, string> = {
        RESUMO_DO_DIA: 'Resumo do Dia',
        TERMINAL_DEPOSITARIO: 'Terminal Depositário',
        LISTA_DEPOSITOS: 'Lista Geral de Depósitos',
        ACERTO_COTAS_DIGITAIS: 'Acerto Vendas Cotas Digitais',
        DESCONHECIDO: 'Documento Desconhecido',
    };
    return labels[tipo] ?? tipo;
}

function colorTipo(tipo: TipoDocumento): string {
    const colors: Record<TipoDocumento, string> = {
        RESUMO_DO_DIA: 'var(--primary-blue)',
        TERMINAL_DEPOSITARIO: 'var(--color-success)',
        LISTA_DEPOSITOS: 'var(--color-warning)',
        ACERTO_COTAS_DIGITAIS: '#0891b2',
        DESCONHECIDO: 'var(--text-muted)',
    };
    return colors[tipo] ?? 'var(--color-muted)';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BadgeTipo({ tipo }: { tipo: TipoDocumento }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
                background: colorTipo(tipo) + '33',
                color: colorTipo(tipo),
                border: `1px solid ${colorTipo(tipo)}40`,
            }}
        >
            {labelTipo(tipo)}
        </span>
    );
}

function ResumoDodia({ dados }: { dados: FichaAnalisada }) {
    return (
        <div className="space-y-4">
            {/* KPIs topo */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiMini label="Total Jogos" valor={fmt(dados.totalJogos)} icon={<BarChart3 size={14} />} cor="var(--primary-blue)" />
                <KpiMini label="Total Contas" valor={fmt(dados.totalContas)} icon={<Receipt size={14} />} cor="var(--color-warning)" />
                <KpiMini label="Prêmios Pagos" valor={fmt(dados.premiosPagos)} icon={<TrendingDown size={14} />} cor="var(--color-danger)" />
                <KpiMini label="Total em Caixa" valor={fmt(dados.totalEmCaixa)} icon={<Banknote size={14} />} cor="var(--color-success)" />
            </div>

            {/* Jogos */}
            {dados.jogos && dados.jogos.length > 0 && (
                <Section titulo="Jogos / Recebimentos">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-xs">
                                <th className="text-left pb-1 font-medium">Jogo</th>
                                <th className="text-right pb-1 font-medium">Qtde</th>
                                <th className="text-right pb-1 font-medium">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.jogos.map((j, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1 text-text-primary">{j.nome}</td>
                                    <td className="py-1 text-right text-text-secondary tabular-nums">{j.quantidade}</td>
                                    <td className="py-1 text-right text-text-primary font-medium tabular-nums">{fmt(j.valor)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Section>
            )}

            {/* Contas */}
            {dados.contas && dados.contas.length > 0 && (
                <Section titulo="Contas (NPC / Pré-Pago / etc.)">
                    {dados.contas.map((c, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0 text-sm">
                            <span className="text-text-secondary">{c.descricao}</span>
                            <span className="font-medium text-text-primary tabular-nums">{fmt(c.valor)}</span>
                        </div>
                    ))}
                </Section>
            )}

            {/* Serviços */}
            {dados.servicos && dados.servicos.length > 0 && (
                <Section titulo="Serviços (Depósito / Saque / PIX)">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-xs">
                                <th className="text-left pb-1 font-medium">Tipo</th>
                                <th className="text-right pb-1 font-medium">Qtde</th>
                                <th className="text-right pb-1 font-medium">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.servicos.map((s, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1 text-text-primary">{s.tipo}</td>
                                    <td className="py-1 text-right text-text-secondary tabular-nums">{s.quantidade}</td>
                                    <td className="py-1 text-right text-text-primary font-medium tabular-nums">{fmt(s.valor)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Section>
            )}
        </div>
    );
}

function TerminalDepositario({ dados }: { dados: FichaAnalisada }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <KpiMini label="Valor Geral" valor={fmt(dados.valorGeral)} icon={<DollarSign size={14} />} cor="var(--primary-blue)" />
                <KpiMini label="Cédulas" valor={fmt(dados.valorCedulas)} icon={<Banknote size={14} />} cor="var(--color-success)" />
                <KpiMini label="Envelopes" valor={fmt(dados.valorEnvelopes)} icon={<Receipt size={14} />} cor="var(--color-warning)" />
            </div>
            {dados.cedulas && dados.cedulas.length > 0 && (
                <Section titulo="Relação de Cédulas">
                    {dados.cedulas.map((c, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0 text-sm">
                            <span className="text-text-secondary">{fmt(c.valor)}</span>
                            <span className="font-medium text-text-primary tabular-nums">{c.quantidade}x</span>
                        </div>
                    ))}
                </Section>
            )}
        </div>
    );
}

function ListaDepositos({ dados }: { dados: FichaAnalisada }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <KpiMini label="Total Geral" valor={fmt(dados.totalGeral)} icon={<DollarSign size={14} />} cor="var(--primary-blue)" />
                <KpiMini label="Período" valor={dados.dataInicio && dados.dataFim ? `${dados.dataInicio} – ${dados.dataFim}` : '—'} icon={<Calendar size={14} />} cor="var(--text-muted)" />
            </div>
            {dados.depositos && dados.depositos.length > 0 && (
                <Section titulo="Depósitos por Atendente">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-xs">
                                <th className="text-left pb-1 font-medium">Matrícula</th>
                                <th className="text-left pb-1 font-medium">Nome</th>
                                <th className="text-right pb-1 font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.depositos.map((d, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="py-1 text-text-muted tabular-nums">{d.matricula}</td>
                                    <td className="py-1 text-text-primary">{d.nome}</td>
                                    <td className="py-1 text-right font-medium text-text-primary tabular-nums">{fmt(d.totalDepositado)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Section>
            )}
        </div>
    );
}

function AcertoCotasDigitais({ dados }: { dados: FichaAnalisada }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <KpiMini label="Total Créditos" valor={fmt(dados.totalCreditos)} icon={<TrendingUp size={14} />} cor="var(--color-success)" />
                <KpiMini label="Total Débitos" valor={fmt(dados.totalDebitos)} icon={<TrendingDown size={14} />} cor="var(--color-danger)" />
            </div>
            {dados.concursos && dados.concursos.length > 0 && (
                <Section titulo="Concursos">
                    <div className="space-y-2">
                        {dados.concursos.map((c, i) => (
                            <div key={i} className="rounded-lg border border-border p-3 bg-bg-secondary/40 text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-text-primary">{c.jogo} #{c.concurso}</span>
                                    <span className="text-text-muted">{c.meioPagamento}</span>
                                </div>
                                <div className="flex gap-4 text-text-secondary">
                                    <span>Qtde: {c.quantidade}</span>
                                    <span>Cota: {fmt(c.valorCota)}</span>
                                    <span>Custo: {fmt(c.custoCota)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{titulo}</p>
            {children}
        </div>
    );
}

function KpiMini({ label, valor, icon, cor }: { label: string; valor: string; icon: React.ReactNode; cor: string }) {
    return (
        <div className="rounded-xl border border-border p-3 bg-bg-card">
            <div className="flex items-center gap-1.5 mb-1" style={{ color: cor }}>
                {icon}
                <span className="text-xs text-text-muted">{label}</span>
            </div>
            <p className="text-sm font-bold text-text-primary tabular-nums truncate">{valor}</p>
        </div>
    );
}

function ResultadoFicha({ dados }: { dados: FichaAnalisada }) {
    switch (dados.tipoDocumento) {
        case 'RESUMO_DO_DIA': return <ResumoDodia dados={dados} />;
        case 'TERMINAL_DEPOSITARIO': return <TerminalDepositario dados={dados} />;
        case 'LISTA_DEPOSITOS': return <ListaDepositos dados={dados} />;
        case 'ACERTO_COTAS_DIGITAIS': return <AcertoCotasDigitais dados={dados} />;
        default: return <p className="text-sm text-text-muted">Tipo de documento não reconhecido.</p>;
    }
}

// ─── Card de arquivo ─────────────────────────────────────────────────────────

function CardArquivo({
    item,
    onRemove,
    onToggle,
    onSave,
}: {
    item: ArquivoUpload;
    onRemove: (id: string) => void;
    onToggle: (id: string) => void;
    onSave: (id: string) => void;
}) {
    return (
        <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-3">
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-border bg-bg-secondary">
                    <img src={item.preview} alt="ficha" className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        {item.status === 'aguardando' && (
                            <span className="text-xs text-text-muted flex items-center gap-1">
                                <FileImage size={11} /> Aguardando análise
                            </span>
                        )}
                        {item.status === 'processando' && (
                            <span className="text-xs text-blue-500 flex items-center gap-1">
                                <Loader2 size={11} className="animate-spin" /> Analisando com IA...
                            </span>
                        )}
                        {item.status === 'concluido' && item.resultado && (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={12} className="text-green-500" />
                                <BadgeTipo tipo={item.resultado.tipoDocumento} />
                                {item.resultado.data && (
                                    <span className="text-xs text-text-muted">{item.resultado.data}</span>
                                )}
                                {item.resultado.terminal && (
                                    <span className="text-xs text-text-muted flex items-center gap-0.5">
                                        <Hash size={10} />{item.resultado.terminal}
                                    </span>
                                )}
                            </div>
                        )}
                        {item.status === 'erro' && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle size={11} /> {item.erro}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    {item.status === 'concluido' && !item.savedId && (
                        <button
                            onClick={() => onSave(item.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-green-500 hover:bg-green-500/10 transition-colors"
                            title="Salvar no banco de dados"
                        >
                            <Save size={15} />
                        </button>
                    )}
                    {item.status === 'concluido' && item.savedId && (
                        <span className="p-1.5 text-green-500" title="Salvo">
                            <CheckCircle2 size={15} />
                        </span>
                    )}
                    {item.status === 'concluido' && (
                        <button
                            onClick={() => onToggle(item.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
                            title="Expandir detalhes"
                        >
                            {item.expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                    )}
                    <button
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remover"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* Expanded result */}
            {item.expandido && item.resultado && (
                <div className="border-t border-border p-4">
                    <ResultadoFicha dados={item.resultado} />
                </div>
            )}
        </div>
    );
}

// ─── Histórico ────────────────────────────────────────────────────────────────

interface RegistroHistorico {
    id: string;
    tipo_documento: TipoDocumento;
    data_documento: string | null;
    terminal: string | null;
    dados_extraidos: FichaAnalisada;
    created_at: string;
}

function Historico({ registros, onDelete }: { registros: RegistroHistorico[]; onDelete: (id: string) => void }) {
    const [expandido, setExpandido] = useState<string | null>(null);

    if (registros.length === 0) {
        return (
            <div className="text-center py-10 text-text-muted">
                <Eye size={32} strokeWidth={1.2} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum registro encontrado.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {registros.map(r => (
                <div key={r.id} className="rounded-xl border border-border bg-bg-card overflow-hidden">
                    <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-bg-secondary/40 transition-colors"
                        onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                    >
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                            <BadgeTipo tipo={r.tipo_documento} />
                            {r.data_documento && (
                                <span className="text-xs text-text-muted flex items-center gap-0.5">
                                    <Calendar size={10} />
                                    {new Date(r.data_documento).toLocaleDateString('pt-BR')}
                                </span>
                            )}
                            {r.terminal && (
                                <span className="text-xs text-text-muted flex items-center gap-0.5">
                                    <Hash size={10} />{r.terminal}
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-text-muted flex-shrink-0">
                            {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                            className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
                        >
                            <Trash2 size={13} />
                        </button>
                        {expandido === r.id ? <ChevronDown size={14} className="text-text-muted flex-shrink-0" /> : <ChevronRight size={14} className="text-text-muted flex-shrink-0" />}
                    </div>
                    {expandido === r.id && (
                        <div className="border-t border-border p-4">
                            <ResultadoFicha dados={r.dados_extraidos} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FechamentoCaixaAutomatizado() {
    const supabase = createBrowserSupabaseClient();
    const { lojaAtual } = useLoja();
    const { toast } = useToast();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
    const [processandoTodos, setProcessandoTodos] = useState(false);
    const [aba, setAba] = useState<'upload' | 'historico'>('upload');
    const [historico, setHistorico] = useState<RegistroHistorico[]>([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);

    // ── Drag & drop ────────────────────────────────────────────────────────────
    const [dragging, setDragging] = useState(false);

    const addFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const novos: ArquivoUpload[] = Array.from(files)
            .filter(f => f.type.startsWith('image/'))
            .map(f => ({
                id: crypto.randomUUID(),
                file: f,
                preview: URL.createObjectURL(f),
                status: 'aguardando',
                resultado: null,
                erro: null,
                savedId: null,
                expandido: false,
            }));
        setArquivos(prev => [...prev, ...novos]);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
    }, [addFiles]);

    // ── Processar um arquivo ───────────────────────────────────────────────────
    const processarArquivo = useCallback(async (id: string) => {
        setArquivos(prev => prev.map(a => a.id === id ? { ...a, status: 'processando' } : a));

        const item = arquivos.find(a => a.id === id);
        if (!item) return;

        try {
            const formData = new FormData();
            formData.append('file', item.file);

            const res = await fetch('/api/financeiro/analise-ficha', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? 'Erro na API');
            }

            const resultado: FichaAnalisada = await res.json();
            setArquivos(prev => prev.map(a =>
                a.id === id ? { ...a, status: 'concluido', resultado, expandido: true } : a
            ));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            setArquivos(prev => prev.map(a =>
                a.id === id ? { ...a, status: 'erro', erro: msg } : a
            ));
        }
    }, [arquivos]);

    // ── Processar todos pendentes ──────────────────────────────────────────────
    const processarTodos = useCallback(async () => {
        setProcessandoTodos(true);
        const pendentes = arquivos.filter(a => a.status === 'aguardando');
        for (const item of pendentes) {
            await processarArquivo(item.id);
        }
        setProcessandoTodos(false);
    }, [arquivos, processarArquivo]);

    // ── Salvar no banco ────────────────────────────────────────────────────────
    const salvarRegistro = useCallback(async (id: string) => {
        const item = arquivos.find(a => a.id === id);
        if (!item?.resultado) return;

        const { data: userData } = await supabase.auth.getUser();
        const dados = item.resultado;

        let dataDoc: string | null = null;
        if (dados.data) {
            const [dd, mm, yyyy] = dados.data.split('/');
            if (dd && mm && yyyy) dataDoc = `${yyyy}-${mm}-${dd}`;
        }

        const { data, error } = await supabase
            .from('fechamento_caixa_ia')
            .insert({
                loja_id: lojaAtual?.id ?? null,
                user_id: userData?.user?.id ?? null,
                tipo_documento: dados.tipoDocumento,
                data_documento: dataDoc,
                terminal: dados.terminal,
                dados_extraidos: dados,
                status_processamento: 'processado',
            })
            .select('id')
            .single();

        if (error) {
            toast({ message: 'Erro ao salvar: ' + error.message, type: 'error' });
            return;
        }

        setArquivos(prev => prev.map(a =>
            a.id === id ? { ...a, savedId: data.id } : a
        ));
        toast({ message: 'Registro salvo com sucesso!', type: 'success' });
    }, [arquivos, supabase, lojaAtual, toast]);

    // ── Carregar histórico ─────────────────────────────────────────────────────
    const carregarHistorico = useCallback(async () => {
        setCarregandoHistorico(true);
        const { data, error } = await supabase
            .from('fechamento_caixa_ia')
            .select('id, tipo_documento, data_documento, terminal, dados_extraidos, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            toast({ message: 'Erro ao carregar histórico: ' + error.message, type: 'error' });
        } else {
            setHistorico((data ?? []) as RegistroHistorico[]);
        }
        setCarregandoHistorico(false);
    }, [supabase, toast]);

    const excluirRegistro = useCallback(async (id: string) => {
        const { error } = await supabase.from('fechamento_caixa_ia').delete().eq('id', id);
        if (error) {
            toast({ message: 'Erro ao excluir: ' + error.message, type: 'error' });
            return;
        }
        setHistorico(prev => prev.filter(r => r.id !== id));
        toast({ message: 'Registro excluído.', type: 'success' });
    }, [supabase, toast]);

    const mudarAba = (nova: 'upload' | 'historico') => {
        setAba(nova);
        if (nova === 'historico') carregarHistorico();
    };

    const pendentes = arquivos.filter(a => a.status === 'aguardando').length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Fechamento de Caixa Automatizado"
                description="Analise fichas impressas dos terminais com inteligência artificial"
            />

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {[
                    { id: 'upload' as const, label: 'Análise de Fichas' },
                    { id: 'historico' as const, label: 'Histórico' },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => mudarAba(t.id)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            aba === t.id
                                ? 'border-primary-blue-light text-primary-blue-light'
                                : 'border-transparent text-text-muted hover:text-text-primary'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Upload Tab ── */}
            {aba === 'upload' && (
                <div className="space-y-4">
                    {/* Drop zone */}
                    <div
                        className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
                            dragging
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50 hover:bg-bg-secondary/40'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={e => addFiles(e.target.files)}
                        />
                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-text-muted select-none">
                            <div className="w-14 h-14 rounded-2xl bg-bg-secondary flex items-center justify-center">
                                <Upload size={24} strokeWidth={1.5} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-text-primary">Arraste fotos das fichas aqui</p>
                                <p className="text-xs mt-0.5">ou clique para selecionar — JPG, PNG, WEBP</p>
                            </div>
                        </div>
                    </div>

                    {/* Action bar */}
                    {arquivos.length > 0 && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-text-muted">
                                {arquivos.length} arquivo{arquivos.length !== 1 ? 's' : ''} •{' '}
                                {pendentes} aguardando
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setArquivos([])}
                                    className="btn-ghost text-xs flex items-center gap-1.5"
                                >
                                    <Trash2 size={13} /> Limpar tudo
                                </button>
                                <button
                                    onClick={processarTodos}
                                    disabled={pendentes === 0 || processandoTodos}
                                    className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {processandoTodos
                                        ? <><Loader2 size={13} className="animate-spin" /> Processando...</>
                                        : <><Brain size={13} /> Analisar {pendentes > 0 ? `(${pendentes})` : 'todos'}</>
                                    }
                                </button>
                            </div>
                        </div>
                    )}

                    {/* File list */}
                    <div className="space-y-3">
                        {arquivos.map(item => (
                            <CardArquivo
                                key={item.id}
                                item={item}
                                onRemove={(id) => setArquivos(prev => prev.filter(a => a.id !== id))}
                                onToggle={(id) => setArquivos(prev => prev.map(a => a.id === id ? { ...a, expandido: !a.expandido } : a))}
                                onSave={salvarRegistro}
                            />
                        ))}
                    </div>

                    {arquivos.length === 0 && (
                        <div className="text-center py-8 text-text-muted">
                            <FileImage size={36} strokeWidth={1.2} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Adicione fotos das fichas para começar a análise.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Histórico Tab ── */}
            {aba === 'historico' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={carregarHistorico}
                            className="btn-ghost text-xs flex items-center gap-1.5"
                        >
                            <RefreshCcw size={13} className={carregandoHistorico ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                    </div>
                    {carregandoHistorico
                        ? <div className="text-center py-10 text-text-muted text-sm">Carregando...</div>
                        : <Historico registros={historico} onDelete={excluirRegistro} />
                    }
                </div>
            )}
        </div>
    );
}
