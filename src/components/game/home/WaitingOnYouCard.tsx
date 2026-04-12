import { Bell, CalendarDays, Hand, Inbox, MapPin, MessageCircle, Users, X } from 'lucide-react';
import { markRead } from '@/state/notifications';
import { setFeedIntent } from '@/lib/feedIntent';
import { getNotificationFeedIntent } from '@/lib/notificationMeta';
import { markHomeAttentionSeen } from '@/lib/homeAttentionState';
import { useWaitingOnYouSurface, type HomeAttentionSurfaceState } from '@/hooks/useHomeSurface';
import { CARD_PAD, CARD_PAD_ROOM, ICON_BUTTON_SIZE, MOBILE_GUTTER, SECTION_GAP_COMPACT } from './constants';

function getSignalIcon(tone: string) {
  switch (tone) {
    case 'comment':
      return <MessageCircle size={16} strokeWidth={1.9} />;
    case 'reaction':
      return <Hand size={16} strokeWidth={1.9} />;
    case 'witness':
      return <Hand size={16} strokeWidth={1.9} />;
    case 'invite':
    case 'delegation':
      return <Inbox size={16} strokeWidth={1.9} />;
    case 'collaborative':
      return <Users size={16} strokeWidth={1.9} />;
    case 'checkin':
      return <MapPin size={16} strokeWidth={1.9} />;
    case 'decline':
      return <X size={16} strokeWidth={1.9} />;
    case 'calendar':
      return <CalendarDays size={16} strokeWidth={1.9} />;
    default:
      return <Bell size={16} strokeWidth={1.9} />;
  }
}

export function WaitingOnYouCard({
  onNavigate,
  onOpenNotifications,
  onOpenCoach,
  surface,
}: {
  onNavigate?: (tab: string) => void;
  onOpenNotifications?: () => void;
  onOpenCoach?: (initialMessage?: string) => void;
  surface?: HomeAttentionSurfaceState;
}) {
  const fallbackSurface = useWaitingOnYouSurface(!surface);
  const { me, loading, signals } = surface || fallbackSurface;

  if (!me || (!loading && signals.length === 0)) return null;

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
        Väntar på dig
      </p>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: CARD_PAD_ROOM, color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
            Läser av...
          </div>
        ) : (
          signals.map((signal, index) => (
            <button
              key={signal.id}
              onClick={() => {
                if (me) {
                  markHomeAttentionSeen(me, [signal.id]);
                }
                if (signal.notificationId) markRead(signal.notificationId);
                if (signal.notification) {
                  const feedIntent = getNotificationFeedIntent(signal.notification);
                  if (feedIntent) setFeedIntent(feedIntent);
                }

                if (signal.target === 'notifications') {
                  onOpenNotifications?.();
                  return;
                }

                if (signal.target === 'coach') {
                  onOpenCoach?.();
                  return;
                }

                onNavigate?.(signal.target);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: SECTION_GAP_COMPACT,
                padding: `${CARD_PAD} ${CARD_PAD_ROOM}`,
                background: 'transparent',
                border: 'none',
                borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: ICON_BUTTON_SIZE,
                height: ICON_BUTTON_SIZE,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-surface)',
                flexShrink: 0,
              }}>
                {getSignalIcon(signal.tone)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text)', fontWeight: 600, marginBottom: 2 }}>
                  {signal.title}
                </div>
                <div style={{
                  fontSize: 'var(--text-micro)',
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {signal.subtitle}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {signal.cta}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
