"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft, ArrowRight, Loader2, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const BLOCKED_NUMBERS = [1, 100000];
const isBlocked = (num: number) => BLOCKED_NUMBERS.includes(num);

export default function SelectNumberPage() {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [takenNumbers, setTakenNumbers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const supabase = createClient();
  
  const NUMBERS_PER_PAGE = 100;
  const TOTAL_NUMBERS = 100000;
  const TOTAL_PAGES = Math.ceil(TOTAL_NUMBERS / NUMBERS_PER_PAGE);

  useEffect(() => {
    fetchTakenNumbers();
  }, []);

  const fetchTakenNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('member_number');
      
      if (error) throw error;
      
      const taken = new Set(data.map(m => m.member_number));
      setTakenNumbers(taken);
    } catch (err) {
      console.error('Error fetching taken numbers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNumberClick = (number: number) => {
    if (takenNumbers.has(number) || isBlocked(number)) return;
    setSelectedNumber(number);
    setError('');
  };

  // --- LOGICA BLINDATA AGGIUNTA QUI ---
  const handleCheckout = async () => {
    if (!selectedNumber) return;
    
    setCheckoutLoading(true);
    setError('');

    try {
      // 1. Controllo "Atomico" nel DB prima di mandare a Stripe
      // Usiamo la RPC select_member_number che abbiamo creato nel punto 2
      const { error: rpcError } = await supabase.rpc('select_member_number', { 
        target_number: selectedNumber 
      });

      if (rpcError) {
        // Se il numero è stato preso un istante prima o l'utente ha già un numero
        if (rpcError.message.includes('unique_member_number')) {
          throw new Error("Troppo tardi! Questo numero è stato appena assegnato. Scegline un altro.");
        }
        throw new Error(rpcError.message);
      }

      // 2. Se il DB ha confermato (numero riservato temporaneamente o assegnato), procedi a Stripe
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nella creazione della sessione di pagamento');
      }

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe non caricato correttamente');

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (stripeError) throw stripeError;

    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Si è verificato un errore durante la procedura');
      
      // Se il numero era già preso, aggiorniamo la lista locale per l'utente
      fetchTakenNumbers();
      setCheckoutLoading(false);
    }
  };

  const handleSearch = () => {
    const num = parseInt(searchQuery);
    if (num >= 1 && num <= TOTAL_NUMBERS) {
      const page = Math.ceil(num / NUMBERS_PER_PAGE);
      setCurrentPage(page);
      setSelectedNumber(num);
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  const getPageNumbers = () => {
    const start = (currentPage - 1) * NUMBERS_PER_PAGE + 1;
    const end = Math.min(currentPage * NUMBERS_PER_PAGE, TOTAL_NUMBERS);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const availableCount = TOTAL_NUMBERS - takenNumbers.size - BLOCKED_NUMBERS.length;
  const progressPercentage = ((takenNumbers.size + BLOCKED_NUMBERS.length) / TOTAL_NUMBERS) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-black" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black pb-40">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-zinc-100 z-50">
        <div 
          className="h-full bg-black transition-all duration-1000 ease-out" 
          style={{ width: `${progressPercentage}%` }} 
        />
      </div>

      <header className="fixed top-0 left-0 w-full px-6 py-8 z-40 bg-white/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-black transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={14} />
            <span>Indietro</span>
          </button>
          <div className="font-black text-xl tracking-tighter">1NOTHING</div>
        </div>
      </header>

      <main className="pt-40 px-6 max-w-4xl mx-auto">
        <div className="space-y-4 mb-12">
          <div className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black">
            Scegli il tuo posto nel Nulla
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            {availableCount.toLocaleString('it-IT')} numeri disponibili
          </h1>
          <div className="h-px w-full bg-zinc-200" />
        </div>

        {/* Search */}
        <div className="mb-12">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Cerca un numero..."
              className="w-full bg-white border border-zinc-200 rounded-none py-4 pl-12 pr-24 text-black focus:border-black transition-colors"
            />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
            >
              Cerca
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 mb-12">
          {getPageNumbers().map((num) => {
            const isTaken = takenNumbers.has(num);
            const isSelected = selectedNumber === num;
            const blocked = isBlocked(num);
            
            return (
              <div key={num} className="relative group">
                <button
                  onClick={() => handleNumberClick(num)}
                  disabled={isTaken || blocked}
                  className={`
                    w-full aspect-square flex items-center justify-center text-sm
                    transition-all duration-200 relative
                    ${blocked
                      ? 'bg-zinc-900 text-yellow-500 cursor-not-allowed border-2 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                      : isTaken 
                      ? 'bg-zinc-50 text-zinc-200 cursor-not-allowed border border-zinc-100' 
                      : isSelected
                      ? 'bg-black text-white scale-110 z-10 shadow-2xl border-2 border-black font-black'
                      : 'bg-white text-zinc-400 hover:text-black border border-zinc-200 hover:border-black hover:z-10'
                    }
                  `}
                >
                  {blocked && <Lock size={12} className="absolute top-1 right-1" />}
                  {num}
                </button>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mb-20">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-2 text-zinc-400 hover:text-black disabled:opacity-20 uppercase font-black text-[10px] tracking-widest"
          >
            <ArrowLeft size={14} /> Precedente
          </button>
          <div className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
            Pagina {currentPage} / {TOTAL_PAGES}
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(TOTAL_PAGES, p + 1))}
            disabled={currentPage === TOTAL_PAGES}
            className="flex items-center gap-2 text-zinc-400 hover:text-black disabled:opacity-20 uppercase font-black text-[10px] tracking-widest"
          >
            Successivo <ArrowRight size={14} />
          </button>
        </div>

        {/* Floating Checkout Bar */}
        {selectedNumber && (
          <div className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-200 p-6 z-50 animate-in slide-in-from-bottom duration-500">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-black mb-1">Hai selezionato</div>
                  <div className="text-3xl font-black tracking-tighter italic">#{selectedNumber}</div>
                </div>
                <div className="h-10 w-px bg-zinc-100 hidden md:block" />
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Disponibile ora</span>
                </div>
              </div>

              <div className="w-full md:w-auto flex flex-col gap-2">
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-[10px] font-bold uppercase bg-red-50 p-2 border border-red-100">
                    <XCircle size={14} /> {error}
                  </div>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="bg-black text-white px-12 py-5 font-black uppercase tracking-[0.2em] text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 disabled:bg-zinc-400"
                >
                  {checkoutLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Conferma e Sottoscrivi"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
