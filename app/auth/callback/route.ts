import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://1nothing.qzz.io'

  if (!code) {
    return NextResponse.redirect(`${BASE_URL}/login`)
  }

  // ✅ Crea response object per gestire i cookie
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ✅ Crea client Supabase con gestione cookie
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

  // ✅ Exchange code for session (con cookie!)
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  
  if (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(`${BASE_URL}/login?error=auth_failed`)
  }

  // ✅ Check se ha già un numero
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    const { data: member } = await supabase
      .from('members')
      .select('member_number')
      .eq('user_id', user.id)
      .maybeSingle()

    if (member) {
      return NextResponse.redirect(BASE_URL, { headers: response.headers })
    }
  }

  return NextResponse.redirect(`${BASE_URL}/select-number`, { headers: response.headers })
}
