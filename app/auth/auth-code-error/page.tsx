"use client";

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

export default function AuthErrorPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <XCircle size={48} className="mx-auto text-red-500" />
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">
            Errore di autenticazione
          </h1>
          <p className="text-zinc-400 text-sm">
            Il link potrebbe essere scaduto o non valido.
          </p>
        </div>

        <button
          onClick={() => router.push('/login')}
          className="w-full bg-black text-white py-4 font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors"
        >
          Torna al login
        </button>

        <div className="text-center text-[9px] text-zinc-200 uppercase tracking-[0.5em] pt-8">
          &copy; 2026 1N PROJECT.
        </div>
      </div>
    </div>
  );
}
