'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const finalizeLogin = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        router.replace('/login')
        return
      }

      router.replace('/select-number')
    }

    finalizeLogin()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-zinc-500">Finalizing login…</p>
    </div>
  )
}
