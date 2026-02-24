#!/usr/bin/env node

/**
 * Script de aplicação de migrations Sprint 1
 * Executa as 3 migrations criadas para correção dos bloqueadores
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase (usar Service Role Key para migrations)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://afrwsvhblgduvrwocwdx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_M56ZkGqXO6ZB7FzdByykAg_HGsdSO_4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Migrations da Sprint 1
const MIGRATIONS = [
    '20260203120000_atomic_venda_bolao.sql',
    '20260203121000_fix_rls_vendas_boloes.sql',
    '20260203122000_unify_categorias_financeiras.sql'
];

async function executeMigration(filename) {
    console.log(`\n📄 Executando: ${filename}`);

    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', filename);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ Arquivo não encontrado: ${filePath}`);
        return false;
    }

    const sql = fs.readFileSync(filePath, 'utf8');

    try {
        // Executar SQL via RPC (usando a connection direta)
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // Fallback: tentar executar via REST API direta
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({ sql_query: sql })
            });

            if (!response.ok) {
                // Última tentativa: Executar statement por statement
                console.log('⚠️  Tentando executar statements individualmente...');
                const statements = sql.split(';').filter(s => s.trim().length > 0);

                for (let i = 0; i < statements.length; i++) {
                    const stmt = statements[i].trim();
                    if (!stmt) continue;

                    console.log(`   Statement ${i + 1}/${statements.length}`);

                    // Executar via query direta (requer extensão pg_net ou similar)
                    // Como não temos acesso direto, vamos logar para execução manual
                    console.log(`   → ${stmt.substring(0, 60)}...`);
                }

                console.log('\n⚠️  ATENÇÃO: Migrations precisam ser aplicadas manualmente.');
                console.log('   Acesse: https://afrwsvhblgduvrwocwdx.supabase.co/project/afrwsvhblgduvrwocwdx/sql');
                console.log(`   Execute o conteúdo de: ${filename}\n`);
                return false;
            }
        }

        console.log(`✅ ${filename} executada com sucesso!`);
        return true;

    } catch (err) {
        console.error(`❌ Erro ao executar ${filename}:`, err.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Iniciando aplicação das migrations da Sprint 1...\n');
    console.log('📌 Supabase Project: afrwsvhblgduvrwocwdx');
    console.log('📌 Total de migrations: 3\n');

    let successCount = 0;

    for (const migration of MIGRATIONS) {
        const success = await executeMigration(migration);
        if (success) successCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Migrations executadas: ${successCount}/${MIGRATIONS.length}`);

    if (successCount === MIGRATIONS.length) {
        console.log('\n🎉 Sprint 1 aplicada com sucesso!');
        console.log('\n📋 Próximos passos:');
        console.log('   1. Executar testes de validação (ver docs/SPRINT_1_CHECKLIST.md)');
        console.log('   2. Atualizar componentes frontend para usar registrarVendaBolao()');
        console.log('   3. Monitorar logs por 24h');
        console.log('   4. Iniciar Sprint 2 (Performance)\n');
    } else {
        console.log('\n⚠️  Algumas migrations falharam.');
        console.log('   Execute manualmente via Supabase Dashboard SQL Editor:');
        console.log('   https://afrwsvhblgduvrwocwdx.supabase.co/project/afrwsvhblgduvrwocwdx/sql\n');
    }
}

// Executar
main().catch(console.error);
