import { X, Zap, Trophy } from 'lucide-react';
import { useState } from 'react';
import QuestDeleteModal from './QuestDeleteModal';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { calcCollaborativeBonus } from '@/hooks/useXP';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { addNotifToAll } from '@/state/notifications';

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
  const [statusUpdate, setStatusUpdate] = useState('');
  const isMobile = useMediaQuery('(max-width: 767px)');

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
        background: isMobile ? 'var(--color-base)' : 'var(--color-overlay-backdrop)',
        zIndex: 200,
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0' : '16px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
        background: 'var(--color-surface)',
        borderRadius: isMobile ? '0' : '24px',
        border: isMobile ? 'none' : '1px solid var(--color-border)',
        width: '100%',
        maxWidth: isMobile ? '100%' : 'min(100%, 35rem)',
        height: isMobile ? '100dvh' : 'min(92vh, 53.75rem)',
        maxHeight: isMobile ? '100dvh' : 'min(92vh, 53.75rem)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Uppdragsdetaljer för ${quest.title}`}
      >
        <div style={{
          padding: `${isMobile ? 'max(16px, env(safe-area-inset-top))' : '18px'} 20px 14px`,
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-micro)',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Uppdrag
          </div>
          <button type="button"
            aria-label="Stäng uppdragsdetaljer"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              touchAction: 'manipulation',
              width: 36,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '20px 20px 24px',
        }}>
          <div style={{
            width: 36,
            height: 4,
            background: 'var(--color-border)',
            borderRadius: 2,
            margin: '0 auto 20px',
            opacity: isMobile ? 1 : 0,
          }} />

          <div style={{
            display: 'inline-flex', alignItems: 'center',
            gap: 6, marginBottom: 12,
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            background: (CAT_COLORS[quest.cat] || '#7c6af7') + '20',
            border: '1px solid ' + (CAT_COLORS[quest.cat] || '#7c6af7') + '40',
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

          <div style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: 12,
            lineHeight: 1.25,
          }}>
            {quest.title}
          </div>

          <div style={{
            fontSize: 14, color: 'var(--color-text-muted)',
            lineHeight: 1.7, marginBottom: 24,
          }}>
            {quest.desc}
          </div>

          {quest.collaborative && quest.owner === S.me && (
            <div style={{
              background: 'var(--color-primary)10',
              border: '1px solid var(--color-primary)30',
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
            }}>
              Du äger detta uppdrag. När du slutför det räknas det som klart för alla
              {quest.participants?.length > 0
                ? ' — ' + quest.participants.join(', ') + ' och dig'
                : ' som anslutit sig'
              }.
              {quest.participants?.length > 0 && (
                <span style={{
                  display: 'block',
                  marginTop: 6,
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                }}>
                  +{Math.round((calcCollaborativeBonus(quest.participants.length + 1) - 1) * 100)}% bonus-XP för alla
                </span>
              )}
            </div>
          )}

          {quest.collaborative && quest.owner === S.me && (
            <div style={{
              marginBottom: 18,
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: '14px',
            }}>
              <div style={{
                fontSize: 11, letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-ui)', marginBottom: 10,
              }}>
                SKICKA STATUSUPPDATERING
              </div>
              <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <input
                  type="text"
                  value={statusUpdate}
                  onChange={e => setStatusUpdate(e.target.value)}
                  placeholder="Vad har hänt sedan sist?"
                  aria-label="Statusuppdatering"
                  style={{
                    flex: 1,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12, color: 'var(--color-text)',
                    padding: '12px 12px', fontSize: 13,
                    fontFamily: 'var(--font-body)',
                  }}
                />
                <button type="button"
                  onClick={() => {
                    if (!statusUpdate.trim() || !S.me) return;
                    const ownerName = (MEMBERS as any)[S.me]?.name || S.me;
                    addNotifToAll({
                      id: Date.now() + Math.random(),
                      type: 'quest_update',
                      title: 'Uppdatering: "' + quest.title + '"',
                      body: ownerName + ': ' + statusUpdate.trim(),
                      memberKey: S.me,
                      ts: Date.now(),
                      read: false,
                    });
                    save();
                    setStatusUpdate('');
                  }}
                  style={{
                    background: 'var(--color-primary)',
                    color: 'var(--color-text-primary)', border: 'none',
                    borderRadius: 12, padding: '0 16px',
                    minHeight: 44,
                    fontSize: 13, cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                    touchAction: 'manipulation',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Skicka
                </button>
              </div>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 6, marginBottom: 8,
            padding: '12px 14px',
            background: 'var(--color-bg)',
            borderRadius: 16,
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
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--color-border)',
          background: 'color-mix(in srgb, var(--color-surface) 96%, transparent)',
          flexShrink: 0,
        }}>
          <button type="button"
            onClick={() => { onComplete(quest); onClose(); }}
            style={{
              width: '100%',
              background: 'var(--color-primary)',
              color: 'var(--color-text-primary)', border: 'none',
              borderRadius: 'var(--radius-pill)',
              minHeight: 48,
              padding: '0 14px', fontSize: 13,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Slutför uppdrag
          </button>

          <button type="button"
            onClick={() => setShowDelete(true)}
            style={{
              width: '100%',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              minHeight: 44,
              padding: '0 14px', fontSize: 13,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Ta bort uppdrag
          </button>
        </div>
      </div>
    </div>
  );
}
