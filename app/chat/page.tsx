"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  user_id: string;
  member_number: number;
  message: string;
  created_at: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Scroll automatico quando arrivano nuovi messaggi
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Carica user e member info
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setCurrentUser(user);

      // Get member number
      const { data: member } = await supabase
        .from('members')
        .select('member_number')
        .eq('user_id', user.id)
        .single();
      
      if (member) {
        setMemberNumber(member.member_number);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  // 2. Carica messaggi esistenti
  useEffect(() => {
    if (!currentUser) return;
    
    fetchMessages();
  }, [currentUser]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Subscribe a nuovi messaggi (REALTIME!)
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('📨 Nuovo messaggio!', payload.new);
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // 4. Invia messaggio
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !currentUser || !memberNumber) return;

    setSending(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          user_id: currentUser.id,
          member_number: memberNumber,
          message: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Errore durante invio messaggio');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Chat Globale</h1>
            <p className="text-sm text-zinc-400">
              {memberNumber && `Tu sei #${memberNumber.toString().padStart(6, '0')}`}
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="text-sm text-zinc-400 hover:text-black transition-colors"
          >
            Torna alla dashboard
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-zinc-400 py-12">
              Nessun messaggio ancora. Inizia la conversazione!
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.user_id === currentUser?.id;
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] ${
                      isOwn
                        ? 'bg-black text-white'
                        : 'bg-zinc-100 text-black'
                    } px-4 py-3 rounded-lg`}
                  >
                    <div className="text-[10px] uppercase tracking-widest font-black mb-1 opacity-70">
                      #{msg.member_number.toString().padStart(6, '0')}
                    </div>
                    <p className="text-sm break-words">{msg.message}</p>
                    <div className="text-[9px] mt-1 opacity-50">
                      {new Date(msg.created_at).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="bg-white border-t border-zinc-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Scrivi un messaggio..."
              disabled={sending}
              className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-black transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-black text-white px-6 py-3 rounded-lg font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
