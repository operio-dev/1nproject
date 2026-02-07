"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Lock, CheckCircle2, XCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Verifica che ci sia una sessione di recupero password
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        setMessage('Link non valido o scaduto. Richiedi un nuovo link di recupero.');
      }
    };
    
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('Le password non coincidono');
      return;
    }

    if (password.length < 6) {
      setMessage('La password deve essere di almeno 6 caratteri');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setIsSuccess(true);
      setMessage('Password aggiornata con successo!');
      
      // Redirect al login dopo 3 secondi
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      setMessage(error.message || 'Errore durante l\'aggiornamento della password');
    } finally {
      setLoading(false);
    }
  };

  if (!isValidSession && message) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8 text-center">
          <XCircle size={48} className="mx-auto text-red-500" />
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight">
              Link non valido
            </h1>
            <p className="text-zinc-400 text-sm">
              {message}
            </p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-black text-white py-4 font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors"
          >
            Torna al login
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-500" />
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight">
              Password aggiornata!
            </h1>
            <p className="text-zinc-400 text-sm">
              Reindirizzamento al login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tight">
            Nuova password
          </h1>
          <p className="text-zinc-400 text-sm">
            Imposta una nuova password per il tuo account
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
              Nuova password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-none py-4 pl-12 pr-4 text-black focus:outline-none focus:border-black transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
              Conferma password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-none py-4 pl-12 pr-4 text-black focus:outline-none focus:border-black transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {message && (
            <div className={`text-sm text-center py-3 px-4 border ${
              message.includes('successo') 
                ? 'border-green-900 text-green-500 bg-green-950/20' 
                : 'border-red-900 text-red-500 bg-red-950/20'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-5 font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aggiornamento...' : 'Aggiorna password'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-zinc-400 hover:text-black transition-colors"
          >
            Torna al login
          </button>
        </div>

        <div className="text-center text-[9px] text-zinc-200 uppercase tracking-[0.5em] pt-8">
          &copy; 2026 1N PROJECT.
        </div>
      </div>
    </div>
  );
}
