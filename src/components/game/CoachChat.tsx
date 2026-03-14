import React, { useState, useRef, useEffect } from 'react';
import { S, save } from '@/state/store';
import { refreshCoach, DEFAULT_COACH_NAMES } from '@/hooks/useAI';
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
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const coachName = S.chars[S.me]?.coachName || DEFAULT_COACH_NAMES[S.me] || 'COACH';

  function onNamePressStart() {
    pressTimer.current = setTimeout(() => {
      setNameInput(coachName);
      setEditingName(true);
    }, 500);
  }

  function onNamePressEnd() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }

  function saveName() {
    const n = nameInput.trim().toUpperCase();
    if (n && S.chars[S.me]) {
      S.chars[S.me].coachName = n;
      save();
      rerender();
    }
    setEditingName(false);
  }

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
      <div className="coach-chat-header">
        {editingName ? (
          <input
            className="coach-name-edit"
            value={nameInput}
            onChange={e => setNameInput(e.target.value.toUpperCase())}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            maxLength={20}
            autoFocus
          />
        ) : (
          <span
            className="coach-name-label"
            onMouseDown={onNamePressStart}
            onMouseUp={onNamePressEnd}
            onMouseLeave={onNamePressEnd}
            onTouchStart={onNamePressStart}
            onTouchEnd={onNamePressEnd}
            title="Håll inne för att byta namn"
          >
            {coachName}
          </span>
        )}
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
