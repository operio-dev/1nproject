import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get member's subscription
    const { data: member } = await supabase
      .from('members')
      .select('subscription_id')
      .eq('user_id', user.id)
      .single()

    if (!member || !member.subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 })
    }

    // Get Stripe subscription to find customer ID
    const subscription = await stripe.subscriptions.retrieve(member.subscription_id)
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.customer as string,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Portal session error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
```

---

## **📁 Struttura file corretta:**
```
app/
├── api/
│   ├── checkout/
│   │   └── route.ts          ← Gestisce creazione checkout Stripe
│   ├── create-portal-session/
│   │   └── route.ts          ← Gestisce redirect a Stripe Portal
│   └── webhook/
│       └── route.ts          ← Gestisce webhook Stripe
