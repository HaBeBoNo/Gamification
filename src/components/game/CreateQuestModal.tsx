import { useState } from 'react';
import { X } from 'lucide-react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { createCollaborativeQuest, fetchMyCollaborativeQuests } from '@/lib/collaborativeQuests';
import { notifyMembersSignal } from '@/lib/notificationSignals';
import { MemberIcon } from '@/components/icons/MemberIcons';

const CATEGORIES = [
  { id: 'social',   label: 'Social' },
  { id: 'wisdom',   label: 'Strategi' },
  { id: 'health',   label: 'Aktivitet' },
  { id: 'creative', label: 'Kreativt' },
  { id: 'bonus',    label: 'Bonus' },
];

interface Props {
  onClose: () => void;
  rerender: () => void;
}

export default function CreateQuestModal({ onClose, rerender }: Props) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [xp, setXp] = useState(50);
  const [cat, setCat] = useState('wisdom');
  const [collaborative, setCollaborative] = useState(false);
  const [motivation, setMotivation] = useState('');
  const [invitedMembers, setInvitedMembers] = useState<string[]>([]);

  const otherMembers = Object.entries(MEMBERS).filter(([id]) => id !== S.me);

  function toggleInvite(memberId: string) {
    setInvitedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  }

  async function handleCreate() {
    if (!title.trim()) return;

    if (collaborative && invitedMembers.length > 0 && S.me) {
      const participants = [S.me, ...invitedMembers];
      const questData = {
        id: Date.now(),
        title: title.trim(),
        desc: desc.trim(),
        xp,
        cat,
        type: 'collaborative',
        owner: S.me,
        collaborative: true,
        participants,
        completedBy: [],
        initiator: S.me,
        recur: 'none',
        done: false,
        region: 'Global',
        personal: false,
        aiVerdict: null,
      };

      // Spara i Supabase och synka tillbaka direkt
      await createCollaborativeQuest(questData, participants);
      await fetchMyCollaborativeQuests();

      const initiatorName = (MEMBERS as any)[S.me]?.name || S.me;
      await notifyMembersSignal({
        targetMemberKeys: invitedMembers,
        type: 'collaborative_invite',
        title: `${initiatorName} bjöd in dig till ett gemensamt uppdrag`,
        body: title.trim(),
        dedupeKey: `collab-invite:${S.me}:${questData.id}:${[...invitedMembers].sort().join(',')}`,
        payload: {
          memberId: S.me,
          questId: questData.id,
          questTitle: title.trim(),
        },
        push: {
          title: `${initiatorName} bjöd in dig till ett gemensamt uppdrag`,
          body: `"${title.trim()}"`,
          excludeMember: S.me || undefined,
          url: '/',
        },
      });
    } else {
      // Vanligt quest
      const newQuest: any = {
        id: Date.now(),
        owner: S.me,
        title: title.trim(),
        desc: desc.trim(),
        cat,
        xp,
        stars: '',
        region: 'Personal',
        recur: 'none',
        type: 'personal',
        done: false,
        aiVerdict: null,
        personal: true,
        collaborative: false,
        completedBy: [],
        initiator: S.me,
      };

      if (motivation.trim()) {
        newQuest.motivation = motivation.trim();
      }

      S.quests.push(newQuest);
      save();
    }

    rerender();
    onClose();
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
        maxHeight: '90vh',
        overflowY: 'auto',
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

        {/* Rubrik */}
        <div style={{
          fontSize: 11, letterSpacing: '0.1em',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-ui)',
          marginBottom: 20,
        }}>
          SKAPA UPPDRAG
        </div>

        {/* Titel */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)', marginBottom: 6,
          }}>
            TITEL
          </div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Vad ska göras?"
            style={{
              width: '100%',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 8, color: 'var(--color-text)',
              padding: '10px 12px', fontSize: 14,
              fontFamily: 'var(--font-body)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Beskrivning */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)', marginBottom: 6,
          }}>
            BESKRIVNING
          </div>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Beskriv uppdraget (valfritt)"
            rows={3}
            style={{
              width: '100%',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 8, color: 'var(--color-text)',
              padding: '10px 12px', fontSize: 13,
              fontFamily: 'var(--font-body)',
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Motivation */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)', marginBottom: 6,
          }}>
            MOTIVATION (VALFRITT)
          </div>
          <input
            type="text"
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            placeholder="Varför är det här viktigt?"
            style={{
              width: '100%',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 8, color: 'var(--color-text)',
              padding: '10px 12px', fontSize: 13,
              fontFamily: 'var(--font-body)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Kategori */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)', marginBottom: 8,
          }}>
            KATEGORI
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid ' + (cat === c.id ? 'var(--color-primary)' : 'var(--color-border)'),
                  background: cat === c.id ? 'var(--color-primary)' : 'transparent',
                  color: cat === c.id ? '#fff' : 'var(--color-text-muted)',
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  touchAction: 'manipulation',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* XP */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)', marginBottom: 6,
          }}>
            XP — {xp}
          </div>
          <input
            type="range"
            min={10}
            max={200}
            step={10}
            value={xp}
            onChange={e => setXp(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)' }}
          />
        </div>

        {/* Kollaborativ toggle */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: collaborative ? 14 : 24,
          padding: '12px 0',
          borderTop: '1px solid var(--color-border)',
        }}>
          <div>
            <div style={{
              fontSize: 13, color: 'var(--color-text)',
              fontWeight: 600, marginBottom: 2,
            }}>
              Kollaborativt uppdrag
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Bjud in bandmedlemmar att delta
            </div>
          </div>
          <button
            onClick={() => setCollaborative(v => !v)}
            style={{
              width: 44, height: 24,
              borderRadius: 12,
              border: 'none',
              background: collaborative ? 'var(--color-primary)' : 'var(--color-border)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              touchAction: 'manipulation',
            }}
          >
            <div style={{
              position: 'absolute',
              top: 2,
              left: collaborative ? 22 : 2,
              width: 20, height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* Inbjudan av members — visas bara när collaborative är på */}
        {collaborative && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, letterSpacing: '0.08em',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-ui)', marginBottom: 10,
            }}>
              BJUD IN MEMBERS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {otherMembers.map(([id, member]) => {
                const isInvited = invitedMembers.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleInvite(id)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid ' + (isInvited ? 'var(--color-primary)' : 'var(--color-border)'),
                      background: isInvited ? 'var(--color-primary)10' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      touchAction: 'manipulation',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28,
                      borderRadius: '50%',
                      background: (member as any).color || 'var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <MemberIcon id={id as any} size={16} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: 13, color: 'var(--color-text)',
                        fontWeight: 500,
                      }}>
                        {(member as any).name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {(member as any).role}
                      </div>
                    </div>
                    {isInvited && (
                      <div style={{
                        marginLeft: 'auto',
                        fontSize: 12,
                        color: 'var(--color-primary)',
                        fontFamily: 'var(--font-ui)',
                        letterSpacing: '0.06em',
                      }}>
                        INBJUDEN
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Skapa-knapp */}
        <button
          onClick={handleCreate}
          disabled={!title.trim()}
          style={{
            width: '100%',
            background: title.trim() ? 'var(--color-primary)' : 'var(--color-border)',
            color: title.trim() ? '#fff' : 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            padding: '14px',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
            letterSpacing: '0.08em',
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            touchAction: 'manipulation',
          }}
        >
          SKAPA UPPDRAG
        </button>
      </div>
    </div>
  );
}
