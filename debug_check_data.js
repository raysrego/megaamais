const { createClient } = require('@supabase/supabase-js');

// Production Credentials
const supabaseUrl = 'https://afrwsvhblgduvrwocwdx.supabase.co';
const supabaseKey = 'sb_secret_M56ZkGqXO6ZB7FzdByykAg_HGsdSO_4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- DIAGNOSTICO DE DADOS ---');

    // 1. Check Grupos
    const { count: gruposCount, error: gruposError } = await supabase
        .from('grupos')
        .select('*', { count: 'exact', head: true });

    if (gruposError) console.error('Error counting Grupos:', gruposError);
    else console.log(`Total Grupos: ${gruposCount}`);

    // list items
    const { data: grupos, error: listError } = await supabase
        .from('grupos')
        .select('id, nome, ativo');
    if (grupos) {
        console.log('Grupos encontrados:', grupos);
    }

    // 2. Check Empresas
    const { count: empresasCount, error: empresasError } = await supabase
        .from('empresas')
        .select('*', { count: 'exact', head: true });

    if (empresasError) console.error('Error counting Empresas:', empresasError);
    else console.log(`Total Empresas: ${empresasCount}`);

    // 3. User Role Check (Simulation)
    // Cannot mock auth.uid() easily without a user token. 
    // But we can check if table 'perfis' has admins.
    const { data: admins, error: adminsError } = await supabase
        .from('perfis')
        .select('id, nome, role')
        .eq('role', 'admin');

    if (adminsError) console.error('Error listing Admins:', adminsError);
    else {
        console.log(`Admins encontrados: ${admins.length}`);
        admins.forEach(a => console.log(`- ${a.nome} (${a.role})`));
    }
}

checkData();
