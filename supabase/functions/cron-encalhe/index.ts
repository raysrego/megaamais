import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Criar cliente Supabase com Service Role
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        console.log('🤖 Iniciando processamento de encalhe automático...')

        // Chamar função RPC
        const { data, error } = await supabase.rpc('processar_encalhe_automatico')

        if (error) {
            console.error('❌ Erro ao processar encalhe:', error)
            throw error
        }

        const result = data?.[0] || { boloes_processados: 0, cotas_encalhadas: 0 }

        console.log('✅ Processamento concluído:', result)

        // Se houve processamento, criar log
        if (result.cotas_encalhadas > 0) {
            console.log(`📊 ${result.boloes_processados} bolão(ões) finalizados, ${result.cotas_encalhadas} cota(s) marcada(s) como encalhe`)

            // Opcional: Registrar no audit_log
            await supabase.from('audit_log').insert({
                table_name: 'boloes',
                action: 'ENCALHE_AUTOMATICO',
                new_data: result,
                user_id: null // Sistema
            })
        } else {
            console.log('ℹ️  Nenhum bolão vencido no momento')
        }

        return new Response(
            JSON.stringify({
                success: true,
                timestamp: new Date().toISOString(),
                boloesProcessados: result.boloes_processados,
                cotasEncalhadas: result.cotas_encalhadas
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error) {
        console.error('💥 Erro fatal:', error)

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            },
        )
    }
})
