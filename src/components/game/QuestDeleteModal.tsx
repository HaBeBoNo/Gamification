import React from 'react';
import { X } from 'lucide-react';
import { S, save } from '@/state/store';
import { isQuestDoneNow } from '@/lib/questUtils';

const REASONS = [
  { id: 'irrelevant', label: 'Inte relevant för min roll' },
  { id: 'done',       label: 'Redan gjort detta' },
  { id: 'timing',     label: 'Fel timing just nu' },
];

interface Props {
  quest: any;
  onClose: () => void;
  rerender: () => void;
}

export default function QuestDeleteModal({ quest, onClose, rerender }: Props) {
  function handleDelete(reasonId: string) {
    // Ta bort quest
    S.quests = S.quests.filter((q: any) => q.id !== quest.id);

    // Spara anledning i member-profil för coach-kalibrering
    if (!S.chars[S.me].deletedQuests) S.chars[S.me].deletedQuests = [];
    S.chars[S.me].deletedQuests.push({
      title: quest.title,
      cat: quest.cat,
      reason: reasonId,
      ts: Date.now(),
    });

    // Räkna aktiva quests — om under 3, flagga för auto-generering
    const remaining = S.quests.filter(
      (q: any) => q.owner === S.me && !isQuestDoneNow(q)
    ).length;

    if (remaining < 3) {
      S.chars[S.me].needsQuestRefill = true;
    }

    save();
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
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        padding: '28px 24px',
        width: '100%',
        maxWidth: '360px',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none',
            color: 'var(--color-text-muted)', cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{
          fontSize: 11, letterSpacing: '0.1em',
          color: 'var(--color-text-muted)',
          marginBottom: 8, fontFamily: 'var(--font-ui)',
        }}>
          TA BORT UPPDRAG
        </div>
        <div style={{
          fontSize: 15, fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: 20, lineHeight: 1.3,
        }}>
          {quest.title}
        </div>

        <div style={{
          fontSize: 13, color: 'var(--color-text-muted)',
          marginBottom: 16,
        }}>
          Varför tar du bort det?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {REASONS.map(r => (
            <button
              key={r.id}
              onClick={() => handleDelete(r.id)}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text)',
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
                touchAction: 'manipulation',
                fontFamily: 'var(--font-body)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
