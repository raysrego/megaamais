'use client';

import { useState } from 'react';
import {
    Monitor,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Edit,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Loader2,
    MonitorOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTerminais, Terminal } from '@/hooks/useTerminais';
import { ModalTerminal } from '@/components/cadastros/ModalTerminal';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';

export default function TerminaisPage() {
    const {
        terminais,
        loading,
        isPending,
        addTerminal,
        updateTerminal,
        deleteTerminal,
        addOptimisticTerminal,
        startTransition
    } = useTerminais();
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);

    const confirm = useConfirm();
    const { toast } = useToast();

    const filteredTerminais = terminais.filter(t =>
        t.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = async (data: Omit<Terminal, 'id' | 'created_at'>) => {
        startTransition(async () => {
            if (selectedTerminal) {
                addOptimisticTerminal({ type: 'update', payload: { id: selectedTerminal.id, updates: data } });
                setShowModal(false);
                try {
                    await updateTerminal(selectedTerminal.id, data);
                    toast({ message: 'Terminal atualizado com sucesso!', type: 'success' });
                } catch (error: any) {
                    toast({ message: 'Erro ao salvar terminal: ' + error.message, type: 'error' });
                }
            } else {
                addOptimisticTerminal({ type: 'add', payload: data });
                setShowModal(false);
                try {
                    await addTerminal(data);
                    toast({ message: 'Terminal cadastrado com sucesso!', type: 'success' });
                } catch (error: any) {
                    toast({ message: 'Erro ao salvar terminal: ' + error.message, type: 'error' });
                }
            }
        });
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: 'Excluir Terminal',
            description: 'Deseja realmente excluir este terminal?',
            variant: 'danger',
            confirmLabel: 'Excluir'
        });

        if (confirmed) {
            startTransition(async () => {
                addOptimisticTerminal({ type: 'delete', payload: id });
                try {
                    await deleteTerminal(id);
                    toast({ message: 'Terminal excluído com sucesso!', type: 'success' });
                } catch (error: any) {
                    toast({ message: 'Erro ao excluir terminal: ' + error.message, type: 'error' });
                }
            });
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'ativo': return <CheckCircle2 size={16} className="text-success" />;
            case 'manutencao': return <AlertTriangle size={16} className="text-warning" />;
            case 'inativo': return <XCircle size={16} className="text-danger" />;
            default: return null;
        }
    };

    return (
        <div className="dashboard-content">
            <PageHeader
                title="Terminais TFL"
            />

            <div className="flex justify-end mb-6">
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary"
                    onClick={() => { setSelectedTerminal(null); setShowModal(true); }}
                >
                    <Plus size={18} /> Novo Terminal
                </motion.button>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2rem' }}>
                <div className="kpi-card ">
                    <span className="kpi-label uppercase text-[10px] font-black text-muted">Total de Terminais</span>
                    <div className="kpi-value">{terminais.length}</div>
                </div>
                <div className="kpi-card ">
                    <span className="kpi-label uppercase text-[10px] font-black text-success">Ativos</span>
                    <div className="kpi-value text-success">{terminais.filter(t => t.status === 'ativo').length}</div>
                </div>
                <div className="kpi-card ">
                    <span className="kpi-label uppercase text-[10px] font-black text-warning">Manutenção</span>
                    <div className="kpi-value text-warning">{terminais.filter(t => t.status === 'manutencao').length}</div>
                </div>
                <div className="kpi-card ">
                    <span className="kpi-label uppercase text-[10px] font-black text-danger">Inativos</span>
                    <div className="kpi-value text-danger">{terminais.filter(t => t.status === 'inativo').length}</div>
                </div>
            </div>

            <div className="card ">
                <div className="flex items-center justify-between mb-6 gap-4">
                    <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="input"
                            placeholder="Buscar por código ou descrição..."
                            style={{ paddingLeft: '3rem' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-ghost">
                        <Filter size={18} className="mr-2" /> Filtros
                    </button>
                </div>

                <div className="table-container pt-0" style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                    {loading ? (
                        <LoadingState type="list" />
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Cód. Terminal</th>
                                    <th>Descrição / Local</th>
                                    <th>Modelo</th>
                                    <th>Status</th>
                                    <th>Cadastro</th>
                                    <th style={{ width: '80px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTerminais.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12">
                                            <EmptyState
                                                icon={MonitorOff}
                                                title="Nenhum terminal encontrado"
                                                description="Tente ajustar sua busca ou cadastrar um novo terminal TFL."
                                                actionLabel="Cadastrar Terminal"
                                                onAction={() => { setSelectedTerminal(null); setShowModal(true); }}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {filteredTerminais.map((t, index) => (
                                            <motion.tr
                                                key={t.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                                className="hover:bg-white/2"
                                            >
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <div style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                                                            <Monitor size={14} className="text-muted" />
                                                        </div>
                                                        <span className="font-black text-primary-light">{t.codigo}</span>
                                                    </div>
                                                </td>
                                                <td className="text-sm">{t.descricao || '---'}</td>
                                                <td className="text-xs font-bold text-muted uppercase">{t.modelo || 'Genérico'}</td>
                                                <td>
                                                    <div className="flex items-center gap-1.5">
                                                        {getStatusIcon(t.status)}
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${t.status === 'ativo' ? 'text-success' : t.status === 'manutencao' ? 'text-warning' : 'text-danger'}`}>
                                                            {t.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-[10px] text-muted">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            className="btn btn-ghost btn-xs p-1.5"
                                                            onClick={() => { setSelectedTerminal(t); setShowModal(true); }}
                                                            title="Editar"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-xs p-1.5 text-danger hover:bg-danger/10"
                                                            onClick={() => handleDelete(t.id)}
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {
                showModal && (
                    <ModalTerminal
                        terminal={selectedTerminal}
                        onClose={() => setShowModal(false)}
                        onSave={handleSave}
                    />
                )
            }
        </div >
    );
}

