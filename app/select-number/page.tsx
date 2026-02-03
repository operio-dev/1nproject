"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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
    if (takenNumbers.has(number)) return;
    setSelectedNumber(number);
    setError('');
  };

  const handleCheckout = async () => {
    if (!selectedNumber) return;
    
    setCheckoutLoading(true);
    setError('');

    try {
      // Create checkout session
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
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

  const getPageNumbers = () => {
    const start = (currentPage - 1) * NUMBERS_PER_PAGE + 1;
    const end = Math.min(currentPage * NUMBERS_PER_PAGE, TOTAL_NUMBERS);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const availableCount = TOTAL_NUMBERS - takenNumbers.size;
  const progressPercentage = (takenNumbers.size / TOTAL_NUMBERS) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full px-6 py-8 z-40 bg-gradient-to-b from-black to-transparent">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={14} />
            <span>Indietro</span>
          </button>
          <div className="text-2xl font-black tracking-tighter">1N</div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-zinc-900 z-50">
        <div 
          className="h-full bg-white transition-all duration-1000 ease-out" 
          style={{ width: `${progressPercentage}%` }} 
        />
      </div>

      <main className="pt-32 px-6 max-w-4xl mx-auto">
        {/* Title */}
        <div className="space-y-4 mb-12">
          <div className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black">
            Scegli i
