import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Crea la risposta base
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. SCORCIATOIA PER L'AUTENTICAZIONE
  // Se l'utente sta cercando di confermare l'email, non fare NESSUN controllo.
  // Questo evita che il redirect fallisca mentre Supabase scambia il codice.
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Recupera l'utente
  const { data: { user } } = await supabase.auth.getUser()

  // 3. LOGICA DI PROTEZIONE ROTTE
  if (request.nextUrl.pathname.startsWith('/select-number')) {
    // Se non è loggato, mandalo al login
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Se è loggato, controlla se ha già un numero
    const { data: member } = await supabase
      .from('members')
      .select('member_number')
      .eq('user_id', user.id)
      .maybeSingle()

    // Se ha già un numero (quindi ha già pagato), mandalo in Dashboard (root)
    if (member) {
      return NextResponse.redirect(new URL('/', request.url))
    }
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
     * - public files (svg, png, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
