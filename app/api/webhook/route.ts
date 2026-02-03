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

        // Create member record
        const { error } = await supabaseAdmin
          .from('members')
          .insert({
            user_id: userId,
            email: email,
            member_number: parseInt(memberNumber),
            subscription_id: subscriptionId,
            status: 'active',
            current_level: 0,
          })

        if (error) {
          console.error('Error creating member:', error)
          throw error
        }

        console.log(`Member ${memberNumber} created successfully`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const subscriptionId = subscription.id
        const status = subscription.status

        // Update member status
        const { error } = await supabaseAdmin
          .from('members')
          .update({ status: status === 'active' ? 'active' : 'expired' })
          .eq('subscription_id', subscriptionId)

        if (error) {
          console.error('Error updating member status:', error)
          throw error
        }

        console.log(`Subscription ${subscriptionId} updated to ${status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const subscriptionId = subscription.id

        // Update member status to cancelled
        const { error } = await supabaseAdmin
          .from('members')
          .update({ status: 'cancelled' })
          .eq('subscription_id', subscriptionId)

        if (error) {
          console.error('Error cancelling member:', error)
          throw error
        }

        console.log(`Subscription ${subscriptionId} cancelled`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
