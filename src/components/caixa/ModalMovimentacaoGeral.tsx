'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Wallet,
    Smartphone,
    Check,
    AlertCircle,
    Loader2,
    TrendingUp,
    TrendingDown
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
    icone: string;
    ativo: boolean;
    ordem: number;
}

interface ModalMovimentacaoGeralProps {
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

export function ModalMovimentacaoGeral({ onClose, onSave }: ModalMovimentacaoGeralProps) {
    const supabase = createBrowserSupabaseClient();
    const { lojaAtual } = useLoja();

    const [categorias, setCategorias] = useState<CategoriaOperacional[]>([]);
    const [loadingCategorias, setLoadingCategorias] = useState(true);
    const [categoriaSelecionada, setCategoriaSelecionada] = useState<CategoriaOperacional | null>(null);
    const [valor, setValor] = useState<number>(0);
    const [observacao, setObservacao] = useState('');
    const [metodo, setMetodo] = useState<string>('dinheiro');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        carregarCategorias();
    }, [lojaAtual]);

    const carregarCategorias = async () => {
        if (!lojaAtual) return;
        setLoadingCategorias(true);
        try {
            const { data, error } = await supabase
                .from('categorias_operacionais')
                .select('*')
                .eq('empresa_id', lojaAtual.id)
                .eq('ativo', true)
                .order('tipo', { ascending: true })
                .order('ordem', { ascending: true });

            if (error) throw error;
            setCategorias(data || []);
        } catch (error: any) {
            console.error('Erro ao carregar categorias:', error);
            setError('Erro ao carregar categorias. Tente novamente.');
        } finally {
            setLoadingCategorias(false);
        }
    };

    const handleSave = async () => {
        if (!valor || valor <= 0) {
            setError('Informe um valor valido maior que zero.');
            return;
        }

        if (!categoriaSelecionada) {
            setError('Selecione uma categoria para a movimentacao.');
            return;
        }

        setError(null);
        setIsSaving(true);

        try {
            const dados = {
                tipo: categoriaSelecionada.tipo === 'entrada' ? 'venda' : 'sangria',
                valor,
                metodo,
                observacao: `[${categoriaSelecionada.nome}] ${observacao}`.trim(),
                categoria_operacional_id: categoriaSelecionada.id,
                data: new Date().toISOString()
            };

            await onSave(dados);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar lancamento. Tente novamente.');
            setIsSaving(false);
        }
    };

    const categoriasEntrada = categorias.filter(c => c.tipo === 'entrada');
    const categoriasSaida = categorias.filter(c => c.tipo === 'saida');

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
                boxShadow: 'none',
                zIndex: 9999,
                overflow: 'hidden',
                maxHeight: '90vh'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                    background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), transparent)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Movimentacoes Gerais</h2>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 4 }} disabled={isSaving}><X size={20} /></button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: 'calc(90vh - 180px)', overflowY: 'auto' }}>
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
                            gap: '0.5rem'
                        }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {loadingCategorias ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="animate-spin text-primary" size={24} />
                        </div>
                    ) : (
                        <>
                            {/* Categorias de Entrada */}
                            <div className="form-group">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp size={16} className="text-success" />
                                    <label className="text-xs font-bold uppercase text-success">Entradas</label>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {categoriasEntrada.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategoriaSelecionada(cat)}
                                            disabled={isSaving}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: '12px',
                                                border: '2px solid',
                                                borderColor: categoriaSelecionada?.id === cat.id ? cat.cor : 'var(--border)',
                                                background: categoriaSelecionada?.id === cat.id ? `${cat.cor}20` : 'var(--bg-dark)',
                                                color: categoriaSelecionada?.id === cat.id ? cat.cor : 'var(--text-secondary)',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textAlign: 'left',
                                                transition: 'all 0.2s',
                                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                                opacity: isSaving ? 0.5 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                {cat.nome}
                                                {categoriaSelecionada?.id === cat.id && <Check size={14} />}
                                            </div>
                                            {cat.descricao && (
                                                <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.7 }}>
                                                    {cat.descricao}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Categorias de Saida */}
                            <div className="form-group">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingDown size={16} className="text-danger" />
                                    <label className="text-xs font-bold uppercase text-danger">Saidas</label>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {categoriasSaida.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategoriaSelecionada(cat)}
                                            disabled={isSaving}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: '12px',
                                                border: '2px solid',
                                                borderColor: categoriaSelecionada?.id === cat.id ? cat.cor : 'var(--border)',
                                                background: categoriaSelecionada?.id === cat.id ? `${cat.cor}20` : 'var(--bg-dark)',
                                                color: categoriaSelecionada?.id === cat.id ? cat.cor : 'var(--text-secondary)',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textAlign: 'left',
                                                transition: 'all 0.2s',
                                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                                opacity: isSaving ? 0.5 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                {cat.nome}
                                                {categoriaSelecionada?.id === cat.id && <Check size={14} />}
                                            </div>
                                            {cat.descricao && (
                                                <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.7 }}>
                                                    {cat.descricao}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {categoriaSelecionada && (
                                <>
                                    <div className="form-group">
                                        <label style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Valor</label>
                                        <MoneyInput
                                            autoFocus
                                            value={valor}
                                            onValueChange={setValor}
                                            className="text-xl font-bold h-[60px]"
                                            placeholder="0,00"
                                            disabled={isSaving}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Forma de Pagamento</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <button
                                                onClick={() => setMetodo('dinheiro')}
                                                disabled={isSaving}
                                                style={{
                                                    padding: '0.75rem',
                                                    borderRadius: '12px',
                                                    border: '1px solid',
                                                    borderColor: metodo === 'dinheiro' ? 'var(--primary)' : 'var(--border)',
                                                    background: metodo === 'dinheiro' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                    color: metodo === 'dinheiro' ? 'var(--primary)' : 'var(--text-muted)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    transition: 'all 0.2s',
                                                    opacity: isSaving ? 0.5 : 1,
                                                    cursor: isSaving ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                <Wallet size={16} /> Dinheiro
                                            </button>
                                            <button
                                                onClick={() => setMetodo('pix')}
                                                disabled={isSaving}
                                                style={{
                                                    padding: '0.75rem',
                                                    borderRadius: '12px',
                                                    border: '1px solid',
                                                    borderColor: metodo === 'pix' ? 'var(--success)' : 'var(--border)',
                                                    background: metodo === 'pix' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                                                    color: metodo === 'pix' ? 'var(--success)' : 'var(--text-muted)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    transition: 'all 0.2s',
                                                    opacity: isSaving ? 0.5 : 1,
                                                    cursor: isSaving ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                <Smartphone size={16} /> PIX
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Observacao (Opcional)</label>
                                        <textarea
                                            className="input"
                                            rows={2}
                                            value={observacao}
                                            onChange={(e) => setObservacao(e.target.value)}
                                            placeholder="Algum detalhe importante?"
                                            style={{ resize: 'none' }}
                                            disabled={isSaving}
                                        />
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSave}
                                        disabled={!valor || valor <= 0 || isSaving}
                                        style={{
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
                        </>
                    )}
                </div>

                <div style={{ padding: '0.75rem 1.5rem', background: 'var(--surface-subtle)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} className="flex items-center justify-center gap-1">
                        <AlertCircle size={12} /> Este lancamento sera registrado imediatamente no fluxo de hoje.
                    </p>
                </div>
            </div>
        </>
    );
}
