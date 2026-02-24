'use client';

import { useState, useEffect } from 'react';
import { useLoja } from '@/contexts/LojaContext';
import { usePerfil } from '@/hooks/usePerfil';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useToast } from '@/contexts/ToastContext';
import {
    Building,
    Plus,
    MapPin,
    FileText,
    Loader2,
    CheckCircle2,
    X,
    MoreVertical,
    Search,
    Edit3,
    Power,
    ChevronLeft,
    Users,
    AlertCircle,
    LayoutGrid
} from 'lucide-react';

interface Grupo {
    id: string;
    nome: string;
    ativo: boolean;
    created_at?: string;
}

interface EmpresaFull {
    id: string;
    nome_fantasia: string;
    razao_social: string | null;
    cnpj: string | null;
    endereco: string | null;
    endereco_cidade: string | null;
    endereco_uf: string | null;
    ativo: boolean;
    grupo_id: string;
    // Legado/Fallback
    cidade?: string | null;
    estado?: string | null;
}

export function GestaoGruposEmpresas() {
    const { lojaAtual } = useLoja();
    const { toast } = useToast();
    const supabase = createBrowserSupabaseClient();

    const [view, setView] = useState<'grupos' | 'filiais'>('grupos');
    const [selectedGroup, setSelectedGroup] = useState<Grupo | null>(null);

    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [filiais, setFiliais] = useState<EmpresaFull[]>([]);

    const [loading, setLoading] = useState(true);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isFilialModalOpen, setIsFilialModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form States
    const [groupFormData, setGroupFormData] = useState({
        nome: '',
        ativo: true
    });

    const [filialFormData, setFilialFormData] = useState({
        nome_fantasia: '',
        razao_social: '',
        cnpj: '',
        endereco: '',
        cidade: '',
        estado: '',
        ativo: true
    });

    const fetchGrupos = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('grupos')
                .select('*')
                .order('nome');

            if (error) {
                console.error('Erro em fetchGrupos:', error);
                throw error;
            }

            setGrupos(data || []);

        } catch (error) {
            console.error('Erro ao buscar grupos:', error);
            if (lojaAtual?.grupo_id) {
                setGrupos([{
                    id: lojaAtual.grupo_id,
                    nome: 'Mega Bolões Brasil',
                    ativo: true
                }]);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchFiliais = async (grupoId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('empresas')
                .select('*')
                .eq('grupo_id', grupoId)
                .order('nome_fantasia');

            if (error) throw error;
            setFiliais(data || []);
        } catch (error) {
            console.error('Erro ao buscar filiais:', error);
            toast({ message: 'Erro ao carregar filiais', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGrupos();
    }, []);

    // Handlers para Grupos
    const handleOpenGroupModal = (grupo?: Grupo) => {
        if (grupo) {
            setEditingId(grupo.id);
            setGroupFormData({ nome: grupo.nome, ativo: grupo.ativo });
        } else {
            setEditingId(null);
            setGroupFormData({ nome: '', ativo: true });
        }
        setIsGroupModalOpen(true);
    };

    const handleGroupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupFormData.nome) return;

        setSaving(true);
        try {
            let error;
            if (editingId) {
                const { error: err } = await supabase
                    .from('grupos')
                    .update(groupFormData)
                    .eq('id', editingId);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('grupos')
                    .insert(groupFormData);
                error = err;
            }

            if (error) throw error;
            toast({ message: editingId ? 'Grupo atualizado!' : 'Grupo criado!', type: 'success' });
            setIsGroupModalOpen(false);
            fetchGrupos();
        } catch (err) {
            toast({ message: 'Erro ao salvar grupo', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Handlers para Filiais
    const handleOpenFilialModal = (filial?: EmpresaFull) => {
        if (filial) {
            setEditingId(filial.id);
            setFilialFormData({
                nome_fantasia: filial.nome_fantasia,
                razao_social: filial.razao_social || '',
                cnpj: filial.cnpj || '',
                endereco: filial.endereco || '',
                cidade: filial.endereco_cidade || filial.cidade || '',
                estado: filial.endereco_uf || filial.estado || '',
                ativo: filial.ativo
            });
        } else {
            setEditingId(null);
            setFilialFormData({
                nome_fantasia: '',
                razao_social: '',
                cnpj: '',
                endereco: '',
                cidade: '',
                estado: '',
                ativo: true
            });
        }
        setIsFilialModalOpen(true);
    };

    const handleFilialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroup) return;

        setSaving(true);
        try {
            // Mapeamento COMPLETO (v4) para a tabela 'empresas'
            // Requer que a migration 20260213170000_add_endereco_columns.sql tenha sido rodada

            const payload = {
                nome_fantasia: filialFormData.nome_fantasia,
                nome: filialFormData.razao_social,
                cnpj: filialFormData.cnpj.replace(/\D/g, ''),
                endereco: filialFormData.endereco,
                endereco_cidade: filialFormData.cidade,
                endereco_uf: filialFormData.estado,
                ativo: filialFormData.ativo,
                grupo_id: selectedGroup.id
            };

            // Log para debug


            let error;
            if (editingId) {
                const { error: err } = await supabase
                    .from('empresas')
                    .update(payload)
                    .eq('id', editingId);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('empresas')
                    .insert(payload);
                error = err;
            }

            if (error) throw error;
            toast({ message: editingId ? 'Filial atualizada!' : 'Filial criada!', type: 'success' });
            setIsFilialModalOpen(false);
            fetchFiliais(selectedGroup.id);
        } catch (err) {
            console.error('CRITICAL ERROR SAVING FILIAL:', err);
            // @ts-ignore
            if (err?.message) console.error('Error Message:', err.message);
            // @ts-ignore
            if (err?.details) console.error('Error Details:', err.details);
            // @ts-ignore
            if (err?.hint) console.error('Error Hint:', err.hint);

            toast({ message: 'Erro ao salvar filial. Verifique o console.', type: 'error' });
        } finally {

            setSaving(false);
        }
    };

    const enterGroup = (grupo: Grupo) => {
        setSelectedGroup(grupo);
        setView('filiais');
        fetchFiliais(grupo.id);
    };

    const backToGroups = () => {
        setView('grupos');
        setSelectedGroup(null);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Dinâmico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3">
                        {view === 'filiais' && (
                            <button
                                onClick={backToGroups}
                                className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                            {view === 'grupos' ? <Users className="text-blue-500" size={24} /> : <Building className="text-blue-500" size={24} />}
                            {view === 'grupos' ? 'Grupos Empresariais' : selectedGroup?.nome}
                        </h2>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mt-1 ml-0 md:ml-2">
                        {view === 'grupos'
                            ? 'Gerencie as holdings e grupos de loterias'
                            : `Gestão de filiais para ${selectedGroup?.nome}`}
                    </p>
                </div>

                <button
                    onClick={() => view === 'grupos' ? handleOpenGroupModal() : handleOpenFilialModal()}
                    className="btn btn-primary px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2"
                >
                    <Plus size={16} />
                    {view === 'grupos' ? 'Novo Grupo' : 'Nova Filial'}
                </button>
            </div>

            {/* View de Grupos */}
            {view === 'grupos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-40 bg-muted/20 rounded-3xl animate-pulse" />)
                    ) : (
                        grupos.map(grupo => (
                            <div key={grupo.id} className="group bg-card border border-border rounded-3xl p-6 hover:border-blue-500/30 transition-all duration-300 relative overflow-hidden">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                        <Users size={24} />
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleOpenGroupModal(grupo)}
                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-lg font-black text-foreground mb-1 group-hover:text-blue-500 transition-colors">{grupo.nome}</h3>
                                <p className="text-xs text-muted-foreground font-medium mb-4">Grupo Identificado: {grupo.id.substring(0, 8)}...</p>

                                <button
                                    onClick={() => enterGroup(grupo)}
                                    className="w-full py-2.5 bg-muted/50 hover:bg-blue-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Ver Filiais
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* View de Filiais (Mesma lógica de antes, mas vinculada ao grupo selecionado) */}
            {view === 'filiais' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-40 bg-muted/20 rounded-3xl animate-pulse" />)
                    ) : filiais.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-3xl bg-muted/10">
                            <Building size={48} className="text-muted-foreground opacity-30 mb-4" />
                            <p className="text-muted-foreground font-medium">Nenhuma filial cadastrada neste grupo.</p>
                            <button onClick={() => handleOpenFilialModal()} className="mt-4 text-xs font-black text-blue-500 uppercase">Adicionar Primeira Filial</button>
                        </div>
                    ) : (
                        filiais.map(filial => (
                            <div key={filial.id} className="group bg-card border border-border rounded-3xl p-6 hover:border-blue-500/30 transition-all duration-300 relative overflow-hidden">
                                <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${filial.ativo ? 'bg-[#1DB954]/10 text-[#1DB954]' : 'bg-red-500/10 text-red-500'}`}>
                                    {filial.ativo ? 'Ativa' : 'Inativa'}
                                </div>

                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <Building size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-base font-black text-foreground truncate">{filial.nome_fantasia}</h3>
                                            <button onClick={() => handleOpenFilialModal(filial)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><Edit3 size={16} /></button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground truncate">{filial.razao_social || filial.nome_fantasia}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                                        <FileText size={14} className="text-muted-foreground" />
                                        <span className="text-[10px] font-mono font-bold">{filial.cnpj || 'Sem CNPJ'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                                        <MapPin size={14} className="text-muted-foreground" />
                                        <span className="text-[10px] font-medium truncate">{filial.endereco_cidade || filial.cidade || 'Cidade não inf.'}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal de Grupo */}
            {isGroupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-sm rounded-3xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-lg font-black">{editingId ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                            <button onClick={() => setIsGroupModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleGroupSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-muted-foreground">Nome do Grupo</label>
                                <input
                                    value={groupFormData.nome}
                                    onChange={e => setGroupFormData({ ...groupFormData, nome: e.target.value })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold"
                                    placeholder="Ex: Mega Bolões Brasil"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsGroupModalOpen(false)} className="px-4 py-2 text-xs font-bold text-muted-foreground">Cancelar</button>
                                <button type="submit" disabled={saving} className="btn btn-primary px-6 py-2 rounded-xl text-xs font-black uppercase">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar Grupo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Filial (Similar ao anterior) */}
            {isFilialModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg rounded-3xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Building size={18} className="text-blue-500" />
                                {editingId ? 'Editar Filial' : 'Nova Filial'}
                            </h3>
                            <button onClick={() => setIsFilialModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleFilialSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-12 space-y-1.5">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Nome Fantasia *</label>
                                    <input value={filialFormData.nome_fantasia} onChange={e => setFilialFormData({ ...filialFormData, nome_fantasia: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold" required />
                                </div>
                                <div className="col-span-6 space-y-1.5">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground">CNPJ *</label>
                                    <input value={filialFormData.cnpj} onChange={e => setFilialFormData({ ...filialFormData, cnpj: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono font-bold" required />
                                </div>
                                <div className="col-span-6 space-y-1.5">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Cidade</label>
                                    <input value={filialFormData.cidade} onChange={e => setFilialFormData({ ...filialFormData, cidade: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium" />
                                </div>
                                <div className="col-span-9 space-y-1.5">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Endereço</label>
                                    <input value={filialFormData.endereco} onChange={e => setFilialFormData({ ...filialFormData, endereco: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium" placeholder="Rua, Número, Bairro" />
                                </div>
                                <div className="col-span-3 space-y-1.5">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground">UF</label>
                                    <input value={filialFormData.estado} onChange={e => setFilialFormData({ ...filialFormData, estado: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold uppercase" maxLength={2} placeholder="UF" />
                                </div>

                                {editingId && (
                                    <div className="col-span-12 p-4 bg-muted/20 rounded-2xl border border-border flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Power size={18} className={filialFormData.ativo ? 'text-green-500' : 'text-red-500'} />
                                            <p className="text-xs font-black">Status Operacional</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm('Alterar status desta unidade?')) {
                                                    setFilialFormData({ ...filialFormData, ativo: !filialFormData.ativo });
                                                }
                                            }}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${filialFormData.ativo ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                                        >
                                            {filialFormData.ativo ? 'Ativa' : 'Inativa'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-border">
                                <button type="button" onClick={() => setIsFilialModalOpen(false)} className="px-4 py-2 text-xs font-bold text-muted-foreground">Cancelar</button>
                                <button type="submit" disabled={saving} className="btn btn-primary px-8 py-2 rounded-xl text-xs font-black uppercase">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar Unidade'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
