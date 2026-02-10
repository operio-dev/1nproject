import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.user_id
        const memberNumber = session.metadata?.member_number
        const email = session.metadata?.email
        const subscriptionId = session.subscription as string

        if (!userId || !memberNumber || !email) {
          throw new Error('Missing metadata in checkout session')
        }

        // 🟢 MODIFICATO: Ottieni subscription per date e status
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        
        // 🟢 MODIFICATO: Invece di INSERT, facciamo UPDATE.
        // L'RPC ha già creato il record come 'pending'. Ora lo confermiamo.
        const { error: updateError } = await supabaseAdmin
          .from('members')
          .update({
            email: email,
            subscription_id: subscriptionId,
            status: 'active', // Da 'pending' passa ad 'active'
            payment_status: 'confirmed', // 🟢 La colonna che hai aggiunto tu!
            subscription_status: subscription.status,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_level: 0,
            join_date: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('member_number', parseInt(memberNumber))

        if (updateError) {
          console.error('❌ Error confirming member payment:', updateError)
          throw updateError
        }

        console.log(`✅ Member ${memberNumber} confirmed successfully for user ${userId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const subscriptionId = subscription.id
        
        let memberStatus: 'active' | 'past_due' | 'expired' | 'cancelled'
        
        switch (subscription.status) {
          case 'active':
          case 'trialing':
            memberStatus = 'active'
            break
          case 'past_due':
          case 'unpaid':
            memberStatus = 'past_due'
            break
          case 'canceled':
          case 'incomplete_expired':
            memberStatus = 'cancelled'
            break
          default:
            memberStatus = 'expired'
        }

        const { error } = await supabaseAdmin
          .from('members')
          .update({ 
            status: memberStatus,
            subscription_status: subscription.status,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end
          })
          .eq('subscription_id', subscriptionId)

        if (error) {
          console.error('❌ Error updating member status:', error)
          throw error
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const subscriptionId = subscription.id

        // 🟢 MODIFICATO: Se la sottoscrizione viene eliminata, liberiamo il numero!
        // Cancelliamo il record così il numero torna disponibile nella griglia
        const { error } = await supabaseAdmin
          .from('members')
          .delete()
          .eq('subscription_id', subscriptionId)

        if (error) {
          console.error('❌ Error deleting/freeing member:', error)
          throw error
        }

        console.log(`✅ Subscription ${subscriptionId} deleted - number is now FREE`)
        break
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('❌ Webhook handler error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
