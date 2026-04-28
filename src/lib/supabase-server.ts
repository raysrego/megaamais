'use server';

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
                            const isAuthCookie = name.includes('auth-token') || name.startsWith('sb-');
                            const cookieOptions = isAuthCookie
                                ? { ...options, maxAge: undefined, expires: undefined }
                                : options;
                            cookieStore.set(name, value, cookieOptions);
                        });
                    } catch {
                        // safe to ignore
                    }
                },
            },
        }
    );
}
