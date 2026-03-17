import { X, Zap, Trophy } from 'lucide-react';
import { useState } from 'react';
import QuestDeleteModal from './QuestDeleteModal';

const CAT_COLORS: Record<string, string> = {
  social:   '#7c6af7',
  wisdom:   '#4a9eff',
  health:   '#2ecc71',
  creative: '#f39c12',
  bonus:    '#e74c3c',
};

const CAT_LABELS: Record<string, string> = {
  social:   'Social',
  wisdom:   'Strategi',
  health:   'Aktivitet',
  creative: 'Kreativt',
  bonus:    'Bonus',
};

interface Props {
  quest: any;
  onClose: () => void;
  onComplete: (quest: any) => void;
  rerender: () => void;
}

export default function QuestDetailModal({ quest, onClose, onComplete, rerender }: Props) {
  const [showDelete, setShowDelete] = useState(false);

  if (showDelete) {
    return (
      <QuestDeleteModal
        quest={quest}
        onClose={() => setShowDelete(false)}
        rerender={() => { rerender(); onClose(); }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 200,
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '16px 16px 0 0',
        border: '1px solid var(--color-border)',
        borderBottom: 'none',
        padding: '28px 24px 40px',
        width: '100%',
        maxWidth: '480px',
        position: 'relative',
      }}>
        {/* Stäng */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer', touchAction: 'manipulation',
          }}
        >
          <X size={18} />
        </button>

        {/* Drag handle */}
        <div style={{
          width: 36, height: 4,
          background: 'var(--color-border)',
          borderRadius: 2, margin: '0 auto 24px',
        }} />

        {/* Kategori */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          gap: 6, marginBottom: 12,
          padding: '4px 10px',
          borderRadius: 'var(--radius-pill)',
          background: (CAT_COLORS[quest.cat] || '#7c6af7') + '20',
          border: `1px solid ${CAT_COLORS[quest.cat] || '#7c6af7'}40`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: CAT_COLORS[quest.cat] || '#7c6af7',
          }} />
          <span style={{
            fontSize: 11, letterSpacing: '0.08em',
            color: CAT_COLORS[quest.cat] || '#7c6af7',
            fontFamily: 'var(--font-ui)',
          }}>
            {CAT_LABELS[quest.cat] || quest.cat?.toUpperCase()}
          </span>
        </div>

        {/* Titel */}
        <div style={{
          fontSize: 20, fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: 12, lineHeight: 1.3,
        }}>
          {quest.title}
        </div>

        {/* Beskrivning */}
        <div style={{
          fontSize: 14, color: 'var(--color-text-muted)',
          lineHeight: 1.7, marginBottom: 24,
        }}>
          {quest.desc}
        </div>

        {/* XP */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 6, marginBottom: 28,
          padding: '10px 14px',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
        }}>
          <Zap size={14} color="var(--color-primary)" />
          <span style={{
            fontSize: 13, color: 'var(--color-primary)',
            fontWeight: 600, fontFamily: 'var(--font-ui)',
          }}>
            +{quest.xp} XP
          </span>
          {quest.type === 'strategic' && (
            <>
              <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>·</span>
              <Trophy size={14} color="var(--color-text-muted)" />
              <span style={{
                fontSize: 12, color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-ui)',
              }}>
                Strategiskt
              </span>
            </>
          )}
        </div>

        {/* Knappar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { onComplete(quest); onClose(); }}
            style={{
              width: '100%',
              background: 'var(--color-primary)',
              color: '#fff', border: 'none',
              borderRadius: 'var(--radius-pill)',
              padding: '14px', fontSize: 13,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            SLUTFÖR UPPDRAG
          </button>

          <button
            onClick={() => setShowDelete(true)}
            style={{
              width: '100%',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              padding: '14px', fontSize: 13,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            TA BORT UPPDRAG
          </button>
        </div>
      </div>
    </div>
  );
}
