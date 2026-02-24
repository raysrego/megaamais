'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Nota: Requer SUPABASE_SERVICE_ROLE_KEY no .env.local
// Isso garante privilégios de Admin para criar usuários sem estar logado como eles.

function getAdminClient() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbServiceKey) {
        throw new Error('Configuração de servidor incompleta: SUPABASE_SERVICE_ROLE_KEY faltando.');
    }

    return createClient(sbUrl, sbServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

export async function createNewUser(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const nome = formData.get('nome') as string;
    const role = formData.get('role') as string;
    const loja_id = formData.get('loja_id') as string;

    if (!email || !password || !nome || !role) {
        return { error: 'Preencha todos os campos obrigatórios.' };
    }

    // Validação de Loja
    if (role !== 'admin' && !loja_id) {
        return { error: 'Para usuários não-admin, é obrigatório selecionar uma loja.' };
    }

    try {
        const supabaseAdmin = getAdminClient();

        // RATE LIMITING: Verificar se não está excedendo o limite
        const { data: { user: currentUser } } = await supabaseAdmin.auth.getUser();
        if (currentUser) {
            const { data: canProceed, error: rateLimitError } = await supabaseAdmin.rpc('check_rate_limit', {
                p_user_id: currentUser.id,
                p_action_type: 'create_user',
                p_max_attempts: 10, // Máximo 10 usuários por hora
                p_window_minutes: 60
            });

            if (rateLimitError || !canProceed) {
                return { error: 'Limite de criação de usuários excedido. Aguarde alguns minutos e tente novamente.' };
            }
        }

        // 1. Criar Usuário no Supabase Auth
        // Passamos role e loja_id nos metadados para que o trigger do banco processe.
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: nome,
                role: role,
                loja_id: (role === 'admin') ? null : (loja_id || null)
            }
        });

        if (userError) {
            console.error('[ADMIN] Erro Auth:', userError);
            return { error: `Erro ao criar usuário no Auth: ${userError.message}` };
        }

        if (!userData.user) {
            return { error: 'Usuário não retornado após criação.' };
        }

        revalidatePath('/configuracoes');
        revalidatePath('/(dashboard)');

        return { success: true, message: `Usuário ${email} criado com sucesso!` };

    } catch (err: any) {
        console.error('Erro Admin Action:', err);
        return { error: err.message || 'Erro interno no servidor.' };
    }
}

export async function updateUserAdmin(userId: string, data: { nome?: string, role?: string, loja_id?: string | null, password?: string }) {
    try {
        const supabaseAdmin = getAdminClient();

        // 1. Se houver senha, atualizar no Auth
        if (data.password) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: data.password
            });
            if (authError) throw authError;
        }

        // 2. Atualizar Perfil
        const updateData: any = {};
        if (data.nome) updateData.nome = data.nome;
        if (data.role) updateData.role = data.role;
        if (data.loja_id !== undefined) updateData.loja_id = data.loja_id;

        const { error: profileError } = await supabaseAdmin
            .from('perfis')
            .update(updateData)
            .eq('id', userId);

        if (profileError) throw profileError;

        revalidatePath('/configuracoes');
        return { success: true };
    } catch (err: any) {
        console.error('[ADMIN] Erro ao atualizar usuário:', err);
        return { error: err.message };
    }
}

export async function toggleUserStatus(userId: string, active: boolean) {
    try {
        const supabaseAdmin = getAdminClient();

        const { error } = await supabaseAdmin
            .from('perfis')
            .update({ ativo: active })
            .eq('id', userId);

        if (error) throw error;

        // Se inativar, podemos opcionalmente deslogar o usuário
        if (!active) {
            await supabaseAdmin.auth.admin.signOut(userId);
        }

        revalidatePath('/configuracoes');
        return { success: true };
    } catch (err: any) {
        console.error('[ADMIN] Erro ao alterar status:', err);
        return { error: err.message };
    }
}

// A função deleteUser foi removida para garantir a auditoria.
// Use toggleUserStatus(id, false) para inativar um usuário.
