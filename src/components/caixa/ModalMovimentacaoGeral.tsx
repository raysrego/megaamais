'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Check,
    AlertCircle,
    Loader2,
    TrendingUp,
    TrendingDown,
    Calendar
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useLoja } from '@/contexts/LojaContext';

interface CategoriaOperacional {
    id: number;
    nome: string;
    tipo: 'entrada' | 'saida';
    descricao: string | null;
    cor: string;
}

interface ModalMovimentacaoGeralProps {
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

export function ModalMovimentacaoGeral({ onClose, onSave }: ModalMovimentacaoGeralProps) {
    const supabase = createBrowserSupabaseClient();
    const { lojaAtual } = useLoja();

    const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
    const [categorias, setCategorias] = useState<CategoriaOperacional[]>([]);
    const [categoriaSelecionada, setCategoriaSelecionada] = useState<number | null>(null);
    const [valor, setValor] = useState<number>(0);
    const [data, setData] = useState<string>(new Date().toISOString().split('T')[0]);
    const [descricao, setDescricao] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        carregarCategorias();
    }, [tipo, lojaAtual]);

    const carregarCategorias = async () => {
        if (!lojaAtual) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('categorias_operacionais')
                .select('id, nome, tipo, descricao, cor')
                .eq('empresa_id', lojaAtual.id)
                .eq('tipo', tipo)
                .eq('ativo', true)
                .order('ordem', { ascending: true });

            if (error) throw error;
            setCategorias(data || []);
            setCategoriaSelecionada(null);
        } catch (error: any) {
            console.error('Erro ao carregar categorias:', error);
            setError('Erro ao carregar categorias');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!valor || valor <= 0) {
            setError('Informe um valor valido maior que zero');
            return;
        }

        if (!categoriaSelecionada) {
            setError('Selecione uma categoria');
            return;
        }

        setError(null);
        setIsSaving(true);

        try {
            const categoria = categorias.find(c => c.id === categoriaSelecionada);
            const dados = {
                tipo: tipo === 'entrada' ? 'venda' : 'sangria',
                valor: tipo === 'saida' ? -Math.abs(valor) : Math.abs(valor),
                metodo_pagamento: 'dinheiro',
                descricao: descricao || categoria?.nome || '',
                categoria_operacional_id: categoriaSelecionada,
                data: new Date(data).toISOString()
            };

            await onSave(dados);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar lancamento');
            setIsSaving(false);
        }
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-heavy)', zIndex: 9998 }} />
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '95%',
                maxWidth: 600,
                background: 'var(--bg-card)',
                borderRadius: 20,
                border: '1px solid var(--border)',
                zIndex: 9999,
                maxHeight: '90vh',
                overflow: 'auto'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                    background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), transparent)'
                }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Movimentacoes Gerais</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isSaving}><X size={20} /></button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 8,
                            color: 'var(--danger)',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1rem'
                        }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Tipo de Movimentacao */}
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            Tipo de Movimentacao
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <button
                                onClick={() => setTipo('entrada')}
                                disabled={isSaving}
                                style={{
                                    padding: '0.875rem',
                                    borderRadius: '12px',
                                    border: '2px solid',
                                    borderColor: tipo === 'entrada' ? '#22c55e' : 'var(--border)',
                                    background: tipo === 'entrada' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-dark)',
                                    color: tipo === 'entrada' ? '#22c55e' : 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    transition: 'all 0.2s',
                                    cursor: isSaving ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <TrendingUp size={18} /> Entrada
                            </button>
                            <button
                                onClick={() => setTipo('saida')}
                                disabled={isSaving}
                                style={{
                                    padding: '0.875rem',
                                    borderRadius: '12px',
                                    border: '2px solid',
                                    borderColor: tipo === 'saida' ? '#ef4444' : 'var(--border)',
                                    background: tipo === 'saida' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-dark)',
                                    color: tipo === 'saida' ? '#ef4444' : 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    transition: 'all 0.2s',
                                    cursor: isSaving ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <TrendingDown size={18} /> Saida
                            </button>
                        </div>
                    </div>

                    {/* Categoria */}
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            Categoria
                        </label>
                        {loading ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                {categorias.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategoriaSelecionada(cat.id)}
                                        disabled={isSaving}
                                        style={{
                                            padding: '0.875rem',
                                            borderRadius: '12px',
                                            border: '2px solid',
                                            borderColor: categoriaSelecionada === cat.id ? cat.cor : 'var(--border)',
                                            background: categoriaSelecionada === cat.id ? `${cat.cor}20` : 'var(--bg-dark)',
                                            color: categoriaSelecionada === cat.id ? cat.cor : 'var(--text-secondary)',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            textAlign: 'left',
                                            transition: 'all 0.2s',
                                            cursor: isSaving ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div>
                                            <div>{cat.nome}</div>
                                            {cat.descricao && (
                                                <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.7 }}>
                                                    {cat.descricao}
                                                </div>
                                            )}
                                        </div>
                                        {categoriaSelecionada === cat.id && <Check size={16} />}
                                    </button>
                                ))}
                                {categorias.length === 0 && (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Nenhuma categoria cadastrada para {tipo}s
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {categoriaSelecionada && (
                        <>
                            {/* Valor */}
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                    Valor
                                </label>
                                <MoneyInput
                                    autoFocus
                                    value={valor}
                                    onValueChange={setValor}
                                    className="text-xl font-bold h-[60px]"
                                    placeholder="0,00"
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Data */}
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                    Data
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="date"
                                        className="input"
                                        style={{ paddingLeft: '3rem', height: '48px' }}
                                        value={data}
                                        onChange={(e) => setData(e.target.value)}
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>

                            {/* Descricao */}
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                    Descricao (Opcional)
                                </label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Adicione detalhes sobre esta movimentacao"
                                    style={{ resize: 'none' }}
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Botao Salvar */}
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={!valor || valor <= 0 || isSaving}
                                style={{
                                    width: '100%',
                                    height: '56px',
                                    fontSize: '1rem'
                                }}
                            >
                                {isSaving ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Loader2 size={20} className="animate-spin" /> Salvando...
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Check size={20} /> Confirmar Lancamento
                                    </span>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
