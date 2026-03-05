'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Smartphone,
    Wallet,
    ArrowRightLeft,
    Building,
    FileText,
    Camera,
    Check,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';

export type TipoLancamento = 'pix' | 'sangria' | 'trocados' | 'deposito' | 'boleto';

interface ModalLancamentoRapidoProps {
    tipo: TipoLancamento;
    initialData?: any; // para edição
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

export function ModalLancamentoRapido({ tipo, initialData, onClose, onSave }: ModalLancamentoRapidoProps) {
    const [valor, setValor] = useState<number>(0);
    const [dataVencimento, setDataVencimento] = useState<string>(''); // formato YYYY-MM-DD
    const [observacao, setObservacao] = useState('');
    const [metodo, setMetodo] = useState<string>(
        tipo === 'pix' ? 'pix' : 'especie'
    );
    const [classificacaoPix, setClassificacaoPix] = useState('CRED PIX QR COD EST');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Preenche os dados quando estiver editando
    useEffect(() => {
        if (initialData) {
            setValor(Math.abs(initialData.valor));
            setObservacao(initialData.descricao || '');
            setMetodo(initialData.metodo_pagamento || (tipo === 'pix' ? 'pix' : 'especie'));
            if (tipo === 'pix' && initialData.classificacao_pix) {
                setClassificacaoPix(initialData.classificacao_pix);
            }
            // Preenche a data de vencimento se existir (espera-se string ISO ou Date)
            if (initialData.data_vencimento) {
                const date = new Date(initialData.data_vencimento);
                if (!isNaN(date.getTime())) {
                    setDataVencimento(date.toISOString().split('T')[0]); // extrai YYYY-MM-DD
                }
            }
        }
    }, [initialData, tipo]);

    const config = {
        pix: { title: 'Lançamento Pix', icon: <Smartphone />, color: 'var(--success)', rgb: 'var(--success-rgb)', label: 'Valor Recebido' },
        sangria: { title: 'Sangria / Cofre', icon: <Building />, color: 'var(--danger)', rgb: 'var(--danger-rgb)', label: 'Valor Retirado' },
        trocados: { title: 'Troca de Dinheiro', icon: <ArrowRightLeft />, color: 'var(--primary-blue-light)', rgb: 'var(--primary-blue-light-rgb)', label: 'Valor Trocado' },
        deposito: { title: 'Depósito Outra Filial', icon: <Building />, color: 'var(--text-muted)', rgb: '148, 163, 184', label: 'Valor Depositado' },
        boleto: { title: 'Boleto Lotérico', icon: <FileText />, color: 'var(--accent-orange)', rgb: 'var(--accent-orange-rgb)', label: 'Valor do Boleto' }
    }[tipo];

    const handleSave = async () => {
        if (!valor || valor <= 0) {
            setError('Informe um valor válido maior que zero.');
            return;
        }

        setError(null);
        setIsSaving(true);

        try {
            const dados = {
                tipo,
                valor: tipo === 'sangria' || tipo === 'deposito' ? -valor : valor, // mantém negativo para saídas
                metodo,
                observacao: tipo === 'pix' ? `[${classificacaoPix}] ${observacao}`.trim() : observacao,
                data: new Date().toISOString(), // data do lançamento (gerada automaticamente)
                data_vencimento: dataVencimento ? new Date(dataVencimento).toISOString() : null, // data de vencimento informada
                classificacao_pix: tipo === 'pix' ? classificacaoPix : null
            };

            await onSave(dados);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar lançamento. Tente novamente.');
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
                maxWidth: 400,
                background: 'var(--bg-card)',
                borderRadius: 20,
                border: '1px solid var(--border)',
                boxShadow: 'none',
                zIndex: 9999,
                overflow: 'hidden'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                    background: `linear-gradient(to right, rgba(${config.rgb}, 0.1), transparent)`
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ color: config.color }}>{config.icon}</div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{config.title}</h2>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 4 }} disabled={isSaving}><X size={20} /></button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

                    <div className="form-group">
                        <label style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>{config.label}</label>
                        <MoneyInput
                            autoFocus
                            value={valor}
                            onValueChange={setValor}
                            className="text-xl font-bold h-[60px]"
                            placeholder="0,00"
                            disabled={isSaving}
                        />
                    </div>

                    {/* NOVO CAMPO: Data de Vencimento */}
                    <div className="form-group">
                        <label style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>
                            Data de Vencimento <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>(opcional)</span>
                        </label>
                        <input
                            type="date"
                            className="input"
                            value={dataVencimento}
                            onChange={(e) => setDataVencimento(e.target.value)}
                            disabled={isSaving}
                            style={{ width: '100%', height: '48px' }}
                        />
                    </div>

                    {tipo === 'pix' && (
                        <div className="form-group slide-in">
                            <label style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                Classificação Bancária
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                {[
                                    'CRED PIX QR COD EST',
                                    'PIX RECEBIDO',
                                    'PIX RECEBIDO DADOS DA CONTA',
                                    'CRED PIX CHAVE'
                                ].map(classe => (
                                    <button
                                        key={classe}
                                        type="button"
                                        onClick={() => setClassificacaoPix(classe)}
                                        disabled={isSaving}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: '12px',
                                            border: '1px solid',
                                            borderColor: classificacaoPix === classe ? 'var(--success)' : 'var(--border)',
                                            background: classificacaoPix === classe ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-dark)',
                                            color: classificacaoPix === classe ? 'var(--success)' : 'var(--text-secondary)',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            textAlign: 'left',
                                            transition: 'all 0.2s',
                                            cursor: isSaving ? 'not-allowed' : 'pointer',
                                            opacity: isSaving ? 0.5 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            {classe}
                                            {classificacaoPix === classe && <Check size={14} />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(tipo === 'sangria' || tipo === 'boleto' || tipo === 'deposito') && (
                        <div className="form-group">
                            <label style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Forma de Liquidação</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <button
                                    onClick={() => setMetodo('especie')}
                                    disabled={isSaving}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: '1px solid',
                                        borderColor: metodo === 'especie' ? config.color : 'var(--border)',
                                        background: metodo === 'especie' ? `rgba(${config.rgb}, 0.1)` : 'transparent',
                                        color: metodo === 'especie' ? config.color : 'var(--text-muted)',
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
                                    <Wallet size={16} /> Espécie
                                </button>
                                <button
                                    onClick={() => setMetodo('pix')}
                                    disabled={isSaving}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: '1px solid',
                                        borderColor: metodo === 'pix' ? config.color : 'var(--border)',
                                        background: metodo === 'pix' ? `rgba(${config.rgb}, 0.1)` : 'transparent',
                                        color: metodo === 'pix' ? config.color : 'var(--text-muted)',
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
                                    <Smartphone size={16} /> Pix / Digital
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Observação (Opcional)</label>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={!valor || valor <= 0 || isSaving}
                            style={{
                                height: '56px',
                                fontSize: '1rem',
                                background: config.color,
                                border: 'none',
                                borderColor: config.color
                            }}
                        >
                            {isSaving ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Loader2 size={20} className="animate-spin" /> Salvando...
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Check size={20} /> {initialData ? 'Atualizar' : 'Confirmar'} Lançamento
                                </span>
                            )}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} disabled={isSaving}>
                                <Camera size={14} /> Anexar Comprovante
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '0.75rem 1.5rem', background: 'var(--surface-subtle)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} className="flex items-center justify-center gap-1">
                        <AlertCircle size={12} /> Este lançamento será registrado imediatamente no fluxo de hoje.
                    </p>
                </div>
            </div>
        </>
    );
}
