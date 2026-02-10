import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // 1. Controllo Autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { selectedNumber } = await request.json()

    if (!selectedNumber || selectedNumber < 1 || selectedNumber > 100000) {
      return NextResponse.json({ error: 'Invalid number selection' }, { status: 400 })
    }

    // 2. 🟢 LOGICA BLINDATA: Chiamiamo la RPC che abbiamo creato
    // Questa funzione crea già il record in 'members' con status 'pending'
    // Se il numero è già preso (anche come pending), restituirà un errore qui.
    const { error: rpcError } = await supabase.rpc('select_member_number', { 
      target_number: selectedNumber 
    })

    if (rpcError) {
      console.error('RPC Reservation failed:', rpcError)
      // Se l'errore è dovuto al numero già preso (Unique Constraint)
      if (rpcError.message.includes('unique_member_number')) {
        return NextResponse.json({ error: 'Numero appena preso, scegline un altro' }, { status: 409 })
      }
      return NextResponse.json({ error: rpcError.message }, { status: 409 })
    }

    // 3. Creazione Sessione Stripe
    // Passiamo i metadata necessari affinché il Webhook sappia chi confermare
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?number=${selectedNumber}`,
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

    // Restituiamo il sessionId al frontend
    return NextResponse.json({ sessionId: session.id, url: session.url })

  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
