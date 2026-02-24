import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) => {
                        const isAuthCookie = name.includes('auth-token') || name.startsWith('sb-');
                        const cookieOptions = isAuthCookie
                            ? { ...options, maxAge: undefined, expires: undefined }
                            : options;

                        response.cookies.set(name, value, cookieOptions)
                    })
                },
            },
        }
    )

    console.log(`[MIDDLEWARE] Checking auth for: ${request.nextUrl.pathname}`);
    const start = Date.now();
    const {
        data: { user },
        error
    } = await supabase.auth.getUser()
    const end = Date.now();
    console.log(`[MIDDLEWARE] getUser took ${end - start}ms. User: ${user?.email || 'none'}`);

    if (error) {
        console.error('[MIDDLEWARE] Auth error:', error.message);
    }

    // Se não estiver logado e tentar acessar algo que não seja o login, redireciona
    if (!user && !request.nextUrl.pathname.startsWith('/login')) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Se estiver logado e tentar acessar o login, redireciona para a home
    if (user && request.nextUrl.pathname.startsWith('/login')) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
