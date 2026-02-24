'use client';

import React from 'react';
import { X, Search, FileText, Download } from 'lucide-react';

interface KPIDrillDownModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    kpiValue: string;
    data: any[];
    columns: { key: string; label: string; format?: (val: any) => string }[];
}

export const KPIDrillDownModal: React.FC<KPIDrillDownModalProps> = ({
    isOpen,
    onClose,
    title,
    kpiValue,
    data,
    columns
}) => {
    const [searchTerm, setSearchTerm] = React.useState('');

    if (!isOpen) return null;

    const filteredData = data.filter(item =>
        Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <>
            <div
                onClick={onClose}
                className="modal-overlay"
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    zIndex: 9998
                }}
            />

            <div className="modal-container" style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '95%',
                maxWidth: 1000,
                maxHeight: '90vh',
                background: 'var(--bg-card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                boxShadow: 'none',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div className="modal-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <div>
                        <div className="text-xs text-muted uppercase font-bold tracking-widest mb-1">
                            Detalhamento KPI
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{title}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right mr-4">
                            <div className="text-xs text-muted">Valor Consolidado</div>
                            <div className="text-xl font-black text-primary-blue-light">{kpiValue}</div>
                        </div>
                        <button onClick={onClose} className="btn-close p-2 hover:bg-bg-card-hover rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div style={{
                    padding: '1rem 1.5rem',
                    background: 'var(--surface-subtle)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center'
                }}>
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            className="input pl-10! h-10"
                            placeholder="Pesquisar nos registros..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-ghost h-10">
                        <Download size={16} className="mr-2" /> Exportar CSV
                    </button>
                </div>

                {/* Table Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    <div className="table-container mt-0!" style={{ boxShadow: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    {columns.map(col => (
                                        <th key={col.key}>{col.label}</th>
                                    ))}
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length > 0 ? (
                                    filteredData.map((item, idx) => (
                                        <tr key={idx}>
                                            {columns.map(col => (
                                                <td key={col.key} className="py-4">
                                                    {col.format ? col.format(item[col.key]) : item[col.key]}
                                                </td>
                                            ))}
                                            <td className="text-right">
                                                <button className="text-primary-blue-light hover:text-white transition-colors">
                                                    <FileText size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="text-center py-12 text-text-muted font-medium italic">
                                            Nenhum registro encontrado para esta pesquisa.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    background: 'var(--bg-card)',
                    borderTop: '1px solid var(--border)',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                }}>
                    Mostrando {filteredData.length} de {data.length} registros
                </div>
            </div>
        </>
    );
};

