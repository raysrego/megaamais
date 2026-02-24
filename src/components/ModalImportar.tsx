'use client';

import { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { importFromFile } from '@/utils/exportImport';
import type { ImportResult } from '@/utils/exportImport';
import type { Lead } from '@/data/mockData';

interface ModalImportarProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (leads: Partial<Lead>[]) => void;
}

export function ModalImportar({ isOpen, onClose, onImport }: ModalImportarProps) {
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFile = async (file: File) => {
        setLoading(true);
        setResult(null);

        const importResult = await importFromFile(file);
        setResult(importResult);
        setLoading(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleConfirm = () => {
        if (result?.leads) {
            onImport(result.leads);
            onClose();
        }
    };

    const resetModal = () => {
        setResult(null);
        setLoading(false);
    };

    return (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
            <div className="modal-container card" style={{ width: 560, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header flex justify-between items-center p-5 border-b border-white/10">
                    <h2 className="text-xl font-bold">Importar Leads</h2>
                    <button className="btn btn-ghost p-2" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="p-6">
                    {!result ? (
                        <>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => inputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/10' : 'border-white/10'}`}
                            >
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    style={{ display: 'none' }}
                                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                />

                                {loading ? (
                                    <Loader2 size={48} className="animate-spin mx-auto mb-4 text-primary" />
                                ) : (
                                    <Upload size={48} className="mx-auto mb-4 text-muted" />
                                )}

                                <p className="font-bold mb-1">
                                    {loading ? 'Processando...' : 'Arraste um arquivo ou clique para selecionar'}
                                </p>
                                <p className="text-sm text-muted">Formatos: .xlsx, .xls, .csv</p>
                            </div>

                            <div className="mt-6 p-4 bg-white/5 rounded-xl">
                                <h4 className="font-bold mb-3 flex items-center gap-2">
                                    <FileSpreadsheet size={18} className="text-accent" /> Reconhecidos automaticamente:
                                </h4>
                                <ul className="grid grid-cols-2 gap-2 text-xs text-muted">
                                    <li>• Nome / Cliente</li>
                                    <li>• Telefone / WhatsApp</li>
                                    <li>• Email</li>
                                    <li>• Status / Etapa</li>
                                    <li>• Vendedor / Responsável</li>
                                    <li>• Valor Potencial</li>
                                    <li>• Origem / Canal</li>
                                    <li>• Data de Cadastro</li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center mb-6">
                                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${result.success ? 'bg-success/20' : 'bg-danger/20'}`}>
                                    {result.success ? <Check size={32} className="text-success" /> : <AlertCircle size={32} className="text-danger" />}
                                </div>
                                <h3 className="text-xl font-bold mb-1">
                                    {result.success && result.leads.length > 0 ? `${result.leads.length} leads prontos!` : 'Nenhum lead encontrado'}
                                </h3>
                                <p className="text-sm text-muted">{result.totalRows} linhas processadas</p>
                            </div>

                            {result.leads.length > 0 && (
                                <div className="max-h-40 overflow-auto bg-white/5 rounded-xl border border-white/10 p-3">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-left">
                                                <th className="p-2">Nome</th>
                                                <th className="p-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.leads.slice(0, 5).map((lead, i) => (
                                                <tr key={i} className="border-t border-white/5">
                                                    <td className="p-2">{lead.nome || '-'}</td>
                                                    <td className="p-2"><span className="badge">{lead.status}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                    {result ? (
                        <>
                            <button className="btn btn-ghost" onClick={resetModal}>Tentar outro</button>
                            <button className="btn btn-primary" onClick={handleConfirm} disabled={!result.leads.length}>
                                <Check size={16} /> Importar {result.leads.length}
                            </button>
                        </>
                    ) : (
                        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    )}
                </div>
            </div>
        </div>
    );
}
