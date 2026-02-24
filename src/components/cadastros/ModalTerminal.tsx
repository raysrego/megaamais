'use client';

import { useState, useEffect } from 'react';
import { X, Save, Monitor, AlertTriangle, Loader2 } from 'lucide-react';
import { Terminal } from '@/hooks/useTerminais';
import { useToast } from '@/contexts/ToastContext';

interface ModalTerminalProps {
    terminal?: Terminal | null;
    onClose: () => void;
    onSave: (data: Omit<Terminal, 'id' | 'created_at'>) => Promise<void>;
}

export function ModalTerminal({ terminal, onClose, onSave }: ModalTerminalProps) {
    const [formData, setFormData] = useState<Omit<Terminal, 'id' | 'created_at'>>({
        codigo: '',
        descricao: '',
        modelo: '',
        status: 'ativo'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (terminal) {
            setFormData({
                codigo: terminal.codigo,
                descricao: terminal.descricao,
                modelo: terminal.modelo,
                status: terminal.status
            });
        }
    }, [terminal]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Erro ao salvar terminal:', error);
            toast({ message: 'Erro ao salvar terminal. Verifique se o código já existe.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-heavy)', zIndex: 9998 }} />
            <div
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '95%',
                    maxWidth: 500,
                    background: 'var(--bg-card)',
                    borderRadius: 24,
                    border: '1px solid var(--border)',
                    boxShadow: 'none',
                    zIndex: 9999,
                    overflow: 'hidden'
                }}
            >
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
                    <div className="flex items-center gap-3">
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-blue-light)', borderRadius: 12 }}>
                            <Monitor size={20} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{terminal ? 'Editar Terminal' : 'Novo Terminal'}</h2>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.5rem', borderRadius: '50%' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }} className="space-y-4">
                    <div className="form-group">
                        <label className="text-[10px] font-black uppercase text-muted mb-1 block">Código do Terminal (ID)</label>
                        <input
                            type="text"
                            className="input"
                            required
                            placeholder="Ex: TFL-01"
                            value={formData.codigo}
                            onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                            style={{ fontWeight: 800 }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="text-[10px] font-black uppercase text-muted mb-1 block">Descrição / Localização</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Ex: Balcão Principal"
                            value={formData.descricao}
                            onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="text-[10px] font-black uppercase text-muted mb-1 block">Modelo do Equipamento</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Ex: Elgin TFL"
                            value={formData.modelo}
                            onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="text-[10px] font-black uppercase text-muted mb-1 block">Status Operacional</label>
                        <select
                            className="input"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                            style={{ fontWeight: 700 }}
                        >
                            <option value="ativo">Ativo (Pronto para operar)</option>
                            <option value="manutencao">Em Manutenção</option>
                            <option value="inativo">Inativo (Bloqueado)</option>
                        </select>
                    </div>

                    <div style={{ paddingTop: '1rem', display: 'flex', gap: '1rem' }}>
                        <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
                        <button type="submit" className="btn btn-primary flex-2" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} className="mr-2" /> Salvar Terminal</>}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}


