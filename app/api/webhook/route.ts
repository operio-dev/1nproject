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

        const { data: existingMember } = await supabaseAdmin
          .from('members')
          .select('member_number, user_id')
          .eq('user_id', userId)
          .maybeSingle()

        if (existingMember) {
          console.log(`Member already exists for user ${userId}, skipping creation`)
          
          await supabaseAdmin
            .from('number_reservations')
            .delete()
            .eq('user_id', userId)
          
          return NextResponse.json({ received: true, status: 'already_exists' })
        }

        const { data: reservation } = await supabaseAdmin
          .from('number_reservations')
          .select('*')
          .eq('member_number', parseInt(memberNumber))
          .eq('user_id', userId)
          .maybeSingle()

        if (!reservation) {
          console.error(`No valid reservation found for user ${userId}, number ${memberNumber}`)
          
          try {
            await stripe.subscriptions.cancel(subscriptionId)
            
            const paymentIntent = session.payment_intent as string
            if (paymentIntent) {
              await stripe.refunds.create({
                payment_intent: paymentIntent,
                reason: 'requested_by_customer'
              })
            }
            
            console.log(`Refunded and cancelled subscription for user ${userId}`)
          } catch (refundError) {
            console.error('Failed to refund:', refundError)
          }
          
          throw new Error(`Invalid reservation for number ${memberNumber}`)
        }

        const { error: insertError } = await supabaseAdmin
          .from('members')
          .insert({
            user_id: userId,
            email: email,
            member_number: parseInt(memberNumber),
            subscription_id: subscriptionId,
            status: 'active',
            current_level: 0,
            join_date: new Date().toISOString()
          })

        if (insertError) {
          console.error('Error creating member:', insertError)
          
          if (insertError.code === '23505') {
            console.log(`Duplicate member detected for number ${memberNumber}`)
            
            try {
              await stripe.subscriptions.cancel(subscriptionId)
              
              const paymentIntent = session.payment_intent as string
              if (paymentIntent) {
                await stripe.refunds.create({
                  payment_intent: paymentIntent,
                  reason: 'requested_by_customer'
                })
              }
              
              console.log(`Refunded duplicate for user ${userId}`)
              
            } catch (refundError) {
              console.error('Failed to refund duplicate:', refundError)
            }
            
            await supabaseAdmin
              .from('number_reservations')
              .delete()
              .eq('user_id', userId)
            
            return NextResponse.json({ 
              received: true, 
              status: 'refunded_duplicate' 
            })
          }
          
          throw insertError
        }

        await supabaseAdmin
          .from('number_reservations')
          .delete()
          .eq('user_id', userId)

        console.log(`Member ${memberNumber} created successfully for user ${userId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const subscriptionId = subscription.id
        const status = subscription.status

        let memberStatus: 'active' | 'past_due' | 'expired' | 'cancelled'
        
        switch (status) {
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
          .update({ status: memberStatus })
          .eq('subscription_id', subscriptionId)

        if (error) {
          console.error('Error updating member status:', error)
          throw error
        }

        console.log(`Subscription ${subscriptionId} updated to ${memberStatus}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const subscriptionId = subscription.id

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

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
