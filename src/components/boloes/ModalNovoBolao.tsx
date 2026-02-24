'use client';

import { useState, useEffect, useRef } from 'react';
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
        valorCotaBase: 0,
        valorCotaVenda: 0, // Novo campo principal
        taxaAdministrativa: FINANCIAL_RULES.AGIO_BOLOES, // Usando constante centralizada
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
                setError(null); // Silent error if table is missing, just show empty
                setProdutos([]);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const selectedProduct = produtos.find(p => p.nome === formData.jogo);

    useEffect(() => {
        if (selectedProduct) {
            setCorSelecionada(selectedProduct.cor);
            if (formData.dezenas < selectedProduct.minDezenas) {
                setFormData(prev => ({ ...prev, dezenas: selectedProduct.minDezenas }));
            }

            // Automação da Data do Sorteio (Blindada)
            if (selectedProduct.diasSorteio && selectedProduct.horarioFechamento) {
                try {
                    const nextDate = getNextDrawDate(selectedProduct.diasSorteio, selectedProduct.horarioFechamento);
                    setFormData(prev => ({
                        ...prev,
                        dataSorteio: formatToInputDate(nextDate)
                    }));
                } catch (err) {
                    console.error('Erro ao calcular data do sorteio:', err);
                }
            }
        }
    }, [formData.jogo, selectedProduct]);

    // Lógica de Desbloqueio Automático (3 Passos agora)
    useEffect(() => {
        if (formData.jogo && formData.concurso && formData.dataSorteio) {
            if (unlockedStep < 2) setUnlockedStep(2);
        }
        if (unlockedStep >= 2 && formData.qtdJogos > 0 && formData.dezenas > 0 && formData.qtdCotas > 0 && formData.valorCotaBase > 0) {
            if (unlockedStep < 3) setUnlockedStep(3);
        }
    }, [formData, unlockedStep]);

    /**
     * 📊 CÁLCULOS FINANCEIROS DO BOLÃO
     * 
     * Fluxo de Cálculo:
     * 1. Usuário informa o VALOR TOTAL sem comissão (ex: R$ 100,00)
     * 2. Sistema divide por qtd de cotas para obter VALOR BASE por cota (ex: R$ 10,00)
     * 3. Aplica o ágio de 35% para obter PREÇO DE VENDA (ex: R$ 13,50)
     * 4. Calcula COMISSÃO UNITÁRIA (Venda - Base = R$ 3,50)
     * 5. Multiplica pela qtd de cotas para totais
     * 
     * Fórmulas Aplicadas:
     * - valorCotaBase = valorTotal / qtdCotas
     * - precoVendaCota = valorCotaBase * (1 + ágio/100)
     * - comissaoUnitária = precoVendaCota - valorCotaBase
     * - lucroTotal = comissaoUnitária * qtdCotas
     * - arrecadaçãoTotal = precoVendaCota * qtdCotas
     * 
     * Exemplo Prático (10 cotas, R$ 100 total, ágio 35%):
     * - Input: R$ 100,00 (valor total sem comissão)
     * - Base por cota: R$ 10,00
     * - Venda por cota: R$ 13,50
     * - Comissão por cota: R$ 3,50
     * - Arrecadação total: R$ 135,00
     * - Lucro total da casa: R$ 35,00
     * 
     * @see FINANCIAL_RULES.AGIO_BOLOES (35%)
     */
    const valorSemComissaoTotal = formData.valorCotaBase; // Agora este é o input total
    const valorCotaBase = formData.qtdCotas > 0 ? valorSemComissaoTotal / formData.qtdCotas : 0;
    const precoVendaCota = valorCotaBase * (1 + formData.taxaAdministrativa / 100);
    const comissaoUnit = precoVendaCota - valorCotaBase;

    const arrecadacaoTotal = precoVendaCota * formData.qtdCotas;
    const lucroTotalCasa = comissaoUnit * formData.qtdCotas;
    const vendaTotalSemComissao = valorSemComissaoTotal;
    const comissao = comissaoUnit;

    const handleLancar = async () => {
        if (!selectedProduct) return;

        if (!formData.loja_id) {
            toast({ message: 'Selecione uma filial para o bolão.', type: 'error' });
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
                valorCotaBase: valorCotaBase, // Usando unidade, não o total
                taxaAdministrativa: formData.taxaAdministrativa,
                qtdCotas: formData.qtdCotas,
                precoVendaCota: precoVendaCota,
                cotasVendidas: 0,
                status: 'disponivel' as const
            };

            const result = await createBolao(bolaoData);

            if (!result.success) {
                throw new Error(result.error);
            }

            const created = result.data;

            // Map back to the expected format for onAdd (with extended data for UI)
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
            toast({ message: error.message || 'Falha ao salvar o bolão. Verifique os dados e tente novamente.', type: 'error' });
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
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header Fixo */}
                <div className="flex justify-between items-center p-4 px-8 border-b border-border bg-bg-card z-10">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Novo Bolão</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-subtle text-text-muted transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body com Scroll Suave */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-8 flex flex-col gap-12 scroll-smooth"
                >
                    {/* ETAPA 1 */}
                    <Section
                        number={1}
                        title="Configuração do Concurso"
                        isLocked={false}
                        isDone={unlockedStep > 1}
                        cor={corSelecionada}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Seleção de Filial (Admin ou Multi-loja) */}
                            {(isAdmin || lojasDisponiveis.length > 1) && (
                                <div className="form-group col-span-2" style={{ gridColumn: 'span 2', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                                    <label style={{ color: 'var(--primary)' }}>Filial Responsável</label>
                                    <select
                                        className="input-expanded"
                                        style={{ borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)' }}
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

                            <div className="form-group col-span-2" style={{ gridColumn: 'span 2' }}>
                                <label>Loteria</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                    {isLoading ? (
                                        <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                                            <p className="animate-pulse">Buscando loterias...</p>
                                        </div>
                                    ) : produtos.length === 0 ? (
                                        <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '14px' }}>
                                            <p style={{ fontSize: '0.85rem' }}>Nenhuma loteria cadastrada.</p>
                                            <p style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Cadastre os jogos primeiro no menu de Cadastros.</p>
                                        </div>
                                    ) : (
                                        produtos.map(l => (
                                            <button
                                                key={l.id}
                                                onClick={() => setFormData({ ...formData, jogo: l.nome, dezenas: l.minDezenas })}
                                                style={{
                                                    padding: '1rem 0.5rem',
                                                    borderRadius: 14,
                                                    border: formData.jogo === l.nome ? `2px solid ${l.cor}` : '1px solid var(--border)',
                                                    background: formData.jogo === l.nome ? `${l.cor}15` : 'var(--bg-dark)',
                                                    color: formData.jogo === l.nome ? 'var(--text-primary)' : 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '0.6rem',
                                                    transition: 'all 0.2s',
                                                    minHeight: '80px',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <div style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background: l.cor,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <LogoLoteria cor={l.cor} tamanho={20} temPlus={false} />
                                                </div>
                                                {l.nome}
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
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        className="input-expanded"
                                        style={{ background: 'var(--surface-subtle)', cursor: 'not-allowed', color: 'var(--text-primary)', fontWeight: 800 }}
                                        value={formData.dataSorteio ? formatDrawDateLabel(new Date(formData.dataSorteio.split('-').join('/'))) : 'Calculando...'}
                                        readOnly
                                    />
                                </div>
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
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.5rem',
                            position: 'relative'
                        }}>
                            {/* LADO ESQUERDO: PARAMETROS */}
                            <div style={{
                                flex: 1,
                                background: corSelecionada,
                                padding: '2.5rem 2rem',
                                borderRadius: 32,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.5rem',
                                color: '#fff',
                                boxShadow: 'none'
                            }}>
                                <h4 style={{ fontSize: '1.25rem', fontWeight: 900, textAlign: 'center', marginBottom: '1rem', color: '#fff' }}>Parâmetros da Simulação</h4>

                                <SimulacaoGroup label="Quantidade de Jogos:">
                                    <input
                                        type="number"
                                        className="input-simulation"
                                        value={formData.qtdJogos}
                                        onChange={e => setFormData({ ...formData, qtdJogos: parseInt(e.target.value) || 0 })}
                                    />
                                </SimulacaoGroup>

                                <SimulacaoGroup label="Quantidade de Dezenas:">
                                    <select
                                        className="input-simulation"
                                        value={formData.dezenas}
                                        onChange={e => setFormData({ ...formData, dezenas: parseInt(e.target.value) })}
                                    >
                                        {selectedProduct && Array.from(
                                            { length: selectedProduct.maxDezenas - selectedProduct.minDezenas + 1 },
                                            (_, i) => selectedProduct.minDezenas + i
                                        ).map(n => (
                                            <option key={n} value={n}>{n} dezenas</option>
                                        ))}
                                    </select>
                                </SimulacaoGroup>

                                <SimulacaoGroup label="Quantidade de Cotas:">
                                    <input
                                        type="number"
                                        className="input-simulation"
                                        value={formData.qtdCotas}
                                        onChange={e => setFormData({ ...formData, qtdCotas: parseInt(e.target.value) || 0 })}
                                    />
                                </SimulacaoGroup>

                                <SimulacaoGroup label="Taxa de Serviço:">
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        <input
                                            type="number"
                                            className="input-simulation"
                                            style={{ opacity: 0.8, cursor: 'not-allowed' }}
                                            value={formData.taxaAdministrativa}
                                            min={FINANCIAL_RULES.VALIDATION.AGIO_MIN}
                                            max={FINANCIAL_RULES.VALIDATION.AGIO_MAX}
                                            readOnly
                                            title={`Ágio fixo de ${FINANCIAL_RULES.AGIO_BOLOES}% (Máximo permitido: ${FINANCIAL_RULES.VALIDATION.AGIO_MAX}%)`}
                                        />
                                        <span style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }}>%</span>
                                    </div>
                                    <span style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: '-0.5rem', textAlign: 'center' }}>
                                        📌 Fixo em {FINANCIAL_RULES.AGIO_BOLOES}% (Regulamento)
                                    </span>
                                </SimulacaoGroup>
                            </div>

                            {/* ICONE CENTRAL */}
                            <div style={{
                                width: 50,
                                height: 50,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: corSelecionada,
                                background: 'var(--bg-card)',
                                borderRadius: '50%',
                                border: `2px solid ${corSelecionada}`,
                                zIndex: 5,
                                flexShrink: 0
                            }}>
                                <ArrowLeftRight size={24} />
                            </div>

                            {/* LADO DIREITO: VALORES E RESULTADOS */}
                            <div style={{
                                flex: 1,
                                background: corSelecionada,
                                padding: '2.5rem 2rem',
                                borderRadius: 32,
                                color: '#fff',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.5rem',
                                boxShadow: 'none'
                            }}>
                                <h4 style={{ fontSize: '1.25rem', fontWeight: 900, textAlign: 'center', marginBottom: '1rem', color: '#fff' }}>Resultado da Simulação</h4>

                                <SimulacaoGroup label="Valor sem Comissão:">
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        <MoneyInput
                                            value={formData.valorCotaBase}
                                            onValueChange={v => setFormData({ ...formData, valorCotaBase: v })}
                                            className="input-simulation-money"
                                            autoFocus
                                            placeholder="0,00"
                                        />
                                    </div>
                                </SimulacaoGroup>

                                <SimulacaoGroup label="Valor da Cota (Final):">
                                    <SimulacaoDisplay value={precoVendaCota} />
                                </SimulacaoGroup>

                                <SimulacaoGroup label="Margem por Cota:">
                                    <SimulacaoDisplay value={comissao} />
                                </SimulacaoGroup>

                                <SimulacaoGroup label="Venda Total:">
                                    <SimulacaoDisplay value={arrecadacaoTotal} />
                                </SimulacaoGroup>

                                <SimulacaoGroup label="Lucro Total (Casa):">
                                    <SimulacaoDisplay value={lucroTotalCasa} />
                                </SimulacaoGroup>
                            </div>
                        </div>
                    </Section>

                    {/* ETAPA 3 */}
                    <Section
                        number={3}
                        title="Revisão Final"
                        isLocked={isStepLocked(3)}
                        isDone={unlockedStep > 3}
                        cor={corSelecionada}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                            <div style={{
                                background: 'var(--bg-dark)',
                                border: `2px solid ${corSelecionada}`,
                                borderRadius: 20,
                                padding: '2rem',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    background: corSelecionada,
                                    color: '#fff',
                                    padding: '0.4rem 1.5rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 900,
                                    borderRadius: '0 0 0 16px'
                                }}>
                                    PREVIEW BOLÃO
                                </div>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem', color: 'var(--text-primary)' }}>{formData.jogo}</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <ReviewItem label="CONCURSO" value={`#${formData.concurso}`} />
                                    <ReviewItem label="SORTEIO" value={formData.dataSorteio ? new Date(formData.dataSorteio).toLocaleDateString('pt-BR') : '-'} />
                                    <ReviewItem label="ESTRUTURA" value={`${formData.qtdJogos} JOGOS | ${formData.dezenas} DEZENAS`} />
                                    <ReviewItem label="VENDAS" value={`${formData.qtdCotas} COTAS`} />
                                </div>
                                <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>PREÇO UNITÁRIO (VENDA)</p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 900, color: corSelecionada, margin: 0 }}>R$ {precoVendaCota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>COMISSÃO POR COTA</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: corSelecionada }}>R$ {comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{
                                    padding: '1.5rem',
                                    borderRadius: 16,
                                    background: 'var(--surface-subtle)',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ARRECADAÇÃO TOTAL</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>R$ {arrecadacaoTotal.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>COMISSÃO TOTAL</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>R$ {lucroTotalCasa.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                                <div style={{
                                    padding: '1.25rem',
                                    borderRadius: 16,
                                    background: 'rgba(var(--success-rgb), 0.05)',
                                    border: '1px solid rgba(var(--success-rgb), 0.2)',
                                    display: 'flex',
                                    gap: '1rem'
                                }}>
                                    <ShieldCheck size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                                        Bolão configurado com taxa administrativa fixa de 35%. Pronto para lançamento.
                                    </p>
                                </div>
                                <button
                                    onClick={handleLancar}
                                    style={{
                                        marginTop: 'auto',
                                        padding: '1.25rem',
                                        borderRadius: 16,
                                        background: corSelecionada,
                                        color: '#ffffff', // Forçar branco puro
                                        fontSize: '1.125rem',
                                        fontWeight: 900,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        cursor: 'pointer',
                                        boxShadow: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.75rem',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
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
                    gap: 0.6rem;
                }
                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                .input-expanded {
                    width: 100%;
                    padding: 1rem 1.25rem;
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    background: var(--bg-dark);
                    color: var(--text-primary);
                    font-size: 1rem;
                    font-weight: 600;
                    transition: all 0.2s;
                    box-: inset 0 2px 4px rgba(0,0,0,0.05);
                }
                .input-expanded:focus {
                    outline: none;
                    border-color: ${corSelecionada};
                    background: var(--bg-card);
                    box-: 0 0 0 4px ${corSelecionada}15;
                }
                select.input-expanded {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                    background-position: right 1rem center;
                    background-repeat: no-repeat;
                    background-size: 1.25em;
                }
                .input-simulation {
                    width: 100%;
                    background: rgba(255,255,255,0.25);
                    border: none;
                    border-radius: 20px;
                    padding: 0.8rem 1.5rem;
                    color: #fff;
                    font-size: 1.15rem;
                    font-weight: 800;
                    text-align: center;
                    outline: none;
                    transition: all 0.2s;
                }
                .input-simulation:focus {
                    background: rgba(255,255,255,0.4);
                }
                .input-simulation-money {
                    width: 100%;
                    background: #fff;
                    border: none;
                    border-radius: 20px;
                    padding: 0.8rem 1.5rem;
                    color: var(--bg-dark);
                    font-size: 1.15rem;
                    font-weight: 800;
                    text-align: center;
                    outline: none;
                    transition: all 0.2s;
                    padding-left: 3rem;
                }
                .input-simulation-money:focus {
                     box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
                }
                select.input-simulation {
                    appearance: none;
                }
            `}</style>
        </div>
    );
}

// Subcomponentes
function Section({ number, title, isLocked, isDone, children, cor }: any) {
    return (
        <div style={{
            opacity: isLocked ? 0.35 : 1,
            pointerEvents: isLocked ? 'none' : 'auto',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            paddingLeft: '4rem',
            borderLeft: `3px dashed ${isDone ? cor : 'var(--border)'}`,
            filter: isLocked ? 'grayscale(0.5)' : 'none'
        }}>
            {/* Indicador de Step */}
            <div style={{
                position: 'absolute',
                left: '-1.5rem',
                top: 0,
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: isLocked ? 'var(--bg-dark)' : (isDone ? cor : 'var(--bg-card)'),
                color: isDone || !isLocked ? '#fff' : 'var(--text-muted)',
                border: `4px solid ${isDone || !isLocked ? cor : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1.25rem',
                zIndex: 2,
                boxShadow: 'none'
            }}>
                {isDone ? <Check size={28} /> : (isLocked ? <Lock size={20} /> : number)}
            </div>

            <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 900,
                marginBottom: '2rem',
                color: isLocked ? 'var(--text-muted)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                letterSpacing: '-0.02em'
            }}>
                {title}
                {isLocked && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '0.2rem 0.6rem', borderRadius: 6, fontWeight: 700 }}>AGUARDANDO ETAPA ANTERIOR</span>}
                {isDone && <span style={{ fontSize: '0.6rem', background: cor, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: 6, fontWeight: 700 }}>PASSO CONCLUÍDO</span>}
            </h3>

            {children}
        </div>
    );
}

function FinancialInfo({ label, value, highlight, cor }: any) {
    return (
        <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</p>
            <p style={{
                fontSize: highlight ? '1.5rem' : '1.125rem',
                fontWeight: 900,
                color: highlight ? cor : 'var(--text-primary)',
                margin: 0
            }}>{value}</p>
        </div>
    );
}

function ReviewItem({ label, value }: any) {
    return (
        <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.2rem', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
        </div>
    );
}

function ValueRow({ label, value, isTotal }: { label: string, value: number, isTotal?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: isTotal ? '0.85rem' : '0.75rem', fontWeight: isTotal ? 900 : 700, opacity: isTotal ? 1 : 0.8 }}>{label}</span>
            <span style={{ fontSize: isTotal ? '1.25rem' : '1rem', fontWeight: 900 }}>
                R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </div>
    );
}

function SimulacaoGroup({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.9 }}>{label}</span>
            {children}
        </div>
    );
}

function SimulacaoDisplay({ value }: { value: number }) {
    return (
        <div className="input-simulation" style={{ pointerEvents: 'none', background: 'rgba(0,0,0,0.1)' }}>
            R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
    );
}


