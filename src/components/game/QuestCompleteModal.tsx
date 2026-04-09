import { useState, useEffect } from 'react';
import { Hand, X, Zap } from 'lucide-react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { awardInsightBonus } from '@/hooks/useXP';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { pushFeedEntry } from '@/lib/feed';
import { notifyMembersSignal } from '@/lib/notificationSignals';
import { buildCoachNextDirection, getQuestFocusReason, getRelevantActiveQuests } from '@/lib/questFocus';

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
  const [reflection, setReflection] = useState('');
  const me = S.me;
  const nextQuest = getRelevantActiveQuests(
    (S.quests || []).filter((item: any) => item.id !== quest.id),
    me || undefined,
    1
  )[0] || null;
  const [nextStep, setNextStep] = useState(nextQuest?.title || '');
  const [highFiveTo, setHighFiveTo] = useState<string | null>(null);

  const otherMembers = Object.entries(MEMBERS).filter(([id]) => id !== me);
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const coachName = me ? ((S.chars[me] as any)?.coachName || 'Coach') : 'Coach';
  const nextDirection = buildCoachNextDirection(quest, nextQuest);
  const totalXp = xpGained + (reflection.trim() ? 15 : 0);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  function submitPhase1() {
    setPhase(2);
  }

  function submitPhase2() {
    const q = S.quests.find((item: any) => item.id === quest.id);
    if (q) {
      q.completionNote = reflection.trim();
      q.nextStep = nextStep.trim();
    }
    if (reflection.trim()) {
      awardInsightBonus(quest.id, reflection, quest.title);
    } else {
      save();
    }
    setPhase(3);
  }

  function submitHighFive() {
    if (highFiveTo && me) {
      const targetName = (MEMBERS as Record<string, { name?: string }>)[highFiveTo]?.name || highFiveTo;
      const meName = (MEMBERS as Record<string, { name?: string }>)[me]?.name || me;
      pushFeedEntry({
        who: me,
        action: `gav en high-five till ${targetName}`,
        xp: 0,
      });
      void notifyMembersSignal({
        targetMemberKeys: [highFiveTo],
        type: 'high_five',
        title: `${meName} gav dig en high-five`,
        body: `Efter "${quest.title}"`,
        dedupeKey: `high-five:${me}:${highFiveTo}:${quest.id}`,
        payload: {
          memberId: me,
          questTitle: quest.title,
        },
        push: {
          title: `${meName} gav dig en high-five`,
          body: `Efter "${quest.title}"`,
          excludeMember: me,
        },
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
        padding: 'max(16px, env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))',
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
          maxWidth: '460px',
          maxHeight: 'min(88vh, 760px)',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Stäng-knapp */}
        <button
          onClick={onClose}
          aria-label="Stäng"
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

        {/* ── Fas 1: Riktning ── */}
        {phase === 1 && (
          <>
            <div style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              fontFamily: 'var(--font-ui)',
            }}>
              UPPDRAG LANDAT
            </div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                fontSize: 32,
                marginBottom: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Zap size={28} strokeWidth={1.9} />
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--color-primary)',
                marginBottom: 4,
              }}>
                +{xpGained} XP
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
              }}>
                {quest.title}
              </div>
            </div>
            <div style={{
              padding: 'var(--space-md)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}>
                {coachName}
              </div>
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 8,
                lineHeight: 1.4,
              }}>
                {nextDirection}
              </div>
              {nextQuest && (
                <div style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.45,
                }}>
                  {getQuestFocusReason(nextQuest, me || undefined)}
                </div>
              )}
            </div>
            {nextQuest && (
              <div style={{
                padding: 'var(--space-md)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                marginBottom: 16,
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  Fokus härnäst
                </div>
                <div style={{
                  fontSize: 'var(--text-body)',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}>
                  {nextQuest.title}
                </div>
                <div style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-muted)',
                }}>
                  {nextQuest.xp ?? '?'} XP
                </div>
              </div>
            )}
            <div style={{
              fontSize: 14,
              color: 'var(--color-text-muted)',
              marginBottom: 12,
            }}>
              Ta 20 sekunder och landa det här innan du går vidare.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={submitPhase1}
                style={{
                  flex: 1,
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
                REFLEKTERA KORT
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-ui)',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                STÄNG HÄR
              </button>
            </div>
          </>
        )}

        {/* ── Fas 2: Reflektion ── */}
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
              marginBottom: 10,
              lineHeight: 1.4,
            }}>
              Vad vill du ta med dig från det här?
            </div>
            <textarea
              autoFocus
              rows={4}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Kort reflektion. Vad lärde du dig, eller vad kändes viktigt?"
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
            <div style={{
              fontSize: 14,
              color: 'var(--color-text-muted)',
              marginTop: 16,
              marginBottom: 10,
            }}>
              Vad är ditt nästa lilla steg?
            </div>
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Skriv nästa steg medan känslan är färsk..."
              style={{
                width: '100%',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                padding: '12px',
                fontSize: 14,
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
              {reflection.trim() ? 'SPARA REFLEKTION (+15 XP)' : 'SPARA OCH GÅ VIDARE'}
            </button>
          </>
        )}

        {/* ── Fas 3: Landning + High-five ── */}
        {phase === 3 && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}>
                Riktning sparad
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 6,
                lineHeight: 1.35,
              }}>
                {nextStep.trim() || nextDirection}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
              }}>
                Totalt för det här steget: +{totalXp} XP
              </div>
            </div>

            <div style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              marginBottom: 12,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.08em',
            }}>
              DELA EN SNABB SIGNAL
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
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {highFiveTo && <Hand size={14} strokeWidth={1.9} />}
              {highFiveTo ? `HIGH-FIVE TILL ${((MEMBERS as Record<string, { name?: string }>)[highFiveTo]?.name || highFiveTo).toUpperCase()}` : 'KLAR'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
