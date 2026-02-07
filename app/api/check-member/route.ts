import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // ✅ Usa cookies server-side per ottenere user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 })
    }

    // ✅ Controlla se member esiste
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('member_number, join_date, email')
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError) {
      console.error('Error fetching member:', memberError)
      return NextResponse.json({ 
        success: false, 
        error: memberError.message 
      }, { status: 500 })
    }

    if (member) {
      return NextResponse.json({
        success: true,
        member: {
          member_number: member.member_number,
          join_date: member.join_date,
          email: member.email || user.email
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Member not found yet'
    })

  } catch (error: any) {
    console.error('Check member API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
