import React, { useState, useRef, useEffect } from 'react';
import { S } from '@/state/store';
import { refreshCoach } from '@/hooks/useAI';
import { Send, Bot, MessageCircle } from 'lucide-react';

interface Message {
  type: 'ai' | 'user';
  text: string;
  ts: string;
}

function now() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export default function CoachChat({ rerender }: { rerender: () => void }) {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    if (S.coachText) return [{ type: 'ai' as const, text: S.coachText, ts: now() }];
    return [];
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 80) + 'px';
    }
  }, [input]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput('');
    setMessages(p => [...p, { type: 'user', text: txt, ts: now() }]);
    setLoading(true);
    const text = await refreshCoach();
    S.coachText = text;
    setLoading(false);
    setMessages(p => [...p, { type: 'ai', text, ts: now() }]);
    rerender();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const active = input.trim().length > 0;

  return (
    <div className="coach-chat">
      <div className="coach-chat-scroll" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="empty-state">
            <MessageCircle size={48} strokeWidth={1} />
            <div className="empty-text">Din coach är redo. Skriv något.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`cc-msg ${m.type === 'ai' ? 'cc-ai' : 'cc-user'}`}>
            {m.type === 'ai' && (
              <div className="cc-avatar">
                <Bot size={20} />
              </div>
            )}
            <div>
              <div className={m.type === 'ai' ? 'cc-bubble-ai' : 'cc-bubble-user'}>{m.text}</div>
              <div className={`cc-ts ${m.type === 'ai' ? '' : 'cc-ts-right'}`}>{m.ts}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="cc-msg cc-ai">
            <div className="cc-avatar">
              <Bot size={20} />
            </div>
            <div className="cc-bubble-ai">
              <div className="cc-typing"><span /><span /><span /></div>
            </div>
          </div>
        )}
      </div>
      <div className="cc-input-bar">
        <textarea
          ref={taRef}
          className="cc-input"
          placeholder="Skriv till coachen..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={loading}
        />
        <button
          className={`cc-send ${active ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!active || loading}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
