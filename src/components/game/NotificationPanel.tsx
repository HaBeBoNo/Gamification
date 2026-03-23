import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getNotifications, markAllRead, markRead,
  subscribeNotifications,
  type Notification,
} from '@/state/notifications';
import { MEMBERS } from '@/data/members';
import { ArrowRightLeft, Zap, Award, Target, CheckCircle, Bell, X } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
  delegation_received: ArrowRightLeft,
  delegation_accepted: ArrowRightLeft,
  delegation_declined: ArrowRightLeft,
  synergy_triggered: Zap,
  badge_unlocked: Award,
  goal_milestone: Target,
  quest_completed: CheckCircle,
  level_up: Zap,
  high_five: Award,
  collaborative_complete: CheckCircle,
  quest_complete: CheckCircle,
};

const TYPE_COLORS: Record<string, string> = {
  delegation_received: 'var(--color-primary)',
  delegation_accepted: 'var(--color-green)',
  delegation_declined: 'var(--color-text-muted)',
  synergy_triggered: 'var(--color-accent)',
  badge_unlocked: 'var(--color-purple)',
  goal_milestone: 'var(--color-accent)',
  quest_completed: 'var(--color-green)',
  level_up: 'var(--color-accent)',
  high_five: 'var(--color-green)',
  collaborative_complete: 'var(--color-green)',
  quest_complete: 'var(--color-green)',
};

function getNotificationText(n: Notification): { title: string; subtitle: string } {
  const p = n.payload || {};
  const memberName = p.memberId ? MEMBERS[p.memberId]?.name || p.memberId : '';
  switch (n.type) {
    case 'delegation_received':
      return { title: `${memberName} skickade dig ett uppdrag`, subtitle: p.questTitle || '' };
    case 'delegation_accepted':
      return { title: `${memberName} accepterade ditt uppdrag`, subtitle: p.questTitle || '' };
    case 'delegation_declined':
      return { title: `${memberName} tackade nej till ditt uppdrag`, subtitle: p.questTitle || '' };
    case 'synergy_triggered':
      return { title: 'Synergi aktiverad', subtitle: `${p.questTitle || ''} upplåst` };
    case 'badge_unlocked':
      return { title: `Nytt märke: ${p.badgeName || ''}`, subtitle: p.desc || '' };
    case 'goal_milestone':
      return { title: `Bandet passerade ${p.milestoneName || ''}!`, subtitle: '' };
    case 'quest_completed':
      return { title: `${memberName} klarade ${p.questTitle || ''}`, subtitle: '' };
    case 'level_up':
      return { title: n.title || 'Level up!', subtitle: n.body || '' };
    case 'high_five':
      return { title: n.title || 'High five!', subtitle: n.body || '' };
    case 'collaborative_complete':
      return { title: n.title || 'Kollaborativt uppdrag klart', subtitle: n.body || '' };
    case 'quest_complete':
      return { title: n.title || 'Uppdrag slutfört', subtitle: n.body || '' };
    default:
      return { title: n.title || 'Notifikation', subtitle: n.body || '' };
  }
}

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
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState(getNotifications());

  useEffect(() => {
    return subscribeNotifications(() => setNotifications([...getNotifications()]));
  }, []);

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
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <Bell size={48} strokeWidth={1} />
              <span>Inga notifikationer ännu.</span>
            </div>
          ) : (
            notifications.map(n => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              const color = TYPE_COLORS[n.type] || 'var(--color-text-muted)';
              const { title, subtitle } = getNotificationText(n);
              return (
                <motion.div
                  key={n.id}
                  className={`notif-row ${n.read ? '' : 'unread'}`}
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => markRead(n.id)}
                >
                  <div className="notif-row-icon" style={{ color }}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="notif-row-content">
                    <span className="notif-row-title">{title}</span>
                    {subtitle && <span className="notif-row-subtitle">{subtitle}</span>}
                  </div>
                  <span className="notif-row-ts">{timeAgo(n.ts)}</span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}