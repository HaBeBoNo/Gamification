import React, { useEffect, useState } from 'react'
import { Check, Users, Zap } from 'lucide-react'
import { MEMBERS } from '@/data/members'
import { S } from '@/state/store'
import { completeMyPart } from '@/lib/collaborativeQuests'
import { awardXP } from '@/hooks/useXP'
import { notifyMembersSignal } from '@/lib/notificationSignals'
import type { CollaborativeQuest } from '@/lib/collaborativeQuests'
import QuestCompleteModal from './QuestCompleteModal'
import { MemberIcon } from '@/components/icons/MemberIcons'

interface Props {
  key?: React.Key
  quest: CollaborativeQuest
  onUpdate: () => void
}

export default function CollaborativeQuestCard({ quest, onUpdate }: Props) {
  const { quest_data: q, completed_by, participants, initiator } = quest
  const [localCompletedBy, setLocalCompletedBy] = useState<string[]>(completed_by ?? [])
  const [localDone, setLocalDone] = useState<boolean>(quest.done ?? false)
  const [completionXp, setCompletionXp] = useState(0)
  const [showCompletion, setShowCompletion] = useState(false)
  const hasCompleted = S.me ? localCompletedBy.includes(S.me) : false
  const initiatorMember = (MEMBERS as any)[initiator]

  useEffect(() => {
    setLocalCompletedBy(completed_by ?? [])
    setLocalDone(quest.done ?? false)
  }, [completed_by, quest.done])

  async function handleComplete() {
    if (hasCompleted) return
    const result = await completeMyPart(quest.id, localCompletedBy)
    if (!result) return
    setLocalCompletedBy(result.completedBy)
    setLocalDone(result.allDone)

    // Ge XP till S.me
    const xpResult = awardXP({
      ...q,
      id: quest.quest_id,
      collaborative: true,
      participants,
      cat: q.cat,
    } as any, q.xp || 50, null)
    if (xpResult) {
      setCompletionXp(xpResult.totalXP)
      setShowCompletion(true)
    } else {
      onUpdate()
    }

    // Push-notis
    const memberName = (S.me && (MEMBERS as any)[S.me]?.name) || S.me || 'Unknown'
    if (result.allDone) {
      void notifyMembersSignal({
        targetMemberKeys: participants.filter((p: string) => p !== S.me),
        type: 'collaborative_complete',
        title: `${memberName} slutförde ert gemensamma uppdrag`,
        body: `"${q.title}" — alla klara!`,
        dedupeKey: `collab-complete:${quest.id}`,
        payload: {
          memberId: S.me,
          questId: quest.quest_id,
          questTitle: q.title,
        },
        push: {
          title: `${memberName} slutförde ert gemensamma uppdrag`,
          body: `"${q.title}" — alla klara!`,
          excludeMember: S.me || undefined,
        },
      })
    } else {
      const remainingParticipants = participants.filter(
        (p: string) => !result.completedBy.includes(p)
      )
      const remaining = remainingParticipants.length
      void notifyMembersSignal({
        targetMemberKeys: remainingParticipants.filter((p: string) => p !== S.me),
        type: 'collaborative_progress',
        title: `${memberName} slutförde sin del`,
        body: `"${q.title}" — ${remaining} kvar`,
        dedupeKey: `collab-progress:${quest.id}:${S.me}`,
        payload: {
          memberId: S.me,
          questId: quest.quest_id,
          questTitle: q.title,
          remaining,
          questType: 'collaborative',
        },
        push: {
          title: `${memberName} slutförde sin del`,
          body: `"${q.title}" — ${remaining} kvar`,
          excludeMember: S.me || undefined,
        },
      })
    }
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
              background: localCompletedBy.includes(p)
                ? ((MEMBERS as any)[p]?.xpColor || 'var(--color-accent)')
                : 'var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: localCompletedBy.includes(p) ? 1 : 0.4,
            }}>
              <MemberIcon id={p as any} size={14} />
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {localCompletedBy.length}/{participants.length} klara
        </div>
      </div>

      {/* XP + slutför-knapp */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-accent)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <Zap size={12} strokeWidth={1.9} />
          {q.xp} XP
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
            color: localDone ? 'var(--color-green)' : 'var(--color-accent)',
          }}>
            <Check size={14} /> {localDone ? 'Alla klara' : 'Klar'}
          </div>
        )}
      </div>
      {showCompletion && (
        <QuestCompleteModal
          quest={{
            id: quest.quest_id,
            title: q.title,
            xp: q.xp || 0,
            cat: q.cat,
          }}
          xpGained={completionXp}
          onClose={() => {
            setShowCompletion(false)
            onUpdate()
          }}
          rerender={onUpdate}
        />
      )}
    </div>
  )
}
