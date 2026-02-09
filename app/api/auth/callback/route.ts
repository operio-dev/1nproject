import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  console.log('=== CALLBACK START ===')
  console.log('Code received:', code ? 'YES' : 'NO')
  
  if (!code) {
    console.log('No code, going to error')
    return NextResponse.redirect('https://1nothing.vercel.app/auth/auth-code-error')
  }
  
  try {
    const supabase = await createClient()
    console.log('Supabase client created')
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('Exchange result:', {
      hasData: !!data,
      hasError: !!error,
      errorMessage: error?.message,
      errorStatus: error?.status
    })
    
    if (error) {
      console.log('ERROR from Supabase:', error)
      return NextResponse.redirect('https://1nothing.vercel.app/auth/auth-code-error')
    }
    
    console.log('Success! Redirecting to select-number')
    return NextResponse.redirect('https://1nothing.vercel.app/select-number')
    
  } catch (err: any) {
    console.log('CATCH ERROR:', err.message)
    return NextResponse.redirect('https://1nothing.vercel.app/auth/auth-code-error')
  }
}
