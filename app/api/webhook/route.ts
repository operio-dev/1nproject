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

        // ✅ Check se member già esiste (idempotency)
        const { data: existingMember } = await supabaseAdmin
          .from('members')
          .select('member_number, user_id')
          .eq('user_id', userId)
          .maybeSingle()

        if (existingMember) {
          console.log(`Member already exists for user ${userId}, skipping creation`)
          return NextResponse.json({ received: true, status: 'already_exists' })
        }

        // ✅ Ottieni subscription per end_date
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        
        // ✅ Crea member record con tutte le info
        const { error: insertError } = await supabaseAdmin
          .from('members')
          .insert({
            user_id: userId,
            email: email,
            member_number: parseInt(memberNumber),
            subscription_id: subscriptionId,
            status: 'active',
            subscription_status: subscription.status,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_level: 0,
            join_date: new Date().toISOString()
          })

        if (insertError) {
          console.error('❌ Error creating member:', insertError)
          throw insertError
        }

        // ✅ Rimuovi reservation se esiste
        await supabaseAdmin
          .from('number_reservations')
          .delete()
          .eq('user_id', userId)

        console.log(`✅ Member ${memberNumber} created successfully for user ${userId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const subscriptionId = subscription.id
        
        // ✅ Mapping completo degli status Stripe
        let memberStatus: 'active' | 'past_due' | 'expired' | 'cancelled'
        
        switch (subscription.status) {
          case 'active':
          case 'trialing':
            memberStatus = 'active'
            break
          case 'past_due':
          case 'unpaid':
            memberStatus = 'past_due' // Grace period
            break
          case 'canceled':
          case 'incomplete_expired':
            memberStatus = 'cancelled'
            break
          default:
            memberStatus = 'expired'
        }

        // ✅ Aggiorna member con tutte le info
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

        console.log(`✅ Subscription ${subscriptionId} updated to ${memberStatus}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const subscriptionId = subscription.id

        // ✅ Marca come cancelled invece di eliminare
        const { error } = await supabaseAdmin
          .from('members')
          .update({ 
            status: 'cancelled',
            subscription_status: 'canceled',
            subscription_end_date: new Date().toISOString()
          })
          .eq('subscription_id', subscriptionId)

        if (error) {
          console.error('❌ Error cancelling member:', error)
          throw error
        }

        console.log(`✅ Subscription ${subscriptionId} cancelled - number will be freed`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription as string

        if (!subscriptionId) break

        // ✅ Marca come past_due (grace period)
        const { error } = await supabaseAdmin
          .from('members')
          .update({ 
            status: 'past_due',
            subscription_status: 'past_due'
          })
          .eq('subscription_id', subscriptionId)

        if (error) {
          console.error('❌ Error updating payment failed status:', error)
          throw error
        }

        console.log(`⚠️ Payment failed for subscription ${subscriptionId} - grace period active`)
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
