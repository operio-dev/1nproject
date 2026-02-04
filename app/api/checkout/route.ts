import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { selectedNumber } = await request.json()

    if (!selectedNumber || selectedNumber < 1 || selectedNumber > 100000) {
      return NextResponse.json({ error: 'Invalid number selection' }, { status: 400 })
    }

    // Check if number is already taken
    const { data: existingMember } = await supabase
      .from('members')
      .select('member_number')
      .eq('member_number', selectedNumber)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ error: 'Number already taken' }, { status: 409 })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/select-number?canceled=true`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        member_number: selectedNumber.toString(),
        email: user.email!,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          member_number: selectedNumber.toString(),
        },
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
