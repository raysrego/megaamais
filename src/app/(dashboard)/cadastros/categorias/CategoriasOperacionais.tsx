'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
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

export function CategoriasOperacionais() {
    const supabase = createBrowserSupabaseClient();
    const { lojaAtual } = useLoja();

    const [categorias, setCategorias] = useState<CategoriaOperacional[]>([]);
    const [loading, setLoading] = useState(true);
    const [editando, setEditando] = useState<number | null>(null);
    const [criando, setCriando] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');

    const [formData, setFormData] = useState<Partial<CategoriaOperacional>>({
        nome: '',
        tipo: 'entrada',
        descricao: '',
        cor: '#6b7280',
        icone: 'DollarSign',
        ativo: true,
        ordem: 0
    });

    useEffect(() => {
        carregarCategorias();
    }, [lojaAtual]);

    const carregarCategorias = async () => {
        if (!lojaAtual) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('categorias_operacionais')
                .select('*')
                .eq('empresa_id', lojaAtual.id)
                .order('tipo', { ascending: true })
                .order('ordem', { ascending: true });

            if (error) throw error;
            setCategorias(data || []);
        } catch (error: any) {
            alert(`Erro ao carregar categorias: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSalvar = async () => {
        if (!lojaAtual || !formData.nome || !formData.tipo) {
            alert('Preencha todos os campos obrigatorios');
            return;
        }

        try {
            if (editando) {
                const { error } = await supabase
                    .from('categorias_operacionais')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editando);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('categorias_operacionais')
                    .insert({
                        ...formData,
                        empresa_id: lojaAtual.id
                    });

                if (error) throw error;
            }

            setEditando(null);
            setCriando(false);
            setFormData({
                nome: '',
                tipo: 'entrada',
                descricao: '',
                cor: '#6b7280',
                icone: 'DollarSign',
                ativo: true,
                ordem: 0
            });
            carregarCategorias();
        } catch (error: any) {
            alert(`Erro ao salvar categoria: ${error.message}`);
        }
    };

    const handleEditar = (categoria: CategoriaOperacional) => {
        setFormData(categoria);
        setEditando(categoria.id);
        setCriando(false);
    };

    const handleDeletar = async (id: number) => {
        if (!confirm('Tem certeza que deseja deletar esta categoria?')) return;

        try {
            const { error } = await supabase
                .from('categorias_operacionais')
                .delete()
                .eq('id', id);

            if (error) throw error;
            carregarCategorias();
        } catch (error: any) {
            alert(`Erro ao deletar categoria: ${error.message}`);
        }
    };

    const handleCancelar = () => {
        setEditando(null);
        setCriando(false);
        setFormData({
            nome: '',
            tipo: 'entrada',
            descricao: '',
            cor: '#6b7280',
            icone: 'DollarSign',
            ativo: true,
            ordem: 0
        });
    };

    const categoriasFiltradas = categorias.filter(c => filtroTipo === 'todos' || c.tipo === filtroTipo);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Categorias Operacionais</h2>
                    <p className="text-sm text-muted mt-1">Gerencie as categorias de entrada e saida do caixa</p>
                </div>
                {!criando && !editando && (
                    <button
                        onClick={() => setCriando(true)}
                        className="btn btn-primary"
                    >
                        <Plus size={16} /> Nova Categoria
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFiltroTipo('todos')}
                    className={`btn btn-sm ${filtroTipo === 'todos' ? 'btn-primary' : 'btn-ghost'}`}
                >
                    Todas
                </button>
                <button
                    onClick={() => setFiltroTipo('entrada')}
                    className={`btn btn-sm ${filtroTipo === 'entrada' ? 'btn-primary' : 'btn-ghost'}`}
                >
                    <TrendingUp size={14} /> Entradas
                </button>
                <button
                    onClick={() => setFiltroTipo('saida')}
                    className={`btn btn-sm ${filtroTipo === 'saida' ? 'btn-primary' : 'btn-ghost'}`}
                >
                    <TrendingDown size={14} /> Saidas
                </button>
            </div>

            {/* Formulario de Criacao/Edicao */}
            {(criando || editando) && (
                <div className="card p-6 border-2 border-primary">
                    <h3 className="text-lg font-bold mb-4">
                        {editando ? 'Editar Categoria' : 'Nova Categoria'}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="text-xs font-bold uppercase text-muted mb-2 block">Nome *</label>
                            <input
                                type="text"
                                className="input w-full"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Ex: Recebimento PIX"
                            />
                        </div>

                        <div className="form-group">
                            <label className="text-xs font-bold uppercase text-muted mb-2 block">Tipo *</label>
                            <select
                                className="input w-full"
                                value={formData.tipo}
                                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'entrada' | 'saida' })}
                            >
                                <option value="entrada">Entrada</option>
                                <option value="saida">Saida</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="text-xs font-bold uppercase text-muted mb-2 block">Cor</label>
                            <input
                                type="color"
                                className="input w-full h-12"
                                value={formData.cor}
                                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="text-xs font-bold uppercase text-muted mb-2 block">Ordem</label>
                            <input
                                type="number"
                                className="input w-full"
                                value={formData.ordem}
                                onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                            />
                        </div>

                        <div className="form-group col-span-2">
                            <label className="text-xs font-bold uppercase text-muted mb-2 block">Descricao</label>
                            <textarea
                                className="input w-full"
                                rows={2}
                                value={formData.descricao || ''}
                                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                placeholder="Descricao da categoria"
                            />
                        </div>

                        <div className="form-group col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.ativo}
                                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                    className="w-5 h-5"
                                />
                                <span className="text-sm font-bold">Categoria Ativa</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button onClick={handleSalvar} className="btn btn-primary">
                            <Save size={16} /> Salvar
                        </button>
                        <button onClick={handleCancelar} className="btn btn-ghost">
                            <X size={16} /> Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de Categorias */}
            <div className="grid gap-3">
                {categoriasFiltradas.length === 0 ? (
                    <div className="card p-8 text-center text-muted">
                        Nenhuma categoria encontrada
                    </div>
                ) : (
                    categoriasFiltradas.map((categoria) => (
                        <div
                            key={categoria.id}
                            className="card p-4 flex items-center justify-between hover:bg-surface-subtle transition-colors"
                            style={{ borderLeft: `4px solid ${categoria.cor}` }}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: `${categoria.cor}20`, color: categoria.cor }}
                                >
                                    {categoria.tipo === 'entrada' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold">{categoria.nome}</h3>
                                        <span className={`badge text-xs ${categoria.tipo === 'entrada' ? 'success' : 'danger'}`}>
                                            {categoria.tipo}
                                        </span>
                                        {!categoria.ativo && (
                                            <span className="badge text-xs">Inativo</span>
                                        )}
                                    </div>
                                    {categoria.descricao && (
                                        <p className="text-xs text-muted mt-1">{categoria.descricao}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleEditar(categoria)}
                                    className="btn btn-ghost btn-sm"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => handleDeletar(categoria.id)}
                                    className="btn btn-ghost btn-sm text-danger"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
