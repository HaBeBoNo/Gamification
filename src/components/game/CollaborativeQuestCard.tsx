import React from 'react'
import { Check, Users } from 'lucide-react'
import { MEMBERS } from '@/data/members'
import { S } from '@/state/store'
import { completeMyPart } from '@/lib/collaborativeQuests'
import { awardXP } from '@/hooks/useXP'
import { sendPush } from '@/lib/sendPush'
import type { CollaborativeQuest } from '@/lib/collaborativeQuests'

interface Props {
  key?: React.Key
  quest: CollaborativeQuest
  onUpdate: () => void
}

export default function CollaborativeQuestCard({ quest, onUpdate }: Props) {
  const { quest_data: q, completed_by, participants, initiator } = quest
  const hasCompleted = completed_by.includes(S.me)
  const initiatorMember = (MEMBERS as any)[initiator]

  async function handleComplete() {
    if (hasCompleted) return
    const result = await completeMyPart(quest.id, completed_by)
    if (!result) return

    // Ge XP till S.me
    await awardXP(q, q.xp || 50, null)

    // Push-notis
    const memberName = (MEMBERS as any)[S.me]?.name || S.me
    if (result.allDone) {
      sendPush(
        `${memberName} slutförde ert gemensamma uppdrag`,
        `"${q.title}" — alla klara! 🎉`,
        {
          excludeMember: S.me || undefined,
          targetMemberKeys: participants.filter((p: string) => p !== S.me),
          url: '/',
        }
      )
    } else {
      const remaining = participants.filter(
        (p: string) => !result.completedBy.includes(p)
      ).length
      sendPush(
        `${memberName} slutförde sin del`,
        `"${q.title}" — ${remaining} kvar`,
        {
          excludeMember: S.me || undefined,
          targetMemberKeys: participants.filter((p: string) => p !== S.me),
          url: '/',
        }
      )
    }

    onUpdate()
  }

  return (
    <div style={{
      background: 'var(--color-surface-elevated)',
      border: `2px solid ${initiatorMember?.xpColor || 'var(--color-accent)'}`,
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md)',
      marginBottom: 'var(--space-sm)',
    }}>
      {/* Initiator-badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 6,
        fontSize: 11,
        color: initiatorMember?.xpColor || 'var(--color-accent)',
      }}>
        <Users size={12} />
        {initiator === S.me ? 'Ditt kollaborativa uppdrag' : `Från ${initiatorMember?.name || initiator}`}
      </div>

      {/* Titel */}
      <div style={{
        fontWeight: 600,
        fontSize: 'var(--text-body)',
        color: 'var(--color-text-primary)',
        marginBottom: 4,
      }}>
        {q.title}
      </div>

      {/* Beskrivning */}
      {q.desc && (
        <div style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-muted)',
          marginBottom: 8,
        }}>
          {q.desc}
        </div>
      )}

      {/* Progress + deltagare */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {participants.map((p: string) => (
            <div key={p} style={{
              width: 24, height: 24,
              borderRadius: '50%',
              background: completed_by.includes(p)
                ? ((MEMBERS as any)[p]?.xpColor || 'var(--color-accent)')
                : 'var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
              opacity: completed_by.includes(p) ? 1 : 0.4,
            }}>
              {(MEMBERS as any)[p]?.emoji || p[0]}
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {completed_by.length}/{participants.length} klara
        </div>
      </div>

      {/* XP + slutför-knapp */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-accent)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
        }}>
          ⚡ {q.xp} XP
        </div>
        {!hasCompleted && (
          <button
            onClick={handleComplete}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              padding: '8px 16px',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <Check size={14} /> Slutför min del
          </button>
        )}
        {hasCompleted && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12,
            color: 'var(--color-accent)',
          }}>
            <Check size={14} /> Klar
          </div>
        )}
      </div>
    </div>
  )
}
