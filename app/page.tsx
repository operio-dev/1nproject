"use client";

import React, { useState, useEffect, useRef, memo } from 'react';
import { Lock, User, Users, ArrowUpRight, LogOut, CreditCard, Flame, Star, Home as HomeIcon, UserCircle, Send } from 'lucide-react';
import { TOTAL_SLOTS, MOCK_STATEMENTS } from '@/lib/constants';
import { CountdownTime } from '@/lib/types';
import { translations } from '@/lib/translations';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Genera hash blockchain deterministico basato su email
const generateBlockchainHash = (email: string): string => {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }
  
  const hex = Math.abs(hash).toString(16).toUpperCase();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = email.split('').slice(0, 3).map(c => 
    letters[c.charCodeAt(0) % letters.length]
  ).join('');
  
  return `${randomLetters}${hex.padStart(6, '0').slice(0, 6)}`;
};

const DashboardHome = memo(({ memberNumber, elapsedTime, totalMembers, lang }: { memberNumber: number | null, elapsedTime: CountdownTime, totalMembers: number, lang: 'it' | 'en' }) => {
  const t = translations[lang];
  const memberProgress = (totalMembers / TOTAL_SLOTS) * 100;

  const totalElapsedDays = elapsedTime.days;
  const cycleDuration = 30;

  let currentLevelIndex = Math.floor(totalElapsedDays / cycleDuration);
  
  const maxLevelIndex = t.levels.length - 1;
  if (currentLevelIndex > maxLevelIndex) {
    currentLevelIndex = maxLevelIndex;
  }
  
  const currentLevelName = t.levels[currentLevelIndex];

  const daysIntoLevel = totalElapsedDays % cycleDuration;
  let levelProgress = (daysIntoLevel / cycleDuration) * 100;
  
  let daysRemainingInLevel = cycleDuration - daysIntoLevel;

  const isMaxLevelReached = currentLevelIndex === maxLevelIndex;
  if (isMaxLevelReached) {
      levelProgress = 100;
      daysRemainingInLevel = 0;
  }

  return (
    <div className="flex-1 flex flex-col justify-between items-center w-full max-w-sm mx-auto pt-6 pb-28 px-6 animate-in fade-in slide-in-from-bottom-6 duration-700 h-full overflow-hidden text-black">
      <div className="bg-black text-white px-5 py-2 rounded-full shadow-2xl scale-90 sm:scale-100">
        <span className="text-[18px] font-black tracking-tighter">
          #{memberNumber}
        </span>
      </div>

      <div className="text-center space-y-1">
        <p className="text-zinc-500 font-black text-[9px] uppercase tracking-[0.3em]">{t.dash_time_spent}</p>
        <h2 className="text-5xl font-black tracking-tighter font-sans leading-none">
          {String(elapsedTime.days).padStart(2, '0')}:{String(elapsedTime.hours).padStart(2, '0')}:{String(elapsedTime.minutes).padStart(2, '0')}:{String(elapsedTime.seconds).padStart(2, '0')}
        </h2>
      </div>

      <div className="w-full space-y-3">
        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">
          <div className="flex items-center gap-1.5"><Flame size={12} className="text-orange-500 fill-orange-500" /><span>{t.dash_status_active}</span></div>
          <div className="flex items-center gap-1.5"><Star size={12} className="text-zinc-400" /><span>{currentLevelName}</span></div>
        </div>
        <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/20 p-[1px]">
          <div className="h-full bg-gradient-to-r from-zinc-500 to-black rounded-full transition-all duration-1000" style={{ width: `${levelProgress}%` }} />
        </div>
        <div className="flex justify-between text-[9px] font-black text-zinc-600 uppercase tracking-tighter">
          <span>{t.dash_day(totalElapsedDays)}</span>
          <span>{!isMaxLevelReached ? t.dash_next_level_in(daysRemainingInLevel) : t.dash_max_level}</span>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-2 mt-4">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 overflow-visible">
            <circle cx="50" cy="50" r="42" fill="transparent" stroke="#eee" strokeWidth="6" />
            <circle cx="50" cy="50" r="42" fill="transparent" stroke="#000000" strokeWidth="6" strokeDasharray="264" strokeDashoffset={`${264 - (memberProgress / 100 * 264)}`} strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] transition-all duration-1000 ease-in-out" />
          </svg>
          <span className="absolute text-[14px] font-black text-black">{memberProgress < 1 && memberProgress > 0 ? '<1%' : `${Math.floor(memberProgress)}%`}</span>
        </div>
        <div className="text-center">
          <div className="text-4xl font-black tracking-tighter leading-tight">{totalMembers.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US')}</div>
          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] -mt-1">{t.dash_active_members}</div>
          <div className="text-[9px] text-zinc-300 uppercase tracking-widest whitespace-nowrap opacity-60 mt-1.5">{t.dash_out_of(TOTAL_SLOTS.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US'))}</div>
        </div>
      </div>
    </div>
  );
});

const CommunityTab = memo(({ lang, memberNumber }: { lang: 'it' | 'en', memberNumber: number | null }) => {
  const t = translations[lang];
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  type ChatMessage = {
    id: number;
    number: string;
    text: string;
  };
  
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(
    MOCK_STATEMENTS.map((msg, idx) => ({
      id: msg.id,
      number: msg.number.toString().padStart(6, '0'),
      text: t.mock_statements[idx % t.mock_statements.length]
    }))
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now(),
      number: memberNumber?.toString().padStart(6, '0') || '000000',
      text: inputMessage
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto animate-in fade-in slide-in-from-right-6 duration-500 overflow-hidden text-black">
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 no-scrollbar overscroll-contain scroll-smooth">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col items-start space-y-1 max-w-[85%]">
              <div className="bg-zinc-100 text-black px-4 py-3 rounded-2xl text-[14px] font-medium shadow-sm leading-snug">
                <span className="font-bold text-[9px] block opacity-30 mb-1 tracking-widest uppercase">#{msg.number}</span>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} className="h-4" />
        </div>
      </div>
      <div className="flex-none w-full px-6 py-4 bg-white border-t border-zinc-100 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
        <div className="w-full max-w-sm mx-auto relative group">
          <input 
            type="text" 
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t.comm_placeholder} 
            className="w-full bg-zinc-100 border border-zinc-200 rounded-full py-4 px-6 text-[15px] focus:outline-none focus:border-black/20 transition-all pr-14 placeholder:text-zinc-300 text-black" 
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} fill="black" />
          </button>
        </div>
      </div>
    </div>
  );
});

