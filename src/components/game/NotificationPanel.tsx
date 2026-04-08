import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { markAllRead, markRead, type Notification } from '@/state/notifications';
import { useGameStore } from '@/state/store';
import { ArrowRightLeft, Zap, Award, Target, CheckCircle, Bell, X, MessageCircle, Eye, CalendarDays, MapPin, Users } from 'lucide-react';
import { setFeedIntent } from '@/lib/feedIntent';
import { getNotificationActionLabel, getNotificationFeedIntent, getNotificationTarget, getNotificationText, sortNotificationsForAttention } from '@/lib/notificationMeta';

const TYPE_ICONS: Record<string, React.ElementType> = {
  delegation_received: ArrowRightLeft,
  delegation_accepted: ArrowRightLeft,
  delegation_declined: ArrowRightLeft,
  synergy_triggered: Zap,
  badge_unlocked: Award,
  goal_milestone: Target,
  quest_completed: CheckCircle,
  first_login: Bell,
  streak: Zap,
  level_up: Zap,
  high_five: Award,
  collaborative_invite: Users,
  collaborative_progress: Users,
  collaborative_complete: CheckCircle,
  quest_complete: CheckCircle,
  feed_comment: MessageCircle,
  feed_reaction: Award,
  feed_witness: Eye,
  calendar_rsvp: CalendarDays,
  calendar_decline: CalendarDays,
  calendar_check_in: MapPin,
  calendar_check_in_open: MapPin,
  calendar_reminder: CalendarDays,
};

const TYPE_COLORS: Record<string, string> = {
  delegation_received: 'var(--color-primary)',
  delegation_accepted: 'var(--color-green)',
  delegation_declined: 'var(--color-text-muted)',
  synergy_triggered: 'var(--color-accent)',
  badge_unlocked: 'var(--color-purple)',
  goal_milestone: 'var(--color-accent)',
  quest_completed: 'var(--color-green)',
  first_login: 'var(--color-primary)',
  streak: 'var(--color-accent)',
  level_up: 'var(--color-accent)',
  high_five: 'var(--color-green)',
  collaborative_invite: 'var(--color-primary)',
  collaborative_progress: 'var(--color-accent)',
  collaborative_complete: 'var(--color-green)',
  quest_complete: 'var(--color-green)',
  feed_comment: 'var(--color-primary)',
  feed_reaction: 'var(--color-accent)',
  feed_witness: 'var(--color-green)',
  calendar_rsvp: 'var(--color-primary)',
  calendar_decline: 'var(--color-error, #e05555)',
  calendar_check_in: 'var(--color-accent)',
  calendar_check_in_open: 'var(--color-accent)',
  calendar_reminder: 'var(--color-primary)',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Nu';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface NotificationPanelProps {
  onClose: () => void;
  onNavigate?: (tab: string) => void;
  onOpenCoach?: (initialMessage?: string) => void;
}

export default function NotificationPanel({ onClose, onNavigate, onOpenCoach }: NotificationPanelProps) {
  // Reactive: re-renders whenever the notifications slice changes in Zustand
  const notifications = useGameStore(s => s.notifications);
  const orderedNotifications = sortNotificationsForAttention(notifications);

  function handleNotificationPress(notification: Notification) {
    markRead(notification.id);

    const target = getNotificationTarget(notification);
    const feedIntent = getNotificationFeedIntent(notification);
    if (feedIntent) {
      setFeedIntent(feedIntent);
    }

    if (target === 'coach') {
      onOpenCoach?.(notification.body || notification.title);
      onClose();
      return;
    }

    if (target !== 'notifications') {
      onNavigate?.(target);
      onClose();
    }
  }

  return (
    <div className="notif-panel">
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
          NOTIFIKATIONER
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer', padding: 4,
            touchAction: 'manipulation',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {notifications.some(n => !n.read) && (
        <div className="notif-header">
          <button className="notif-mark-all" onClick={markAllRead}>
            Markera alla som lästa
          </button>
        </div>
      )}

      <div className="notif-list">
        <AnimatePresence initial={false}>
          {orderedNotifications.length === 0 ? (
            <div className="notif-empty">
              <Bell size={48} strokeWidth={1} />
              <span>Inga notifikationer ännu.</span>
            </div>
          ) : (
            orderedNotifications.map(n => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              const color = TYPE_COLORS[n.type] || 'var(--color-text-muted)';
              const { title, subtitle } = getNotificationText(n);
              const actionLabel = getNotificationActionLabel(n);
              return (
                <motion.div
                  key={n.id}
                  className={`notif-row ${n.read ? '' : 'unread'}`}
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleNotificationPress(n)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="notif-row-icon" style={{ color }}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="notif-row-content">
                    <span className="notif-row-title">{title}</span>
                    {subtitle && <span className="notif-row-subtitle">{subtitle}</span>}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                    marginLeft: 'var(--space-sm)',
                    flexShrink: 0,
                  }}>
                    <span className="notif-row-ts">{timeAgo(n.ts)}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-micro)',
                      color: 'var(--color-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}>
                      {actionLabel}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
