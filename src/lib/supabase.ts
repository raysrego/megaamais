import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            // Se for cookie de autenticação do Supabase, removemos a expiração
                            // Transformando-a em cookie de sessão (expira ao fechar navegador)
                            const isAuthCookie = name.includes('auth-token') || name.startsWith('sb-');

                            const cookieOptions = isAuthCookie
                                ? { ...options, maxAge: undefined, expires: undefined }
                                : options;

                            cookieStore.set(name, value, cookieOptions);
                        });
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
    );
}
