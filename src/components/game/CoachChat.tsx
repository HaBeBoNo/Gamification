import React, { useState, useRef, useEffect } from 'react';
import { S, save } from '@/state/store';
import { buildCoachPrompt, DEFAULT_COACH_NAMES } from '@/hooks/useAI';
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

  // Konversationshistorik för API-anrop (role/content-format)
  const [history, setHistory] = useState<{ role: string; content: string }[]>(() => {
    // Återställ från coachLog om det finns
    const log = S.chars[S.me]?.coachLog;
    if (Array.isArray(log) && log.length > 0) {
      const restored: { role: string; content: string }[] = [];
      for (const entry of log.slice(-10)) {
        if (entry.user) restored.push({ role: 'user', content: entry.user });
        if (entry.coach) restored.push({ role: 'assistant', content: entry.coach });
      }
      return restored;
    }
    return [];
  });

  // Visuella meddelanden (type/text/ts-format för rendering)
  const [messages, setMessages] = useState<Message[]>(() => {
    const log = S.chars[S.me]?.coachLog;
    if (Array.isArray(log) && log.length > 0) {
      const restored: Message[] = [];
      for (const entry of log.slice(-10)) {
        const ts = entry.ts ? new Date(entry.ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
        if (entry.user) restored.push({ type: 'user', text: entry.user, ts });
        if (entry.coach) restored.push({ type: 'ai', text: entry.coach, ts });
      }
      return restored;
    }
    return [];
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const coachName = S.chars[S.me]?.coachName ||
    ({ hannes: 'Scout', martin: 'Brodern', niklas: 'Arkitekten', carl: 'Analytikern',
       nisse: 'Spegeln', simon: 'Rådgivaren', johannes: 'Kartläggaren', ludvig: 'Katalysatorn' } as Record<string, string>)[S.me] || 'Coach';

  const handlePressStart = () => {
    pressTimer.current = setTimeout(() => {
      const newName = window.prompt('Byt namn på din coach:', coachName);
      if (newName?.trim()) {
        S.chars[S.me].coachName = newName.trim();
        save();
        rerender();
      }
    }, 500);
  };

  const handlePressEnd = () => clearTimeout(pressTimer.current);

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

    const userMessage = input.trim();
    setInput('');

    // Lägg till användarens meddelande visuellt
    setMessages(p => [...p, { type: 'user', text: userMessage, ts: now() }]);

    // Bygg API-historik med användarens nya meddelande
    const newHistory = [...history, { role: 'user', content: userMessage }];
    setHistory(newHistory);
    setLoading(true);

    try {
      const systemPrompt = buildCoachPrompt(S.me);

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          system: systemPrompt,
          messages: newHistory,
        }),
      });

      if (!response.ok) throw new Error(`API ${response.status}`);

      const data = await response.json();
      const reply = data.content?.[0]?.text?.trim() || 'Något gick fel. Försök igen.';

      // Lägg till coach-svaret i historiken
      setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      setMessages(p => [...p, { type: 'ai', text: reply, ts: now() }]);

      // Spara i coachLog för persistens
      if (!S.chars[S.me].coachLog) S.chars[S.me].coachLog = [];
      S.chars[S.me].coachLog.push({
        user: userMessage,
        coach: reply,
        ts: Date.now(),
      });
      // Behåll max 20 log-entries
      if (S.chars[S.me].coachLog.length > 20) {
        S.chars[S.me].coachLog = S.chars[S.me].coachLog.slice(-20);
      }
      save();
    } catch {
      setHistory(prev => [...prev, { role: 'assistant', content: 'Kunde inte nå coachen just nu.' }]);
      setMessages(p => [...p, { type: 'ai', text: 'Kunde inte nå coachen just nu.', ts: now() }]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const active = input.trim().length > 0;

  return (
    <div className="coach-chat">
      <div className="coach-chat-header">
        <span
          className="coach-name-label"
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          style={{ cursor: 'default', userSelect: 'none' }}
          title="Håll inne för att byta namn"
        >
          {coachName}
        </span>
      </div>
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
