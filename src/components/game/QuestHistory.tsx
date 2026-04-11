import React from 'react';
import { S } from '@/state/store';

export default function QuestHistory() {
  const completedQuests = (S.me && S.chars[S.me]?.completedQuests || [])
    .slice()
    .reverse();

  if (completedQuests.length === 0) {
    return (
      <div style={{
        padding: 48, textAlign: 'center',
        color: 'var(--color-text-muted)', fontSize: 13,
      }}>
        Inget klart ännu.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.1em',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-ui)',
        padding: '16px 0 12px',
      }}>
        AVKLARADE UPPDRAG
      </div>
      {completedQuests.map((q: any, i: number) => (
        <div key={i} style={{
          padding: '14px 0',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 4,
          }}>
            <div style={{
              fontSize: 14, fontWeight: 500,
              color: 'var(--color-text)',
              flex: 1, marginRight: 12,
            }}>
              {q.title}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--color-primary)',
              fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
            }}>
              +{q.xp} XP
            </div>
          </div>
          {q.reflection && (
            <div style={{
              fontSize: 12, color: 'var(--color-text-muted)',
              fontStyle: 'italic', marginBottom: 4,
            }}>
              "{q.reflection}"
            </div>
          )}
          <div style={{
            fontSize: 11, color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)',
          }}>
            {q.completedAt
              ? new Date(q.completedAt).toLocaleDateString('sv-SE', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })
              : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
