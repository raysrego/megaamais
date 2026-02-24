import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // 1. Segurança: Verificar CRON_SECRET (Bearer Token)
    // O Vercel Cron envia esse header automaticamente se configurado no vercel.json + Env Var
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const supabase = await createClient();

        // 2. Chamar a RPC de Batch Processing
        const { data, error } = await supabase.rpc('processar_encalhes_vencidos');

        if (error) {
            console.error('Erro no Cron de Encalhe:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Ciclo de encalhe executado com sucesso',
            stats: data
        });

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