const ProfileTab = memo(({ onLogout, userEmail, onManageSubscription, lang }: { onLogout: () => void, userEmail: string, onManageSubscription: () => void, lang: 'it' | 'en' }) => {
  const t = translations[lang];
  const blockchainHash = generateBlockchainHash(userEmail);
  
  return (
    <div className="flex-1 flex flex-col justify-center items-center w-full max-w-xs mx-auto space-y-12 animate-in fade-in zoom-in duration-500 px-6 h-full text-black">
      <div className="text-center space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-black">{t.profile_id}</h3>
        <p className="text-zinc-400 font-mono text-sm tracking-tighter break-all px-4">{userEmail}</p>
      </div>
      <div className="space-y-4 w-full">
        <button 
          onClick={onManageSubscription}
          className="w-full py-5 bg-white border border-black text-black text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-black hover:text-white transition-all duration-300"
        >
          <CreditCard size={16} />
          <span>{t.profile_manage}</span>
        </button>
        <button 
          onClick={onLogout} 
          className="w-full py-5 bg-white border border-black text-black text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-300"
        >
          <LogOut size={16} />
          <span>{t.profile_leave}</span>
        </button>
      </div>
      
      <div className="text-center">
        <p className="text-[9px] text-zinc-400 font-mono uppercase tracking-[0.3em]">
          PROTOCOLLATO • NODO 0X{blockchainHash}
        </p>
      </div>
    </div>
  );
});

