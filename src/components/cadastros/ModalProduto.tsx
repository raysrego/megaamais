'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Check,
    Clover,
    DollarSign,
    Star,
    Trophy,
    Zap,
    Target,
    Award,
    Crown,
    AlertCircle,
    Box,
    LayoutGrid,
    Calendar,
    Settings
} from 'lucide-react';
import { Jogo, JogoSchema, DIAS_SEMANA, CategoriaProduto } from '@/types/produto';
import { LOTERIAS_OFFICIAL } from '@/data/loterias-config';
import { LogoLoteria } from '@/components/ui/LogoLoteria';
import { z } from 'zod';

interface ModalProdutoProps {
    onClose: () => void;
    onSave: (produto: Jogo) => void;
    produtoEditar?: Jogo | null;
    categorias: CategoriaProduto[];
}

export function ModalProduto({ onClose, onSave, produtoEditar, categorias }: ModalProdutoProps) {
    const defaultCor = '#64748b'; // Slate 500

    // Encontrar categoria inicial (Loterias por padrão)
    const catLoterias = categorias.find(c => c.nome === 'Loterias');
    const defaultCatId = catLoterias?.id;

    const [formData, setFormData] = useState<Partial<Jogo>>({
        nome: '',
        slug: '',
        cor: defaultCor,
        corDestaque: '#94a3b8',
        icone: 'box',
        diasSorteio: [],
        minDezenas: 6,
        maxDezenas: 15,
        horarioFechamento: '19:00',
        ativo: true,
        categoriaId: defaultCatId,
        gerenciaEstoque: false,
        precoPadrao: 0
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Helper para saber se é loteria
    const isLoteria = (() => {
        const cat = categorias.find(c => c.id === formData.categoriaId);
        return cat?.nome === 'Loterias';
    })();

    useEffect(() => {
        if (produtoEditar) {
            setFormData(produtoEditar);
        } else if (defaultCatId && !formData.categoriaId) {
            // Se for novo, garante categoria setada
            setFormData(prev => ({ ...prev, categoriaId: defaultCatId }));
        }
    }, [produtoEditar, defaultCatId]);

    const handleSave = () => {
        try {
            // Validação customizada baseada na categoria
            // Se não for loteria, limpar campos de loteria para não falhar validação ou salvar lixo
            const dataToSave = { ...formData };

            if (!isLoteria) {
                // Preencher defaults para passar no Schema (que exige minDezenas >= 1)
                // O ideal seria refatorar o Schema para usar discriminate union, mas por agora vamos ajustar os dados
                dataToSave.minDezenas = 1;
                dataToSave.maxDezenas = 1;
                dataToSave.diasSorteio = [1]; // Fake
                dataToSave.horarioFechamento = '23:59';
            }

            const data = JogoSchema.parse(dataToSave);

            // Restaurar dados reais se o schema for muito rígido
            // Mas no nosso caso, queremos salvar isso mesmo.

            onSave(data);
            // Close é chamado pelo pai após sucesso
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const newErrors: Record<string, string> = {};
                error.issues.forEach((err: any) => {
                    if (err.path[0]) {
                        newErrors[err.path[0].toString()] = err.message;
                    }
                });
                setErrors(newErrors);
            }
        }
    };

    const toggleDia = (diaId: number) => {
        setFormData(prev => {
            const currentDias = prev.diasSorteio || [];
            if (currentDias.includes(diaId)) {
                return { ...prev, diasSorteio: currentDias.filter(d => d !== diaId) };
            } else {
                return { ...prev, diasSorteio: [...currentDias, diaId].sort() };
            }
        });
    };

    const handleSelectLoteria = (slug: string) => {
        const config = LOTERIAS_OFFICIAL[slug];
        if (config) {
            setFormData(prev => ({
                ...prev,
                slug,
                nome: config.nome,
                cor: config.cor,
                corDestaque: config.corDestaque,
                icone: 'clover'
            }));
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container animate-in fade-in zoom-in-95" style={{
                width: '100%',
                maxWidth: 600,
                background: 'var(--bg-card)',
                borderRadius: 24,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh'
            }}>
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {produtoEditar ? 'Editar Produto' : 'Novo Produto'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* 1. Seleção de Categoria */}
                    <div className="form-group">
                        <label className="text-xs font-bold uppercase text-text-muted mb-2 block">Categoria do Produto</label>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {categorias.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFormData(prev => ({ ...prev, categoriaId: cat.id }))}
                                    className={`btn btn-sm ${formData.categoriaId === cat.id ? 'btn-neutral' : 'btn-ghost border border-border'}`}
                                >
                                    {cat.nome}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Campos Específicos de LOTERIA */}
                    {isLoteria ? (
                        <>
                            <div className="section-group">
                                <label className="section-label">Configuração da Loteria</label>
                                <div className="form-group mb-4">
                                    <label>Loteria Oficial (Base)</label>
                                    <select
                                        className="input"
                                        value={formData.slug || ''}
                                        onChange={e => handleSelectLoteria(e.target.value)}
                                    >
                                        <option value="">Personalizada / Outra</option>
                                        {Object.entries(LOTERIAS_OFFICIAL).map(([slug, config]) => (
                                            <option key={slug} value={slug}>{config.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Nome de Exibição</label>
                                    <input
                                        className="input"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                        placeholder="Ex: Mega da Virada"
                                    />
                                    {errors.nome && <span className="error-text">{errors.nome}</span>}
                                </div>
                            </div>

                            <div className="section-group">
                                <label className="section-label">Regras do Jogo</label>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="form-group">
                                        <label>Mín. Dezenas</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={formData.minDezenas}
                                            onChange={e => setFormData({ ...formData, minDezenas: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Máx. Dezenas</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={formData.maxDezenas}
                                            onChange={e => setFormData({ ...formData, maxDezenas: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group mb-4">
                                    <label>Dias de Sorteio</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {DIAS_SEMANA.map(dia => {
                                            const isSelected = formData.diasSorteio?.includes(dia.id);
                                            return (
                                                <button
                                                    key={dia.id}
                                                    onClick={() => toggleDia(dia.id)}
                                                    className={`
                                                        w-8 h-8 rounded-lg text-xs font-bold transition-all
                                                        ${isSelected
                                                            ? 'bg-primary text-white shadow-md transform scale-105'
                                                            : 'bg-surface-subtle text-text-muted hover:bg-surface-hover'
                                                        }
                                                    `}
                                                    style={isSelected ? { backgroundColor: formData.cor } : {}}
                                                >
                                                    {dia.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Horário de Fechamento</label>
                                    <input
                                        type="time"
                                        className="input w-32"
                                        value={formData.horarioFechamento}
                                        onChange={e => setFormData({ ...formData, horarioFechamento: e.target.value })}
                                    />
                                    <p className="text-[10px] text-text-muted mt-1">Limite para vendas de cotas.</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* 3. Campos para OUTROS (Raspadinhas, Físicos) */
                        <>
                            <div className="section-group">
                                <label className="section-label">Detalhes do Produto</label>
                                <div className="form-group mb-4">
                                    <label>Nome do Produto</label>
                                    <input
                                        className="input"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                        placeholder="Ex: Raspadinha Super Sorte"
                                    />
                                    {errors.nome && <span className="error-text">{errors.nome}</span>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label>Preço Padrão (R$)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input pl-8"
                                                value={formData.precoPadrao}
                                                onChange={e => setFormData({ ...formData, precoPadrao: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Cor de Identificação</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="color"
                                                value={formData.cor}
                                                onChange={e => setFormData({ ...formData, cor: e.target.value })}
                                                className="w-10 h-10 rounded overflow-hidden cursor-pointer border-none p-0 bg-transparent"
                                            />
                                            <span className="text-xs text-text-muted">{formData.cor}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="section-group">
                                <label className="section-label">Estoque & Controle</label>
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            checked={formData.gerenciaEstoque}
                                            onChange={e => setFormData({ ...formData, gerenciaEstoque: e.target.checked })}
                                        />
                                        <div>
                                            <span className="label-text font-bold block">Gerenciar Estoque</span>
                                            <span className="label-text-alt text-text-muted">Exige controle de entrada/saída em cada filial</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                </div>

                <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '1rem'
                }}>
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        style={{ background: isLoteria ? `linear-gradient(135deg, ${formData.cor} 0%, ${formData.cor}dd 100%)` : undefined }}
                    >
                        <Check size={18} /> Salvar {isLoteria ? 'Jogo' : 'Produto'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .section-label {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 1rem;
                    display: block;
                }
                .section-group {
                    padding: 1.5rem;
                    background: var(--surface-subtle);
                    border-radius: 12px;
                    border: 1px solid var(--border);
                }
                .error-text {
                    color: var(--danger);
                    font-size: 0.75rem;
                    margin-top: 0.25rem;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
            `}</style>
        </div>
    );
}



