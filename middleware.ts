import { createServerClient, type CookieOptions } from '@supabase/ssr'
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

  // Recuperiamo l'utente
  const { data: { user } } = await supabase.auth.getUser()

  // --- LOGICA DI PROTEZIONE ROTTE ---

  // Se l'utente prova ad accedere a /select-number
  if (request.nextUrl.pathname.startsWith('/select-number')) {
    // Se NON è loggato, rimandalo al login
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      // Aggiungiamo un parametro per debugging (opzionale)
      loginUrl.searchParams.set('from', 'middleware-protected')
      return NextResponse.redirect(loginUrl)
    }
    
    // Se è loggato, controlliamo se ha già un numero assegnato (se è già membro)
    const { data: member } = await supabase
      .from('members')
      .select('member_number')
      .eq('user_id', user.id)
      .maybeSingle()

    // Se esiste già un numero, significa che ha già pagato/scelto: rimandalo alla home
    if (member?.member_number) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Se un utente loggato prova ad andare al login, rimandalo alla home (opzionale ma pulito)
  if (request.nextUrl.pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Escludiamo i file statici e le rotte che non devono passare dal middleware
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
