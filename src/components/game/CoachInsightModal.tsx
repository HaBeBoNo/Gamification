import React, { useState } from 'react';
import { X } from 'lucide-react';
import { S, save } from '@/state/store';
import { buildCoachPrompt } from '@/hooks/useAI';
import { DEFAULT_COACH_NAMES } from '@/lib/coach';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MOBILE_DIALOG_QUERY } from '@/lib/responsive';

interface Props {
  insight: string;
  onClose: () => void;
}

export default function CoachInsightModal({ insight, onClose }: Props) {
  const isMobile = useMediaQuery(MOBILE_DIALOG_QUERY);
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: insight }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const coachName = (S.me && S.chars[S.me]?.coachName as string | undefined) || (S.me && DEFAULT_COACH_NAMES[S.me]) || 'Coach';

  async function handleSend() {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: S.me ? buildCoachPrompt(S.me) : 'Du är en coach.',
          messages: newMessages,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text?.trim();
      if (reply && S.me && S.chars[S.me]) {
        const charData = S.chars[S.me];
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        if (!charData.coachLog) charData.coachLog = [];
        charData.coachLog.push({ user: userMessage, coach: reply, ts: Date.now() });
        save();
      }
    } catch {}
    finally { setLoading(false); }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--color-overlay-backdrop)',
        zIndex: 400,
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={trapRef}
        style={{
        background: 'var(--color-surface)',
        borderRadius: isMobile ? '16px 16px 0 0' : '24px',
        border: '1px solid var(--color-border)',
        borderBottom: isMobile ? 'none' : '1px solid var(--color-border)',
        width: '100%',
        maxWidth: isMobile ? '100%' : 'min(100%, 32rem)',
        maxHeight: isMobile ? '70dvh' : 'min(80dvh, 44rem)',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: isMobile ? 'none' : 'var(--shadow-float)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Coachdialog med ${coachName}`}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 8px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.1em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)',
          }}>
            {coachName.toUpperCase()}
          </div>
          <button type="button" onClick={onClose} aria-label="Stäng coachdialog" style={{
            background: 'none', border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer', padding: 4,
            touchAction: 'manipulation',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Meddelanden */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user'
                ? 'var(--color-primary)'
                : 'var(--color-bg)',
              color: msg.role === 'user' ? 'var(--color-text-primary)' : 'var(--color-text)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--color-border)',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px',
              fontSize: 14, lineHeight: 1.5,
              maxWidth: '85%',
            }}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div style={{
              alignSelf: 'flex-start',
              color: 'var(--color-text-muted)',
              fontSize: 13, padding: '8px 0',
            }}>
              ...
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 8,
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Svara..."
            aria-label="Skriv svar till coachen"
            style={{
              flex: 1,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '999px',
              color: 'var(--color-text)',
              padding: '10px 14px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
            }}
          />
          <button type="button"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label="Skicka svar"
            style={{
              background: input.trim() ? 'var(--color-primary)' : 'var(--color-border)',
              color: 'var(--color-text-primary)', border: 'none',
              borderRadius: '999px',
              padding: '10px 16px',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation',
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
