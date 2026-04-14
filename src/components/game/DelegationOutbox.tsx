import React from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { Send, Check, X, Clock } from 'lucide-react';

type DelegationStatus = 'pending' | 'accepted' | 'declined';

interface OutboxQuest {
  id: number;
  title: string;
  delegatedTo: string | null;
  delegationStatus: DelegationStatus;
  delegatedAt?: number;
  declinedBy?: string | null;
}

export default function DelegationOutbox() {
  useGameStore((state) => state.tick);

  const me = S.me;
  const sent: OutboxQuest[] = ((S.quests || []) as any[]).filter(
    (q) =>
      q.delegatedBy === me &&
      q.delegatedBy !== q.delegatedTo &&
      q.delegationStatus
  );

  if (sent.length === 0) return null;

  const pending = sent.filter((q) => q.delegationStatus === 'pending');
  const accepted = sent.filter((q) => q.delegationStatus === 'accepted');
  const declined = sent.filter((q) => q.delegationStatus === 'declined');

  const StatusIcon = ({ status }: { status: DelegationStatus }) => {
    switch (status) {
      case 'accepted':
        return <Check size={14} strokeWidth={2} style={{ color: 'var(--color-accent)' }} />;
      case 'declined':
        return <X size={14} strokeWidth={2} style={{ color: 'var(--color-text-muted)' }} />;
      default:
        return <Clock size={14} strokeWidth={2} style={{ color: 'var(--color-primary)' }} />;
    }
  };

  const statusLabel = (status: DelegationStatus) => {
    switch (status) {
      case 'accepted': return 'Accepterad';
      case 'declined': return 'Nekad';
      default: return 'Väntar';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--section-gap-compact)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Send size={14} strokeWidth={2} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Skickade delegationer
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface-elevated)',
          borderRadius: 999,
          padding: '2px 8px',
          minWidth: 20,
          textAlign: 'center',
        }}>
          {sent.length}
        </span>
      </div>
      {sent.map((q) => {
        const target = q.delegatedTo ? MEMBERS[q.delegatedTo] : null;
        const declinedByMember = q.declinedBy ? MEMBERS[q.declinedBy] : null;
        return (
          <div
            key={q.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              fontSize: 'var(--text-caption)',
            }}
          >
            <StatusIcon status={q.delegationStatus} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: 'var(--color-text)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {q.title}
              </div>
              <div style={{
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 2,
              }}>
                {target && (
                  <>
                    <MemberIcon id={q.delegatedTo!} size={14} color={target.xpColor} />
                    <span>{target.name}</span>
                    <span>·</span>
                  </>
                )}
                {q.delegationStatus === 'declined' && declinedByMember && (
                  <span>{declinedByMember.name} nekade</span>
                )}
                {q.delegationStatus !== 'declined' && (
                  <span>{statusLabel(q.delegationStatus)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
