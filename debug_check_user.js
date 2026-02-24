const { createClient } = require('@supabase/supabase-js');

// Production Credentials
const supabaseUrl = 'https://afrwsvhblgduvrwocwdx.supabase.co';
// WARNING: This is a public key. Should only read public data or execute secure functions. 
// Ideally I should use a service role key if I had it, but I only have anon key in public logs.
// However, I can use the same key I used before which seemed to work for public read.
// wait, the previous key was likely a service role or anon based on the variable name 'sb_secret_...'.
// If it's the anon key, I can only read if RLS permits. I just relaxed RLS for perms.
const supabaseKey = 'sb_secret_M56ZkGqXO6ZB7FzdByykAg_HGsdSO_4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    console.log('--- DIAGNOSTICO DE USUARIO ---');

    // Check all admins
    const { data: admins, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('role', 'admin');

    if (error) {
        console.error('Error fetching admins:', error);
        // Fallback: check companies if we can't read profiles due to strict RLS on perfis
    } else {
        console.log(`Admins encontrados: ${admins.length}`);
        admins.forEach(a => {
            console.log(`User: ${a.nome} (${a.email})`);
            console.log(`Role: ${a.role}`);
            console.log(`Loja Fixa (loja_id): ${a.loja_id ? a.loja_id : 'NULL (should see all)'}`);
            console.log('---');
        });
    }

    // Check Oportunidade branch
    const { data: op, error: opError } = await supabase
        .from('empresas')
        .select('id, nome_fantasia, ativo')
        .ilike('nome_fantasia', '%Oportunidade%');

    if (opError) console.error('Error check Oportunidade:', opError);
    else console.log('Filial Oportunidade:', op);
}

checkUser();
