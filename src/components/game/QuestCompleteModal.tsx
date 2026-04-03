import { useState } from 'react';
import { X } from 'lucide-react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { awardInsightBonus } from '@/hooks/useXP';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface QuestCompleteModalProps {
  quest: {
    id: number;
    title: string;
    xp: number;
    cat?: string;
  };
  xpGained: number;
  onClose: () => void;
  rerender: () => void;
}

export default function QuestCompleteModal({
  quest,
  xpGained,
  onClose,
  rerender,
}: QuestCompleteModalProps) {
  const [phase, setPhase] = useState(1);
  const [what, setWhat] = useState('');
  const [unexpected, setUnexpected] = useState('');
  const [highFiveTo, setHighFiveTo] = useState<string | null>(null);

  const otherMembers = Object.entries(MEMBERS).filter(([id]) => id !== S.me);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  function submitPhase1() {
    if (!what.trim()) return;
    // Spara genomförande på quest
    const q = S.quests.find((q: any) => q.id === quest.id);
    if (q) q.completionNote = what;
    save();
    setPhase(2);
  }

  function submitPhase2() {
    // Insikt + bonus XP hanteras av awardInsightBonus i useXP
    awardInsightBonus(quest.id, unexpected, quest.title);
    setPhase(3);
  }

  function submitHighFive() {
    if (highFiveTo) {
      S.feed.unshift({
        who: S.me,
        action: `gav en high-five till ${highFiveTo} 🙌`,
        xp: 0,
        ts: new Date().toLocaleTimeString('sv-SE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
      save();
    }
    rerender();
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quest genomfört"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-border)',
          padding: '28px 24px',
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
        }}
      >
        {/* Stäng-knapp */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          <X size={18} />
        </button>

        {/* Progress-indikator */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginBottom: 24,
        }}>
          {[1, 2, 3].map((p) => (
            <div
              key={p}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                background: phase >= p
                  ? 'var(--color-primary)'
                  : 'var(--color-border)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* ── Fas 1: Genomförande ── */}
        {phase === 1 && (
          <>
            <div style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              fontFamily: 'var(--font-ui)',
            }}>
              UPPDRAG SLUTFÖRT
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 20,
              lineHeight: 1.3,
            }}>
              {quest.title}
            </div>
            <div style={{
              fontSize: 14,
              color: 'var(--color-text-muted)',
              marginBottom: 12,
            }}>
              Vad gjorde du — och hur gick det?
            </div>
            <textarea
              autoFocus
              rows={4}
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="Skriv fritt..."
              style={{
                width: '100%',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                padding: '12px',
                fontSize: 14,
                resize: 'none',
                fontFamily: 'var(--font-body)',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={submitPhase1}
              disabled={!what.trim()}
              style={{
                marginTop: 16,
                width: '100%',
                background: what.trim()
                  ? 'var(--color-primary)'
                  : 'var(--color-border)',
                color: what.trim()
                  ? '#fff'
                  : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '12px',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.08em',
                cursor: what.trim() ? 'pointer' : 'not-allowed',
                touchAction: 'manipulation',
              }}
            >
              FORTSÄTT
            </button>
          </>
        )}

        {/* ── Fas 2: Lärande ── */}
        {phase === 2 && (
          <>
            <div style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              fontFamily: 'var(--font-ui)',
            }}>
              REFLEKTION
            </div>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 20,
              lineHeight: 1.4,
            }}>
              Vad var det mest oväntade?
            </div>
            <textarea
              autoFocus
              rows={4}
              value={unexpected}
              onChange={(e) => setUnexpected(e.target.value)}
              placeholder="Valfritt — ger +15 XP om du svarar..."
              style={{
                width: '100%',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                padding: '12px',
                fontSize: 14,
                resize: 'none',
                fontFamily: 'var(--font-body)',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={submitPhase2}
              style={{
                marginTop: 16,
                width: '100%',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '12px',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {unexpected.trim() ? 'SPARA INSIKT (+15 XP)' : 'HOPPA ÖVER'}
            </button>
          </>
        )}

        {/* ── Fas 3: Bekräftelse + High-five ── */}
        {phase === 3 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                fontSize: 32,
                marginBottom: 8,
              }}>
                ⚡
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--color-primary)',
                marginBottom: 4,
              }}>
                +{xpGained + (unexpected.trim() ? 15 : 0)} XP
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
              }}>
                {quest.title}
              </div>
            </div>

            <div style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              marginBottom: 12,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.08em',
            }}>
              GE EN HIGH-FIVE
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 20,
            }}>
              {otherMembers.map(([id, m]) => (
                <button
                  key={id}
                  onClick={() => setHighFiveTo(
                    highFiveTo === id ? null : id
                  )}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid',
                    borderColor: highFiveTo === id
                      ? 'var(--color-primary)'
                      : 'var(--color-border)',
                    background: highFiveTo === id
                      ? 'var(--color-primary)'
                      : 'transparent',
                    color: highFiveTo === id
                      ? '#fff'
                      : 'var(--color-text-muted)',
                    fontSize: 13,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {(m as any).name}
                </button>
              ))}
            </div>

            <button
              onClick={submitHighFive}
              style={{
                width: '100%',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '12px',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {highFiveTo ? `🙌 HIGH-FIVE TILL ${highFiveTo.toUpperCase()}` : 'KLAR'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
