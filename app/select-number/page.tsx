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

  const handleCheckout = async () => {
    if (!selectedNumber) return;
    
    setCheckoutLoading(true);
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe not loaded');

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (stripeError) {
        throw stripeError;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Errore durante il checkout');
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
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full px-6 py-8 z-40 bg-gradient-to-b from-white to-transparent">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-black transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={14} />
            <span>Indietro</span>
          </button>
          <div className="text-2xl font-black tracking-tighter">1N</div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-zinc-100 z-50">
        <div 
          className="h-full bg-black transition-all duration-1000 ease-out" 
          style={{ width: `${progressPercentage}%` }} 
        />
      </div>

      <main className="pt-32 px-6 max-w-4xl mx-auto">
        {/* Title */}
        <div className="space-y-4 mb-12">
          <div className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black">
            Scegli il tuo numero
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            {availableCount.toLocaleString('it-IT')} numeri disponibili
          </h1>
          <div className="h-px w-full bg-zinc-200" />
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="number"
              min="1"
              max={TOTAL_NUMBERS}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Cerca un numero specifico..."
              className="w-full bg-white border border-zinc-200 rounded-none py-4 pl-12 pr-24 text-black focus:outline-none focus:border-black transition-colors"
            />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors"
            >
              Cerca
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8">
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
                    aspect-square flex items-center justify-center text-sm font-medium
                    transition-all duration-200 relative overflow-hidden
                    ${blocked
                      ? 'col-span-2 row-span-2 bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 text-black cursor-not-allowed border-2 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.5)] animate-pulse font-bold'
                      : isTaken 
                      ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed border border-zinc-200' 
                      : isSelected
                      ? 'bg-black text-white scale-110 shadow-lg border-2 border-black'
                      : 'bg-white text-black hover:bg-zinc-50 border border-zinc-200 hover:border-black hover:scale-105'
                    }
                  `}
                >
                  {blocked && (
                    <Lock 
                      size={num === 1 ? 20 : 24} 
                      className="absolute top-1 right-1 opacity-50" 
                    />
                  )}
                  <span className={blocked ? 'text-lg' : ''}>
                    {num}
                  </span>
                </button>
                
                {/* Tooltip */}
                {blocked && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 whitespace-nowrap">
                    <div className="bg-white border border-yellow-600 px-3 py-2 rounded text-xs shadow-lg">
                      <p className="font-bold text-yellow-600">
                        {num === 1 ? '🏆 IL PRIMO' : '🏆 L\'ULTIMO'}
                      </p>
                      <p className="text-zinc-600 text-[10px]">Riservato. Non disponibile.</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mb-12">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-2 text-zinc-400 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={14} />
            <span>Precedente</span>
          </button>
          
          <div className="text-zinc-500 text-sm font-mono">
            Pagina {currentPage} di {TOTAL_PAGES.toLocaleString('it-IT')}
          </div>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(TOTAL_PAGES, p + 1))}
            disabled={currentPage === TOTAL_PAGES}
            className="flex items-center gap-2 text-zinc-400 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest"
          >
            <span>Successivo</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Checkout */}
        {selectedNumber && (
          <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-zinc-200 p-6 z-50">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">
                    Numero selezionato
                  </div>
                  <div className="text-3xl font-black tracking-tight">
                    #{selectedNumber.toString().padStart(6, '0')}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-black">Disponibile</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 px-4 py-3 text-sm">
                  <XCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full bg-black text-white py-5 font-black text-base uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Caricamento...</span>
                  </>
                ) : (
                  <span>Conferma e paga 0,99€/mese</span>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
