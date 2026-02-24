'use client';

import { usePerfil } from '@/hooks/usePerfil';
import { useLoja } from '@/contexts/LojaContext';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useEffect, useState } from 'react';

export default function DebugDeployPage() {
    const perfilCtx = usePerfil();
    const lojaCtx = useLoja();
    const [dbCheck, setDbCheck] = useState<any>({ loading: true, result: null, error: null });
    const [envCheck, setEnvCheck] = useState<any>({});

    useEffect(() => {
        setEnvCheck({
            url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Definido ✅' : 'AUSENTE ❌',
            urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 15) + '...',
            anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Definido ✅' : 'AUSENTE ❌'
        });

        const checkDb = async () => {
            const supabase = createBrowserSupabaseClient();
            try {
                const { data, error } = await supabase.from('empresas').select('count(*)', { count: 'exact', head: true });
                setDbCheck({ loading: false, result: data, count: await supabase.from('empresas').select('*', { count: 'exact', head: true }).then(r => r.count), error });
            } catch (err: any) {
                setDbCheck({ loading: false, result: null, error: err.message });
            }
        };
        checkDb();
    }, []);

    return (
        <div className="p-8 space-y-8 bg-slate-900 text-white min-h-screen">
            <h1 className="text-3xl font-bold">Diagnóstico de Deploy</h1>

            <div className="grid grid-cols-2 gap-8">
                <div className="p-4 border rounded bg-slate-800">
                    <h2 className="text-xl font-bold mb-4 text-blue-400">1. Estado do Perfil (usePerfil)</h2>
                    <pre className="text-xs bg-black p-4 rounded overflow-auto h-64">
                        {JSON.stringify({
                            loading: perfilCtx.loading,
                            isAdmin: perfilCtx.isAdmin,
                            user_id: perfilCtx.user?.id,
                            user_email: perfilCtx.user?.email,
                            perfil_data: perfilCtx.perfil
                        }, null, 2)}
                    </pre>
                </div>

                <div className="p-4 border rounded bg-slate-800">
                    <h2 className="text-xl font-bold mb-4 text-green-400">2. Estado da Loja (useLoja)</h2>
                    <pre className="text-xs bg-black p-4 rounded overflow-auto h-64">
                        {JSON.stringify({
                            loading: lojaCtx.loading,
                            lojaAtual: lojaCtx.lojaAtual,
                            totalLojas: lojaCtx.lojasDisponiveis.length,
                            lojasList: lojaCtx.lojasDisponiveis
                        }, null, 2)}
                    </pre>
                </div>
            </div>

            <div className="p-4 border rounded bg-slate-800">
                <h2 className="text-xl font-bold mb-4 text-purple-400">0. Variáveis de Ambiente</h2>
                <div className="space-y-2 font-mono text-sm">
                    <p>SUPABASE_URL: {envCheck.url} <span className="text-gray-500">({envCheck.urlValue})</span></p>
                    <p>SUPABASE_ANON: {envCheck.anon}</p>
                    <p className="text-xs text-yellow-300 mt-2">
                        Se estiver "AUSENTE", configure em Settings &gt; Environment Variables no Vercel.
                    </p>
                </div>
            </div>

            <div className="p-4 border rounded bg-slate-800">
                <h2 className="text-xl font-bold mb-4 text-youtube-red">3. Teste Direto de Banco (Tabela 'empresas')</h2>
                <div className="space-y-2">
                    <p><strong>Status:</strong> {dbCheck.loading ? 'Verificando...' : 'Concluído'}</p>
                    <p><strong>Erro:</strong> {dbCheck.error ? JSON.stringify(dbCheck.error) : 'Nenhum'}</p>
                    <p><strong>Contagem de Lojas:</strong> {dbCheck.count !== null ? dbCheck.count : 'N/A'}</p>
                    {dbCheck.error && dbCheck.error.code === '42P01' && (
                        <div className="p-2 bg-red-500/20 text-red-200 rounded mt-2">
                            🚨 <strong>CRÍTICO:</strong> Erro 42P01 significa que a tabela não existe. O banco está vazio.
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border rounded border-blue-500/30 bg-blue-900/10">
                <h3 className="font-bold">Ações Recomendadas:</h3>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                    <li>Se "Teste Direto" der erro <strong>42P01</strong>: Você precisa rodar o script SQL completo.</li>
                    <li>Se "Loja (useLoja)" estiver <strong>loading: true</strong> travado: O contexto está esperando o perfil.</li>
                    <li>Se "Total Lojas" for <strong>0</strong>: O banco existe mas está vazio (precisa cadastrar loja).</li>
                </ul>
            </div>
        </div>
    );
}
