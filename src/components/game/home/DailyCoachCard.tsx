import { Zap } from 'lucide-react';
import { MEMBERS } from '@/data/members';
import { useDailyCoachSurface } from '@/hooks/useHomeSurface';
import {
  CARD_PAD,
  CARD_PAD_ROOM,
  CONTROL_HEIGHT,
  ICON_BUTTON_SIZE,
  MOBILE_GUTTER,
  SECTION_GAP,
  SECTION_GAP_COMPACT,
} from './constants';

export function DailyCoachCard({
  onNavigate,
  onOpenCoach,
}: {
  onNavigate?: (tab: string) => void;
  onOpenCoach?: (initialMessage?: string) => void;
}) {
  const {
    me,
    loading,
    message,
    coachName,
    focusQuest,
    followUpQuest,
    activeQuestCount,
    latestSocial,
    getQuestFocusReason,
  } = useDailyCoachSurface();

  if (!me) return null;

  return (
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: `0 0 ${SECTION_GAP_COMPACT}`,
      }}>
        Coach
      </p>
      <div
        onClick={() => onOpenCoach?.(message)}
        style={{
          background: 'linear-gradient(145deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
          borderRadius: 'var(--radius-card)',
          padding: CARD_PAD_ROOM,
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: SECTION_GAP_COMPACT,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 4,
            }}>
              {coachName}
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              {activeQuestCount > 0 ? `${activeQuestCount} aktiva` : 'Nästa steg'}
            </div>
          </div>
          <div style={{
            minWidth: 40,
            height: ICON_BUTTON_SIZE,
            width: ICON_BUTTON_SIZE,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-primary-muted)',
            color: 'var(--color-primary)',
          }}>
            <Zap size={16} strokeWidth={1.9} />
          </div>
        </div>

        <div style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text)',
          lineHeight: 1.55,
          marginBottom: SECTION_GAP,
          minHeight: 52,
        }}>
          {loading ? 'Kalibrerar...' : message}
        </div>

        {focusQuest && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: CARD_PAD,
            marginBottom: SECTION_GAP_COMPACT,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              Fokus
            </div>
            <div style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text)',
              fontWeight: 600,
              marginBottom: 4,
            }}>
              {focusQuest.title}
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              {getQuestFocusReason(focusQuest)}
            </div>
            {followUpQuest && (
              <div style={{ marginTop: SECTION_GAP_COMPACT, fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                Sedan: {followUpQuest.title}
              </div>
            )}
          </div>
        )}

        {latestSocial && (
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginBottom: SECTION_GAP_COMPACT }}>
            Senast: {(MEMBERS as Record<string, any>)[latestSocial.who]?.name || latestSocial.who}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate?.('quests');
            }}
            style={{
              flex: 1,
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              minHeight: CONTROL_HEIGHT,
              padding: '0 var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            Quests
          </button>
          <button type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenCoach?.(message);
            }}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              minHeight: CONTROL_HEIGHT,
              padding: '0 var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            Coach
          </button>
        </div>
      </div>
    </div>
  );
}
