'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    X,
    Plus,
    Check,
    DollarSign,
    ShieldCheck,
    AlertCircle,
    Clover,
    Lock,
    Unlock,
    ChevronRight,
    ArrowLeftRight
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { useToast } from '@/contexts/ToastContext';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil';
import { getProdutos } from '@/actions/boloes';
import { Jogo } from '@/types/produto';
import { LogoLoteria } from '@/components/ui/LogoLoteria';
import { LOTERIAS_OFFICIAL } from '@/data/loterias-config';
import { createBolao } from '@/actions/boloes';
import { getNextDrawDate, formatToInputDate, formatDrawDateLabel } from '@/utils/date-utils';
import { FINANCIAL_RULES, calcularPrecoVenda, calcularComissao } from '@/lib/financial-constants';

interface ModalNovoBolaoProps {
    onClose: () => void;
    onAdd: (bolao: any) => void;
}

/**
 * Retorna um array com as próximas N datas de sorteio disponíveis
 * para um determinado produto, respeitando dias e horário de fechamento.
 */
function getNextDrawDates(produto: Jogo, quantity: number = 30): Date[] {
    const dates: Date[] = [];
    let currentDate = new Date();
    // Ajusta para meia-noite para evitar problemas de comparação
    currentDate.setHours(0, 0, 0, 0);

    while (dates.length < quantity) {
        // Tenta obter a próxima data a partir da currentDate
        const nextDate = getNextDrawDate(produto.diasSorteio, produto.horarioFechamento, currentDate);
        if (!nextDate) break;
        // Evita duplicatas
        if (dates.length === 0 || nextDate.getTime() !== dates[dates.length - 1].getTime()) {
            dates.push(nextDate);
        }
        // Avança um dia para buscar a próxima
        currentDate = new Date(nextDate);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
}

export function ModalNovoBolao({ onClose, onAdd }: ModalNovoBolaoProps) {
    const { lojaAtual, lojasDisponiveis } = useLoja();
    const { isAdmin } = usePerfil();

    const [unlockedStep, setUnlockedStep] = useState(1);
    const [formData, setFormData] = useState({
        jogo: 'Mega-Sena',
        concurso: '',
        dataSorteio: '',
        qtdJogos: 1,
        dezenas: 6,
        valorPorJogo: 0,
        taxaAdministrativa: FINANCIAL_RULES.AGIO_BOLOES,
        qtdCotas: 10,
        teimosinha: false,
        surpresinha: false,
        loja_id: lojaAtual?.id || ''
    });

    const [produtos, setProdutos] = useState<Jogo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [corSelecionada, setCorSelecionada] = useState('#209869');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // Opções de datas disponíveis (próximas 30)
    const [opcoesDatas, setOpcoesDatas] = useState<Date[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await getProdutos();

                if (data && data.length > 0) {
                    setProdutos(data.filter(p => p.ativo));
                    const first = data[0];
                    setFormData(prev => ({
                        ...prev,
                        jogo: first.nome,
                        dezenas: first.minDezenas
                    }));
                    setCorSelecionada(first.cor);
                } else {
                    setProdutos([]);
                }
            } catch (err: any) {
                console.error('Falha ao carregar produtos para o bolão:', err);
                setProdutos([]);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const selectedProduct = produtos.find(p => p.nome === formData.jogo);

    // Quando o produto selecionado mudar, recalcular as opções de datas
    useEffect(() => {
        if (selectedProduct) {
            setCorSelecionada(selectedProduct.cor);
            if (formData.dezenas < selectedProduct.minDezenas) {
                setFormData(prev => ({ ...prev, dezenas: selectedProduct.minDezenas }));
            }

            // Gerar próximas 30 datas disponíveis
            const proximasDatas = getNextDrawDates(selectedProduct, 30);
            setOpcoesDatas(proximasDatas);

            // Selecionar a primeira data como padrão
            if (proximasDatas.length > 0) {
                const dataISO = formatToInputDate(proximasDatas[0]);
                setFormData(prev => ({ ...prev, dataSorteio: dataISO }));
            } else {
                setFormData(prev => ({ ...prev, dataSorteio: '' }));
            }
        }
    }, [formData.jogo, selectedProduct]);

    // Lógica de desbloqueio automático
    useEffect(() => {
        if (formData.jogo && formData.concurso && formData.dataSorteio) {
            if (unlockedStep < 2) setUnlockedStep(2);
        }
        if (unlockedStep >= 2 && formData.qtdJogos > 0 && formData.dezenas > 0 && formData.qtdCotas > 0 && formData.valorPorJogo > 0) {
            if (unlockedStep < 3) setUnlockedStep(3);
        }
    }, [formData, unlockedStep]);

    // CÁLCULOS FINANCEIROS
    const valorTotalBase = formData.valorPorJogo * formData.qtdJogos;
    const valorCotaBase = formData.qtdCotas > 0 ? valorTotalBase / formData.qtdCotas : 0;
    const precoVendaCota = valorCotaBase * (1 + formData.taxaAdministrativa / 100);
    const comissaoUnit = precoVendaCota - valorCotaBase;
    const arrecadacaoTotal = precoVendaCota * formData.qtdCotas;
    const lucroTotalCasa = comissaoUnit * formData.qtdCotas;

    const handleLancar = async () => {
        if (!selectedProduct) return;
        if (!formData.loja_id) {
            toast({ message: 'Selecione uma filial para o bolão.', type: 'error' });
            return;
        }
        if (!formData.dataSorteio) {
            toast({ message: 'Selecione uma data de sorteio.', type: 'error' });
            return;
        }

        try {
            const bolaoData = {
                produtoId: selectedProduct.id!,
                lojaId: formData.loja_id,
                concurso: formData.concurso,
                dataSorteio: formData.dataSorteio,
                qtdJogos: formData.qtdJogos,
                dezenas: formData.dezenas,
                valorCotaBase: valorCotaBase,
                taxaAdministrativa: formData.taxaAdministrativa,
                qtdCotas: formData.qtdCotas,
                precoVendaCota: precoVendaCota,
                cotasVendidas: 0,
                status: 'disponivel' as const
            };

            const result = await createBolao(bolaoData);
            if (!result.success) throw new Error(result.error);

            const created = result.data;
            const uiBolao = {
                ...created,
                id: created.id,
                jogo: selectedProduct.nome,
                cor: selectedProduct.cor,
                agio: created.taxa_administrativa,
                valorCota: Number(created.preco_venda_cota),
                totalCotas: created.qtd_cotas,
                cotasVendidas: created.cotas_vendidas,
                dataSorteio: created.data_sorteio
            };
            onAdd(uiBolao);
            onClose();
        } catch (error: any) {
            console.error('Erro ao lançar bolão:', error);
            toast({ message: error.message || 'Falha ao salvar o bolão.', type: 'error' });
        }
    };

    const isStepLocked = (step: number) => step > unlockedStep;

    return (
        <div className="modal-overlay fixed inset-0 bg-black/60 z-9999 flex items-center justify-center p-4 md:p-8">
            <div className="modal-container animate-in fade-in zoom-in-95" style={{
                width: '100%',
                maxWidth: 1000,
                height: '90vh',
                background: 'var(--bg-card)',
                borderRadius: 24,
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header Fixo */}
                <div className="flex justify-between items-center p-4 px-8 border-b border-border bg-bg-card z-10">
                    <div>
                        <h2 className="text-xl font-black text-text-primary">Novo Bolão</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-subtle text-text-muted transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body com Scroll */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 flex flex-col gap-12 scroll-smooth">
                    {/* ETAPA 1 */}
                    <Section
                        number={1}
                        title="Configuração do Concurso"
                        isLocked={false}
                        isDone={unlockedStep > 1}
                        cor={corSelecionada}
                    >
                        <div className="grid grid-cols-2 gap-6">
                            {(isAdmin || lojasDisponiveis.length > 1) && (
                                <div className="form-group col-span-2 pb-4 border-b border-border">
                                    <label className="text-primary">Filial Responsável</label>
                                    <select
                                        className="input-expanded"
                                        value={formData.loja_id}
                                        onChange={e => setFormData({ ...formData, loja_id: e.target.value })}
                                    >
                                        <option value="">Selecione a Filial...</option>
                                        {lojasDisponiveis.map(loja => (
                                            <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group col-span-2">
                                <label>Loteria</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {isLoading ? (
                                        <div className="col-span-4 text-center p-6 text-muted">Carregando...</div>
                                    ) : produtos.length === 0 ? (
                                        <div className="col-span-4 text-center p-6 text-muted border border-dashed rounded-2xl">
                                            Nenhuma loteria cadastrada.
                                        </div>
                                    ) : (
                                        produtos.map(l => (
                                            <button
                                                key={l.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, jogo: l.nome, dezenas: l.minDezenas })}
                                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                                                    formData.jogo === l.nome ? `border-[${l.cor}] bg-[${l.cor}]/10` : 'border-border hover:border-white/20'
                                                }`}
                                                style={formData.jogo === l.nome ? { borderColor: l.cor, background: `${l.cor}15` } : {}}
                                            >
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: l.cor }}>
                                                    <LogoLoteria cor={l.cor} tamanho={20} temPlus={false} />
                                                </div>
                                                <span className="text-xs font-bold">{l.nome}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Concurso</label>
                                <input
                                    type="number"
                                    className="input-expanded"
                                    placeholder="Número do concurso"
                                    value={formData.concurso}
                                    onChange={e => setFormData({ ...formData, concurso: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Data do Sorteio</label>
                                <select
                                    className="input-expanded"
                                    value={formData.dataSorteio}
                                    onChange={e => setFormData({ ...formData, dataSorteio: e.target.value })}
                                    disabled={opcoesDatas.length === 0}
                                >
                                    {opcoesDatas.length === 0 ? (
                                        <option>Carregando datas...</option>
                                    ) : (
                                        opcoesDatas.map((date, idx) => {
                                            const value = formatToInputDate(date);
                                            const label = formatDrawDateLabel(date);
                                            return (
                                                <option key={idx} value={value}>
                                                    {label}
                                                </option>
                                            );
                                        })
                                    )}
                                </select>
                                {opcoesDatas.length === 0 && selectedProduct && (
                                    <p className="text-xs text-warning mt-1">
                                        Nenhuma data disponível para esta loteria. Verifique os dias de sorteio.
                                    </p>
                                )}
                            </div>
                        </div>
                    </Section>

                    {/* ETAPA 2 - SIMULAÇÃO */}
                    <Section
                        number={2}
                        title="Simulação do Bolão"
                        isLocked={isStepLocked(2)}
                        isDone={unlockedStep > 2}
                        cor={corSelecionada}
                    >
                        <div className="flex gap-6 items-stretch">
                            {/* Parâmetros */}
                            <div className="flex-1 p-6 rounded-3xl text-white" style={{ background: corSelecionada }}>
                                <h4 className="text-xl font-black text-center mb-6">Parâmetros da Simulação</h4>
                                <div className="space-y-4">
                                    <SimulacaoGroup label="Quantidade de Jogos:">
                                        <input type="number" className="input-simulation" value={formData.qtdJogos} onChange={e => setFormData({ ...formData, qtdJogos: parseInt(e.target.value) || 0 })} />
                                    </SimulacaoGroup>
                                    <SimulacaoGroup label="Quantidade de Dezenas:">
                                        <select className="input-simulation" value={formData.dezenas} onChange={e => setFormData({ ...formData, dezenas: parseInt(e.target.value) })}>
                                            {selectedProduct && Array.from(
                                                { length: selectedProduct.maxDezenas - selectedProduct.minDezenas + 1 },
                                                (_, i) => selectedProduct.minDezenas + i
                                            ).map(n => <option key={n} value={n}>{n} dezenas</option>)}
                                        </select>
                                    </SimulacaoGroup>
                                    <SimulacaoGroup label="Quantidade de Cotas:">
                                        <input type="number" className="input-simulation" value={formData.qtdCotas} onChange={e => setFormData({ ...formData, qtdCotas: parseInt(e.target.value) || 0 })} />
                                    </SimulacaoGroup>
                                    <SimulacaoGroup label="Taxa de Serviço:">
                                        <div className="relative w-full">
                                            <input type="number" className="input-simulation opacity-80 cursor-not-allowed" value={formData.taxaAdministrativa} readOnly />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-white/40">%</span>
                                        </div>
                                        <span className="text-xs text-center opacity-70">📌 Fixo em {FINANCIAL_RULES.AGIO_BOLOES}%</span>
                                    </SimulacaoGroup>
                                </div>
                            </div>

                            <div className="flex items-center justify-center w-12">
                                <ArrowLeftRight size={28} className="text-muted" />
                            </div>

                            {/* Resultados */}
                            <div className="flex-1 p-6 rounded-3xl text-white" style={{ background: corSelecionada }}>
                                <h4 className="text-xl font-black text-center mb-6">Resultado da Simulação</h4>
                                <div className="space-y-4">
                                    <SimulacaoGroup label="Valor por Jogo (R$):">
                                        <MoneyInput value={formData.valorPorJogo} onValueChange={v => setFormData({ ...formData, valorPorJogo: v })} className="input-simulation-money" autoFocus />
                                    </SimulacaoGroup>
                                    <SimulacaoGroup label="Venda Total:">
                                        <SimulacaoDisplay value={arrecadacaoTotal} />
                                    </SimulacaoGroup>
                                    <SimulacaoGroup label="Lucro Total (Casa):">
                                        <SimulacaoDisplay value={lucroTotalCasa} />
                                    </SimulacaoGroup>
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* ETAPA 3 - REVISÃO FINAL */}
                    <Section
                        number={3}
                        title="Revisão Final"
                        isLocked={isStepLocked(3)}
                        isDone={unlockedStep > 3}
                        cor={corSelecionada}
                    >
                        <div className="grid grid-cols-[1.5fr,1fr] gap-6">
                            <div className="p-6 rounded-2xl bg-bg-dark border-2 relative overflow-hidden" style={{ borderColor: corSelecionada }}>
                                <div className="absolute top-0 right-0 px-4 py-1 text-white text-xs font-black rounded-bl-lg" style={{ background: corSelecionada }}>
                                    PREVIEW BOLÃO
                                </div>
                                <h3 className="text-2xl font-black mb-4">{formData.jogo}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <ReviewItem label="CONCURSO" value={`#${formData.concurso}`} />
                                    <ReviewItem label="SORTEIO" value={formData.dataSorteio ? new Date(formData.dataSorteio).toLocaleDateString('pt-BR') : '-'} />
                                    <ReviewItem label="ESTRUTURA" value={`${formData.qtdJogos} JOGOS | ${formData.dezenas} DEZENAS`} />
                                    <ReviewItem label="VENDAS" value={`${formData.qtdCotas} COTAS`} />
                                </div>
                                <div className="mt-6 pt-4 border-t border-border flex justify-between">
                                    <div>
                                        <p className="text-xs text-muted">VALOR TOTAL (SEM COMISSÃO)</p>
                                        <p className="text-2xl font-black" style={{ color: corSelecionada }}>R$ {valorTotalBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted">COMISSÃO TOTAL</p>
                                        <p className="text-xl font-bold" style={{ color: corSelecionada }}>R$ {lucroTotalCasa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                                    <div className="flex justify-between">
                                        <span className="text-xs font-bold text-muted">ARRECADAÇÃO TOTAL</span>
                                        <span className="font-black">R$ {arrecadacaoTotal.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="flex justify-between mt-2">
                                        <span className="text-xs font-bold text-muted">COMISSÃO TOTAL</span>
                                        <span className="font-black">R$ {lucroTotalCasa.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-success/5 border border-success/20 flex gap-3">
                                    <ShieldCheck size={20} className="text-success shrink-0" />
                                    <p className="text-xs font-semibold">Bolão configurado com taxa administrativa fixa de 35%. Pronto para lançamento.</p>
                                </div>
                                <button onClick={handleLancar} className="btn w-full py-4 text-white font-black text-lg flex items-center justify-center gap-2 mt-auto transition-transform hover:scale-[1.02]" style={{ background: corSelecionada }}>
                                    <Check size={24} /> LANÇAR
                                </button>
                            </div>
                        </div>
                    </Section>
                </div>
            </div>

            <style jsx>{`
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    letter-spacing: 0.05em;
                }
                .input-expanded {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    background: var(--bg-dark);
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .input-expanded:focus {
                    outline: none;
                    border-color: ${corSelecionada};
                    box-shadow: 0 0 0 3px ${corSelecionada}30;
                }
                .input-simulation, .input-simulation-money {
                    width: 100%;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    border-radius: 40px;
                    padding: 0.7rem 1.2rem;
                    color: white;
                    font-size: 1rem;
                    font-weight: 800;
                    text-align: center;
                    outline: none;
                }
                .input-simulation-money {
                    background: white;
                    color: #1e1e2f;
                    padding-left: 2.5rem;
                }
                .input-simulation:focus, .input-simulation-money:focus {
                    background: rgba(255,255,255,0.3);
                }
            `}</style>
        </div>
    );
}

// Subcomponentes (mantidos iguais)
function Section({ number, title, isLocked, isDone, children, cor }: any) {
    return (
        <div className={`relative pl-12 transition-all ${isLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border-4 z-10"
                style={{
                    background: isLocked ? 'var(--bg-dark)' : (isDone ? cor : 'var(--bg-card)'),
                    color: (isDone || !isLocked) ? '#fff' : 'var(--text-muted)',
                    borderColor: (isDone || !isLocked) ? cor : 'var(--border)'
                }}>
                {isDone ? <Check size={22} /> : (isLocked ? <Lock size={16} /> : number)}
            </div>
            <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                {title}
                {isLocked && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">BLOQUEADO</span>}
                {isDone && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: cor, color: '#fff' }}>CONCLUÍDO</span>}
            </h3>
            {children}
        </div>
    );
}

function SimulacaoGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 items-center">
            <span className="text-sm font-bold opacity-90">{label}</span>
            {children}
        </div>
    );
}

function SimulacaoDisplay({ value }: { value: number }) {
    return (
        <div className="input-simulation bg-black/20 pointer-events-none">
            R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
    );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[0.6rem] font-black text-muted uppercase">{label}</p>
            <p className="text-sm font-bold">{value}</p>
        </div>
    );
}
