'use client';

import { useState } from 'react';
import { Settings, Save, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useParametros } from '@/hooks/useParametros';
import { usePerfil } from '@/hooks/usePerfil';

export function ParametrosFinanceiros() {
    const { parametros, loading, atualizarParametro } = useParametros();
    const { isAdmin } = usePerfil();
    const [saving, setSaving] = useState<string | null>(null);
    const [status, setStatus] = useState<{ tipo: 'success' | 'error', msg: string } | null>(null);

    const handleUpdate = async (chave: string, valor: number) => {
        setSaving(chave);
        setStatus(null);
        const result = await atualizarParametro(chave, valor);

        if (result.success) {
            setStatus({ tipo: 'success', msg: 'Parâmetro atualizado com sucesso!' });
        } else {
            setStatus({ tipo: 'error', msg: 'Erro ao atualizar: ' + result.error });
        }

        setSaving(null);
        setTimeout(() => setStatus(null), 3000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 opacity-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle size={48} className="text-warning mb-4 opacity-20" />
                <h3 className="text-xl font-bold">Acesso Restrito</h3>
                <p className="text-sm text-muted">Apenas usuários Master podem alterar parâmetros globais.</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Settings size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black">Configurações Estratégicas</h2>
                    <p className="text-sm text-muted">Ajuste as taxas e regras de negócio globais do sistema.</p>
                </div>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 ${status.tipo === 'success' ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'
                    }`}>
                    {status.tipo === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-bold">{status.msg}</span>
                </div>
            )}

            <div className="grid gap-4">
                {parametros.map((param) => (
                    <div key={param.chave} className="bg-card p-6 border border-border rounded-xl shadow-sm hover:border-primary/50 transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-black uppercase tracking-widest text-primary">
                                        {param.chave.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <h4 className="text-lg font-bold text-foreground mb-2">{param.descricao}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted w-fit px-2 py-1 rounded-md">
                                    <Info size={10} />
                                    Unidade: <span className="font-bold text-foreground uppercase">{param.unidade}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-2xl border border-border">
                                <div className="relative">
                                    <input
                                        type="number"
                                        defaultValue={param.valor}
                                        className="input text-xl font-black text-center w-24 bg-transparent border-none focus:ring-0 text-foreground"
                                        onBlur={(e) => {
                                            const newValue = parseFloat(e.target.value);
                                            if (newValue !== param.valor) {
                                                handleUpdate(param.chave, newValue);
                                            }
                                        }}
                                    />
                                    <span className="absolute -right-2 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                                        {param.unidade === 'percentual' ? '%' : ''}
                                    </span>
                                </div>

                                <button
                                    className={`btn btn-circle btn-sm ${saving === param.chave ? 'loading' : 'btn-primary'}`}
                                    disabled={saving === param.chave}
                                >
                                    {saving === param.chave ? <Save className="animate-pulse" size={14} /> : <Save size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex gap-4 items-start">
                <AlertCircle className="text-indigo-500 shrink-0" size={20} />
                <div className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    <strong className="text-indigo-900 dark:text-indigo-100 block mb-1">Atenção: Impacto Global</strong>
                    As alterações nestes parâmetros afetam instantaneamente todos os cálculos do dashboard, DRE e distribuição de lucros em todas as filiais. Use com cautela.
                </div>
            </div>
        </div>
    );
}
