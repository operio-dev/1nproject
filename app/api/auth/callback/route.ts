import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // ✅ ASPETTA che i cookies siano settati
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('Session created:', session?.user?.email)
      
      // ✅ POI redirect
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://1nothing.vercel.app'
      return NextResponse.redirect(`${baseUrl}/select-number`)
    }
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://1nothing.vercel.app'
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`)
}
