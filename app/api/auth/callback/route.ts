import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  console.log('🔍 Callback triggered, code:', code?.substring(0, 10))
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('📧 Exchange result:', error ? error.message : 'success')
    
    if (!error) {
      // ✅ URL assoluto come suggerito da Gemini
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://1nothing.vercel.app'
      return NextResponse.redirect(`${baseUrl}/select-number`)
    }
  }
  
  console.log('❌ Error, redirecting to error page')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://1nothing.vercel.app'
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`)
}
