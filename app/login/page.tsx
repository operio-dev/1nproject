"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Lock, X } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [message, setMessage] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          },
        });
        
        if (error) throw error;
        setMessage('Controlla la tua email per confermare la registrazione');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        router.push('/select-number');
        router.refresh();
      }
    } catch (error: any) {
      setMessage(error.message || 'Errore durante l\'autenticazione');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      });

      if (error) throw error;
      
      setResetMessage('Email inviata! Controlla la tua casella di posta.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail('');
        setResetMessage('');
      }, 3000);
    } catch (error: any) {
      setResetMessage(error.message || 'Errore durante l\'invio dell\'email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-zinc-400 hover:text-black transition-colors text-sm font-black uppercase tracking-widest"
        >
          <ArrowLeft size={16} />
          <span>Indietro</span>
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tight">
            {mode === 'login' ? 'Accedi' : 'Registrati'}
          </h1>
          <p className="text-zinc-400 text-sm">
            {mode === 'login' 
              ? 'Entra nel Nulla' 
              : 'Unisciti ai primi 100.000'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-zinc-50 border border-zinc-200 rounded-none py-4 pl-12 pr-4 text-black focus:outline-none focus:border-black transition-colors"
                placeholder="tuo@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
              Password
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

          {/* ✅ Password dimenticata - solo in modalità login */}
          {mode === 'login' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-zinc-400 hover:text-black transition-colors"
              >
                Password dimenticata?
              </button>
            </div>
          )}

          {message && (
            <div className={`text-sm text-center py-3 px-4 border ${
              message.includes('Controlla') 
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
            {loading ? 'Caricamento...' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setMessage('');
            }}
            className="text-sm text-zinc-400 hover:text-black transition-colors"
          >
            {mode === 'login' 
              ? 'Non hai un account? Registrati' 
              : 'Hai già un account? Accedi'}
          </button>
        </div>

        <div className="text-center text-[9px] text-zinc-200 uppercase tracking-[0.5em] pt-8">
          &copy; 2026 1N PROJECT.
        </div>
      </div>

      {/* ✅ MODALE PASSWORD DIMENTICATA */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6 z-50">
          <div className="bg-white p-8 max-w-md w-full space-y-6 relative">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmail('');
                setResetMessage('');
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-black transition-colors"
            >
              <X size={20} />
            </button>

            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight">
                Recupera password
              </h2>
              <p className="text-sm text-zinc-400">
                Inserisci la tua email. Ti invieremo un link per reimpostare la password.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-none py-4 pl-12 pr-4 text-black focus:outline-none focus:border-black transition-colors"
                    placeholder="tuo@email.com"
                  />
                </div>
              </div>

              {resetMessage && (
                <div className={`text-sm text-center py-3 px-4 border ${
                  resetMessage.includes('inviata') 
                    ? 'border-green-900 text-green-500 bg-green-950/20' 
                    : 'border-red-900 text-red-500 bg-red-950/20'
                }`}>
                  {resetMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-black text-white py-4 font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? 'Invio...' : 'Invia link di recupero'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