export default function Home() {
  const [lang, setLang] = useState<'it' | 'en'>('it');
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [elapsedTime, setElapsedTime] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [memberJoinDate, setMemberJoinDate] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [totalMembers, setTotalMembers] = useState(0);
  const [activeTab, setActiveTab] = useState<'home' | 'community' | 'profile'>('home');
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const t = translations[lang];

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    loadData();
  }, []);

  // ✅ NUOVO: Polling dopo pagamento completato
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const selectedNumber = urlParams.get('number');
    
    if (success === 'true' && selectedNumber) {
      console.log('Payment successful, waiting for webhook...');
      setLoading(true);
      
      const checkMemberCreated = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        
        const { data: member } = await supabase
          .from('members')
          .select('member_number')
          .eq('user_id', user.id)
          .maybeSingle();
        
        return !!member;
      };
      
      let attempts = 0;
      const maxAttempts = 15;
      
      const pollInterval = setInterval(async () => {
        attempts++;
        const memberExists = await checkMemberCreated();
        
        if (memberExists) {
          console.log('Member created! Loading dashboard...');
          clearInterval(pollInterval);
          await loadData();
          window.history.replaceState({}, '', '/');
        } else if (attempts >= maxAttempts) {
          console.log('Timeout waiting for webhook');
          clearInterval(pollInterval);
          await loadData();
          window.history.replaceState({}, '', '/');
          alert('Pagamento completato! Se non vedi subito il tuo numero, ricarica la pagina tra qualche secondo.');
        }
      }, 2000);
      
      return () => clearInterval(pollInterval);
    }
  }, []);

  const loadData = async () => {
    try {
      await fetchTotalMembers();
      await checkMembership();
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    } finally {
      setDataLoaded(true);
    }
  };

  const checkMembership = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserEmail(user.email || '');
        
        const { data: member } = await supabase
          .from('members')
          .select('member_number, join_date')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (member) {
          setMemberNumber(member.member_number);
          setMemberJoinDate(new Date(member.join_date).getTime());
        }
      }
    } catch (error) {
      console.error('Error checking membership:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalMembers = async () => {
    try {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      setTotalMembers(count || 0);
    } catch (error) {
      console.error('Error fetching total members:', error);
      setTotalMembers(0);
    }
  };

  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (memberNumber) {
      setCount(totalMembers);
      return;
    }
    
    if (hasAnimatedRef.current) {
      setCount(totalMembers);
      return;
    }
    
    if (totalMembers === 0) {
      return;
    }
    
    hasAnimatedRef.current = true;
    
    const duration = 2000;
    const start = 0;
    const end = totalMembers;
    let startTime: number | null = null;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOutProgress * (end - start) + start));
      if (progress < 1) requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }, [memberNumber, totalMembers]);

  useEffect(() => {
    const updateTimers = () => {
      const now = new Date().getTime();
      const cycleDuration = 30 * 24 * 60 * 60 * 1000; 
      const epoch = new Date("2024-01-01T00:00:00Z").getTime();
      const nextCycle = epoch + (Math.floor((now - epoch) / cycleDuration) + 1) * cycleDuration;
      const differenceCountdown = nextCycle - now;

      if (differenceCountdown > 0) {
        setTimeLeft({
          days: Math.floor(differenceCountdown / (1000 * 60 * 60 * 24)),
          hours: Math.floor((differenceCountdown / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((differenceCountdown / 1000 / 60) % 60),
          seconds: Math.floor((differenceCountdown / 1000) % 60),
        });
      }

      if (memberJoinDate) {
        const differenceElapsed = now - memberJoinDate;
        if (differenceElapsed > 0) {
          setElapsedTime({
            days: Math.floor(differenceElapsed / (1000 * 60 * 60 * 24)),
            hours: Math.floor((differenceElapsed / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((differenceElapsed / 1000 / 60) % 60),
            seconds: Math.floor((differenceElapsed / 1000) % 60),
          });
        }
      }
    };
    
    const timer = setInterval(updateTimers, 1000);
    updateTimers();
    return () => clearInterval(timer);
  }, [memberJoinDate]);

  const handleLogin = () => {
    router.push('/login');
  };

  const handleJoinNow = () => {
    router.push('/select-number');
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const { url, error } = await response.json();
      
      if (error) {
        alert('Errore: ' + error);
        return;
      }
      
      window.location.href = url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Errore nella creazione della sessione. Riprova.');
    }
  };

  const handleLogout = async () => {
    setIsAnimating(true);
    await supabase.auth.signOut();
    setTimeout(() => {
      setMemberNumber(null);
      setMemberJoinDate(null);
      setUserEmail('');
      setActiveTab('home');
      setIsAnimating(false);
      window.location.href = '/';
    }, 400);
  };

  const progressPercentage = (totalMembers / TOTAL_SLOTS) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <img src="/logo.svg" alt="1Nothing" className="h-20 w-auto" />
      </div>
    );
  }

  if (memberNumber) {
    return (
      <div className={`h-[100dvh] bg-white text-black relative flex flex-col overflow-hidden transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
        <header className="fixed top-0 left-0 w-full px-8 py-6 z-[60] flex justify-between items-center bg-gradient-to-b from-white to-transparent">
          <img src="/logo.svg" alt="1Nothing" className="h-16 w-auto" />
          <button onClick={() => setLang(l => l === 'it' ? 'en' : 'it')} className="text-[10px] font-black tracking-widest text-zinc-500 hover:text-white transition-colors border border-zinc-200 px-2 py-1 uppercase pointer-events-auto">
            {lang === 'it' ? 'EN' : 'IT'}
          </button>
        </header>
        <main className="flex-1 flex flex-col pt-16 overflow-hidden relative">
          {activeTab === 'home' && <DashboardHome memberNumber={memberNumber} elapsedTime={elapsedTime} totalMembers={totalMembers} lang={lang} />}
          {activeTab === 'community' && <CommunityTab lang={lang} memberNumber={memberNumber} />}
          {activeTab === 'profile' && <ProfileTab onLogout={handleLogout} userEmail={userEmail} onManageSubscription={handleManageSubscription} lang={lang} />}
        </main>
        <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-3xl border-t border-zinc-100/50 px-10 pb-[calc(1.2rem+safe-area-inset-bottom)] pt-4 z-[100]">
          <div className="max-w-md mx-auto flex justify-between items-center">
            <button onClick={() => setActiveTab('home')} className={`p-2 transition-all duration-300 ${activeTab === 'home' ? 'text-black scale-125' : 'text-zinc-300'}`}><HomeIcon size={24} strokeWidth={activeTab === 'home' ? 3 : 2} /></button>
            <button onClick={() => setActiveTab('community')} className={`p-2 transition-all duration-300 ${activeTab === 'community' ? 'text-black scale-125' : 'text-zinc-300'}`}><Users size={24} strokeWidth={activeTab === 'community' ? 3 : 2} /></button>
            <button onClick={() => setActiveTab('profile')} className={`p-2 transition-all duration-300 ${activeTab === 'profile' ? 'text-black scale-125' : 'text-zinc-300'}`}><UserCircle size={24} strokeWidth={activeTab === 'profile' ? 3 : 2} /></button>
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white text-black selection:bg-white selection:text-black transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
      <div className="fixed top-0 left-0 w-full h-[2px] bg-zinc-100 z-50">
        <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }} />
      </div>

      <header className="fixed top-0 left-0 w-full flex justify-between items-center px-6 py-8 z-40 bg-gradient-to-b from-white to-transparent">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="1Nothing" className="h-16 w-auto" />
          <button onClick={() => setLang(l => l === 'it' ? 'en' : 'it')} className="text-[10px] font-black tracking-widest text-zinc-500 hover:text-white transition-colors border border-zinc-200 px-2 py-1 uppercase">
            {lang === 'it' ? 'EN' : 'IT'}
          </button>
        </div>
        <button onClick={handleLogin} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-zinc-200 bg-white/50 backdrop-blur-md px-5 py-2.5 hover:bg-white hover:text-white transition-all duration-300 rounded-none shadow-sm">
          <User size={14} /> <span>{t.header_login}</span>
        </button>
      </header>

      <main className="relative pt-32 pb-20 px-6 max-w-lg mx-auto">
        <section className="space-y-12">
          <div className="space-y-2">
            <div className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black">{t.landing_reserved}</div>
            <div className="text-5xl md:text-6xl font-black tracking-tight font-sans">
              {count.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US')} <span className="text-zinc-400">/</span> {TOTAL_SLOTS.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US')}
            </div>
            <div className="h-px w-full bg-zinc-100 mt-4" />
          </div>
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-black leading-[1.05] tracking-tight">{lang === 'it' ? <>Paga 1€ al mese.<br />Per niente.</> : <>Pay 1€ a month.<br />For nothing.</>}</h1>
            <p className="text-zinc-400 text-lg font-light leading-relaxed">{t.landing_desc(TOTAL_SLOTS.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US'))}</p>
          </div>
          <div className="space-y-6">
            <button onClick={handleJoinNow} className="group relative w-full bg-white text-black py-6 rounded-none font-black text-xl flex items-center justify-center gap-2 overflow-hidden hover:scale-[0.98] transition-transform active:scale-95">
              <span className="relative z-10">{t.landing_main_btn}</span>
              <ArrowUpRight className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
            <div className="flex flex-col items-center gap-1">
              <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{t.landing_subscription}</span>
              <div className="flex items-center gap-1 text-zinc-600 text-[9px] uppercase tracking-tighter"><Lock size={10} /> <span>{t.landing_blockchain}</span></div>
            </div>
          </div>
        </section>

        <section className="mt-24 bg-zinc-50 border border-zinc-100 p-8 space-y-8 text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-600 font-black">{t.landing_next_cancel}</div>
          <div className="flex justify-center gap-5 text-2xl font-black font-mono">
            <div className="flex flex-col"><span>{String(timeLeft.days).padStart(2, '0')}</span><span className="text-[8px] text-zinc-300 tracking-widest pt-1 uppercase">{t.timer_days}</span></div>
            <span className="text-zinc-400 opacity-30">:</span>
            <div className="flex flex-col"><span>{String(timeLeft.hours).padStart(2, '0')}</span><span className="text-[8px] text-zinc-300 tracking-widest pt-1 uppercase">{t.timer_hours}</span></div>
            <span className="text-zinc-400 opacity-30">:</span>
            <div className="flex flex-col"><span>{String(timeLeft.minutes).padStart(2, '0')}</span><span className="text-[8px] text-zinc-300 tracking-widest pt-1 uppercase">{t.timer_min}</span></div>
            <span className="text-zinc-400 opacity-30">:</span>
            <div className="flex flex-col"><span className="text-black">{String(timeLeft.seconds).padStart(2, '0')}</span><span className="text-[8px] text-zinc-300 tracking-widest pt-1 uppercase">{t.timer_sec}</span></div>
          </div>
        </section>

        <footer className="mt-32 border-t border-zinc-100 pt-16 pb-12 text-center space-y-8">
          <img src="/logo.svg" alt="1Nothing" className="h-24 w-auto mx-auto opacity-50" />
          <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-[0.5em]">&copy; 2026 {t.footer_project}.</p>
        </footer>
      </main>
    </div>
  );
}
