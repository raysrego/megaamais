'use server';

import { createClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    if (data.user) {
        // Verificar se usuário existe na tabela pública e está ativo
        const { data: profile, error: profileError } = await supabase
            .from('perfis')
            .select('ativo')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error('Error checking profile:', profileError);
            // Even if profile check fails, we might still want to let them in if they are authenticated
            // or handle specifically.
        }

        if (profile && !profile.ativo) {
            await supabase.auth.signOut();
            return { error: 'Este usuário está inativo. Entre em contato com o administrador.' };
        }
    }

    // redirect('/'); // Removido para permitir Hard Reload no client
    return { success: true };
}

export async function logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
}
