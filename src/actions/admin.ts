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

    console.log('[CREATE_USER] Iniciando criacao:', { email, nome, role, loja_id });

    if (!email || !password || !nome || !role) {
        return { error: 'Preencha todos os campos obrigatorios.' };
    }

    if (password.length < 6) {
        return { error: 'A senha deve ter no minimo 6 caracteres.' };
    }

    // Validação de Loja
    if (role !== 'admin' && !loja_id) {
        return { error: 'Para usuarios nao-admin, e obrigatorio selecionar uma loja.' };
    }

    try {
        const supabaseAdmin = getAdminClient();

        // 1. Criar Usuário no Supabase Auth
        console.log('[CREATE_USER] Criando no Auth...');
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
            console.error('[CREATE_USER] Erro Auth:', userError);
            return { error: `Erro ao criar usuario: ${userError.message}` };
        }

        if (!userData.user) {
            console.error('[CREATE_USER] Usuario nao retornado');
            return { error: 'Usuario nao retornado apos criacao.' };
        }

        console.log('[CREATE_USER] Usuario criado no Auth:', userData.user.id);

        // 2. Inserir na tabela perfis (trigger vai popular usuarios automaticamente)
        console.log('[CREATE_USER] Inserindo em perfis...');
        const { error: perfilError } = await supabaseAdmin
            .from('perfis')
            .insert({
                id: userData.user.id,
                nome: nome,
                role: role,
                loja_id: (role === 'admin') ? null : (loja_id || null),
                ativo: true
            });

        if (perfilError) {
            console.error('[CREATE_USER] Erro ao criar perfil:', perfilError);
            // Tentar deletar usuario do auth se perfil falhar
            await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
            return { error: `Erro ao criar perfil: ${perfilError.message}` };
        }

        console.log('[CREATE_USER] Perfil criado com sucesso');

        revalidatePath('/configuracoes');
        revalidatePath('/(dashboard)');

        return { success: true, message: `Usuario ${nome} criado com sucesso!` };

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

        // 2. Atualizar Perfil (trigger vai sincronizar com usuarios)
        const updateData: any = {};
        if (data.nome) updateData.nome = data.nome;
        if (data.role) updateData.role = data.role;
        if (data.loja_id !== undefined) updateData.loja_id = data.loja_id;
        updateData.updated_at = new Date().toISOString();

        const { error: profileError } = await supabaseAdmin
            .from('perfis')
            .update(updateData)
            .eq('id', userId);

        if (profileError) throw profileError;

        revalidatePath('/configuracoes');
        return { success: true };
    } catch (err: any) {
        console.error('[ADMIN] Erro ao atualizar usuario:', err);
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
