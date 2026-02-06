import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    // ✅ Verifica authorization header (Vercel Cron secret)
    const authHeader = request.headers.get('authorization')
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date().toISOString()

    // ✅ STEP 1: Trova membri con subscription_end_date passata
    const { data: expiredMembers, error: fetchError } = await supabaseAdmin
      .from('members')
      .select('id, member_number, subscription_end_date, status')
      .not('subscription_end_date', 'is', null)
      .lt('subscription_end_date', now)
      .in('status', ['active', 'past_due'])

    if (fetchError) {
      console.error('❌ Error fetching expired members:', fetchError)
      throw fetchError
    }

    if (!expiredMembers || expiredMembers.length === 0) {
      console.log('✅ No expired members to cleanup')
      return NextResponse.json({ 
        success: true, 
        message: 'No expired members',
        cleaned: 0
      })
    }

    console.log(`🔍 Found ${expiredMembers.length} expired members`)

    // ✅ STEP 2: Marca come 'expired'
    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({ status: 'expired' })
      .not('subscription_end_date', 'is', null)
      .lt('subscription_end_date', now)
      .in('status', ['active', 'past_due'])

    if (updateError) {
      console.error('❌ Error updating expired members:', updateError)
      throw updateError
    }

    console.log(`✅ Marked ${expiredMembers.length} members as expired`)

    // ✅ STEP 3: Cleanup reservations
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { error: reservationError } = await supabaseAdmin
      .from('number_reservations')
      .delete()
      .lt('expires_at', oneHourAgo)

    if (reservationError) {
      console.error('⚠️ Error cleaning reservations:', reservationError)
    } else {
      console.log('✅ Cleaned old reservations')
    }

    return NextResponse.json({ 
      success: true,
      message: 'Cleanup completed',
      expired_members: expiredMembers.length,
      numbers_freed: expiredMembers.map(m => m.member_number),
      timestamp: now
    })

  } catch (error: any) {
    console.error('❌ Cron job error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Cleanup failed' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
