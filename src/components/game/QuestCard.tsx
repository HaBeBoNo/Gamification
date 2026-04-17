import React, { useState } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { awardXP } from '@/hooks/useXP';
import { aiValidate } from '@/hooks/useAI';
import { fireAndForget } from '@/lib/async';
import { Check, X, Zap, Paperclip, Globe2, MapPin, User } from 'lucide-react';
import { getQuestOrigin, ORIGIN_LABELS, isQuestDoneNow } from '@/lib/questUtils';
import { pushFeedEntry } from '@/lib/feed';
import { notifyMembersSignal } from '@/lib/notificationSignals';
import { joinCollaborativeQuest } from '@/lib/collaborativeQuests';
import { motion } from 'framer-motion';
import DelegationSheet from './DelegationSheet';
import QuestCompleteModal from './QuestCompleteModal';
import QuestDetailModal from './QuestDetailModal';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { formatRegionLabel, getRegionDisplayKind } from '@/lib/uiDisplay';

const CAT_DOT: Record<string, string> = {
  daily: 'cat-daily', personal: 'cat-personal', strategic: 'cat-strategic',
  hidden: 'cat-hidden', social: 'cat-social', sidequest: 'cat-sidequest',
  wisdom: 'cat-wisdom', health: 'cat-health', tech: 'cat-tech',
  money: 'cat-money', global: 'cat-global',
};
const CAT_BADGE: Record<string, string> = {
  daily: 'badge-daily', personal: 'badge-personal', strategic: 'badge-strategic',
  hidden: 'badge-hidden', social: 'badge-social', sidequest: 'badge-sidequest',
  wisdom: 'badge-hidden', health: 'badge-hidden', tech: 'badge-hidden', money: 'badge-hidden',
};
const CAT_LABEL: Record<string, string> = {
  daily: 'DAGLIG', personal: 'PERSONLIG', strategic: 'STRATEGISK', hidden: 'DOLD',
  social: 'SOCIAL', sidequest: 'SIDEQUEST', wisdom: 'VISDOM', health: 'HÄLSA',
  tech: 'TECH', money: 'EKONOMI',
};

interface QuestCardProps {
  key?: React.Key;
  quest: any;
  rerender: () => void;
  showLU?: (level: number) => void;
  showRW?: (reward: any, tier?: string) => void;
  showXP?: (amount: number) => void;
}

export default function QuestCard({ quest, rerender, showLU, showRW, showXP }: QuestCardProps) {
  const [aiDesc, setAiDesc] = useState('');
  const [thinking, setThinking] = useState(false);
  const [verdict, setVerdict] = useState<any>(quest.aiVerdict || null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleg, setShowDeleg] = useState(false);
  const [completingQuest, setCompletingQuest] = useState<any>(null);
  const [lastXP, setLastXP] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [delegationNote, setDelegationNote] = useState('');

  const me = S.me;
  const isDone = isQuestDoneNow(quest);
  const needsAI = quest.aiRequired;
  const isParticipant = quest.participants?.includes(S.me) || false;
  const verdictApproved = Boolean(verdict?.approved || verdict?.cls === 'v-accepted' || verdict?.cls === 'v-partial');
  const verdictText = verdict?.message || verdict?.text;

  async function handleComplete() {
    if (isDone || !me || thinking) return;
    if (needsAI && !verdictApproved) return;

    const idx = S.quests.findIndex((q: any) => q.id === quest.id);

    // Kollaborativt quest med deltagare — per-deltagare completion
    if (quest.collaborative && quest.participants?.length > 0) {
      if (idx < 0) return;
      const q = S.quests[idx];
      if (!q.completedBy) q.completedBy = [];
      const completedBy = q.completedBy as string[];
      if (completedBy.includes(me)) return;
      if (!completedBy.includes(me)) completedBy.push(me);

      // XP till den som just slutförde
      const result = await awardXP(q, q.xp || 30, null,
        (level) => showLU?.(level),
        (reward, tier) => showRW?.(reward, tier),
      );
      if (!result) return;
      showXP?.(result.totalXP);

      const everyoneDone = (q.participants as string[]).every(
        (id: string) => completedBy.includes(id)
      );

      if (everyoneDone) {
        q.done = true;
        const memberName = (MEMBERS as any)[me]?.name || me;
        fireAndForget(notifyMembersSignal({
          targetMemberKeys: (q.participants as string[]).filter((id: string) => id !== me),
          type: 'collaborative_complete',
          title: `${memberName} slutförde ert gemensamma uppdrag`,
          body: `"${quest.title}" — alla deltagare klara!`,
          dedupeKey: `collab-complete:${quest.id}`,
          payload: {
            memberId: me,
            questId: quest.id,
            questTitle: quest.title,
          },
          push: {
            title: `${memberName} slutförde ert gemensamma uppdrag`,
            body: `"${quest.title}" — alla deltagare klara!`,
            excludeMember: me,
          },
        }), 'quest collaborative completion notification');
      } else {
        const memberName = (MEMBERS as any)[me]?.name || me;
        const remainingParticipants = (q.participants as string[]).filter(
          (id: string) => !completedBy.includes(id)
        );
        const remaining = remainingParticipants.length;
        fireAndForget(notifyMembersSignal({
          targetMemberKeys: remainingParticipants.filter((id: string) => id !== me),
          type: 'collaborative_progress',
          title: `${memberName} slutförde sin del`,
          body: `"${quest.title}" — ${remaining} kvar`,
          dedupeKey: `collab-progress:${quest.id}:${me}`,
          payload: {
            memberId: me,
            questId: quest.id,
            questTitle: quest.title,
            remaining,
            questType: 'collaborative',
          },
          push: {
            title: `${memberName} slutförde sin del`,
            body: `"${quest.title}" — ${remaining} kvar`,
            excludeMember: me,
          },
        }), 'quest collaborative progress notification');
      }

      if (!S.chars[me].completedQuests) S.chars[me].completedQuests = [];
      S.chars[me].completedQuests.push({
        id: quest.id,
        title: quest.title,
        xp: result.totalXP,
        cat: quest.cat,
        reflection: '',
        completedAt: Date.now(),
      });

      q.done = everyoneDone;
      save();
      rerender?.();

      setLastXP(result.totalXP);
      setCompletingQuest({ ...q, done: everyoneDone, completedAt: Date.now() });
      return;
    }

    const liveQuest = idx >= 0 ? S.quests[idx] : quest;
    const result = await awardXP(liveQuest, liveQuest.xp || 30, null,
      (level) => showLU?.(level),
      (reward, tier) => showRW?.(reward, tier),
    );
    if (!result) return;

    showXP?.(result.totalXP);

    // Spara i historik
    if (!S.chars[me].completedQuests) S.chars[me].completedQuests = [];
    S.chars[me].completedQuests.push({
      id: liveQuest.id,
      title: liveQuest.title,
      xp: result.totalXP,
      cat: liveQuest.cat,
      reflection: '',
      completedAt: Date.now(),
    });

    save();

    // Öppna utvärderingsmodal istället för direkt rerender
    const updatedQuest = idx >= 0 ? S.quests[idx] : { ...liveQuest, done: true, completedAt: Date.now() };
    setLastXP(result.totalXP);
    setCompletingQuest(updatedQuest);
  }

  function handleAIValidate() {
    if (!aiDesc.trim() || !me || thinking) return;
    setThinking(true);
    aiValidate(quest, aiDesc, null)
      .then(() => {
        const idx = S.quests.findIndex((q: any) => q.id === quest.id);
        if (idx >= 0) setVerdict(S.quests[idx].aiVerdict);
      })
      .catch((err: unknown) => {
        console.error('AI validation failed:', err);
        setVerdict({ approved: false, message: 'AI-validering misslyckades. Försök igen.' });
      })
      .finally(() => setThinking(false));
  }

  async function handleJoin(quest: any) {
    if (!S.me) return;
    const memberKey = S.me;
    if ((quest.participants || []).includes(memberKey)) return;

    // Spara kommentar på quest-objektet
    const noteValue = delegationNote.trim() || null;

    const updatedQuest = await joinCollaborativeQuest(quest.id, memberKey);
    if (!updatedQuest) return;

    quest.participants = updatedQuest.participants ?? [];
    quest.completedBy = updatedQuest.completed_by ?? [];
    quest.completed_by = updatedQuest.completed_by ?? [];
    if (noteValue) quest.note = noteValue;

    pushFeedEntry({
      who: memberKey,
      action: `anslöt sig till "${quest.title}"`,
      xp: 0,
      type: 'collaborative_join',
    });

    const joinTargets = [...new Set([quest.initiator, quest.owner].filter(Boolean))]
      .filter((targetKey) => targetKey !== memberKey);
    const memberName = (MEMBERS as any)[memberKey]?.name || memberKey;

    if (joinTargets.length > 0) {
      await notifyMembersSignal({
        targetMemberKeys: joinTargets,
        type: 'collaborative_join',
        title: `${memberName} anslöt sig till uppdraget`,
        body: quest.title,
        dedupeKey: `collab-join:${quest.id}:${memberKey}`,
        payload: {
          memberId: memberKey,
          questId: quest.id,
          questTitle: quest.title,
        },
        push: {
          title: `${memberName} anslöt sig till uppdraget`,
          body: `"${quest.title}"`,
          excludeMember: memberKey,
        },
      });
    }

    save();
    setDelegationNote('');
    rerender?.();
  }

  const badgeClass = CAT_BADGE[quest.cat] || 'badge-daily';
  const badgeLabel = CAT_LABEL[quest.cat] || quest.cat?.toUpperCase() || 'UPPDRAG';
  const dotClass = CAT_DOT[quest.cat] || 'cat-global';
  const regionLabel = formatRegionLabel(quest.region);
  const regionKind = getRegionDisplayKind(quest.region);
  const RegionIcon = regionKind === 'personal' ? User : regionKind === 'global' ? Globe2 : MapPin;

  return (
    <>
      <motion.div
        className={`quest-card ${isDone ? 'done' : ''}`}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        layout
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
        role="button"
        tabIndex={0}
        aria-label={`${quest.title} — ${quest.xp} XP`}
        onClick={() => !menuOpen && setShowDetail(true)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !menuOpen) {
            e.preventDefault();
            setShowDetail(true);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        {isDone && <div className="done-stamp"><Check size={20} strokeWidth={3} /></div>}

        {!isDone && (
          <button type="button"
            className="quest-menu-trigger"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Meny"
          >
            •••
          </button>
        )}

        {menuOpen && (
          <div className="quest-menu-dropdown" onClick={e => e.stopPropagation()}>
            <button type="button"
              className="quest-menu-item"
              onClick={() => { setMenuOpen(false); setShowDeleg(true); }}
            >
              Skicka till medlem →
            </button>
          </div>
        )}

        <div className="quest-card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <div className={`quest-cat-dot ${dotClass}`} />
            {quest.driveAttachment && (
              <Paperclip size={12} style={{ color: 'var(--color-text-muted)' }} />
            )}
          </div>
          <div>
            <span className={`quest-badge ${badgeClass}`}>{badgeLabel}</span>
            <div className="quest-title" style={{ marginTop: 4 }}>{quest.title}</div>
          </div>
        </div>
        <div className="quest-desc">{quest.desc}</div>
        <div className="quest-meta">
          {quest.recur && quest.recur !== 'none' && <span className="quest-recur">{quest.recur}</span>}
          {quest.region && quest.region !== 'all' && (
            <span className="quest-region" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RegionIcon size={12} strokeWidth={1.8} />
              {regionLabel}
            </span>
          )}
          <span style={{
            fontSize: 11,
            marginRight: 'var(--space-xs)',
            opacity: 0.8,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
          }}>
            {ORIGIN_LABELS[getQuestOrigin(quest)]}
          </span>
          <span className="quest-xp"><Zap size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> {quest.xp} XP</span>
        </div>

        {/* Kollaborativt badge */}
        {quest.collaborative && (
          <span style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            background: 'var(--color-primary)20',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-primary)40',
            borderRadius: '999px',
            padding: '2px 8px',
            fontFamily: 'var(--font-ui)',
          }}>
            KOLLABORATIVT
          </span>
        )}

        {/* Initiator-info för icke-initiativtagare */}
        {quest.collaborative && quest.initiator && quest.initiator !== S.me && (
          <div style={{
            fontSize: 11,
            color: (MEMBERS as any)[quest.initiator]?.color || 'var(--color-accent)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <MemberIcon id={quest.initiator} size={14} />
            från {(MEMBERS as any)[quest.initiator]?.name}
          </div>
        )}

        {/* Progress-indikator — hur många deltagare har slutfört */}
        {quest.collaborative && quest.participants?.length > 0 && (
          <div style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            marginTop: 4,
          }}>
            {quest.completedBy?.length || 0}/{quest.participants.length} klara
          </div>
        )}

        {/* Anslut-knapp för icke-ägare */}
        {quest.collaborative && quest.owner !== S.me && (
          <>
            {/* Kommentarfält innan anslutning */}
            {!isParticipant && (
              <div style={{ marginTop: 'var(--space-sm)' }} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Lägg till en rad... (valfritt)"
                  value={delegationNote}
                  onChange={e => setDelegationNote(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-sm) var(--space-md)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-caption)',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textAlign: 'right', margin: '2px 0 0' }}>
                  {delegationNote.length}/100
                </p>
              </div>
            )}
            <button type="button"
              onClick={(e) => { e.stopPropagation(); handleJoin(quest); }}
              style={{
                background: isParticipant
                  ? 'var(--color-accent)20'
                  : 'var(--color-primary)',
                color: isParticipant ? 'var(--color-accent)' : 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                cursor: isParticipant ? 'default' : 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {isParticipant ? <><Check size={13} strokeWidth={2} /> Ansluten</> : 'Anslut'}
            </button>
          </>
        )}

        {/* Participants-avatarer */}
        {quest.collaborative && quest.participants?.length > 0 && (
          <div style={{
            display: 'flex', gap: 4, marginTop: 8,
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: 11, color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-ui)',
            }}>
              {new Set(quest.participants).size} members
            </span>
            {quest.participants.map((p: string) => (
              <span key={p} style={{
                fontSize: 11,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '999px',
                padding: '2px 8px',
                color: 'var(--color-text-muted)',
              }}>
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Sparad kommentar vid delegering/join */}
        {quest.note && (
          <p style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-muted)',
            fontStyle: 'italic',
            margin: 'var(--space-xs) 0 0',
            paddingLeft: 'var(--space-sm)',
            borderLeft: '2px solid var(--color-border)',
          }}>
            "{quest.note}"
          </p>
        )}

        {needsAI && !isDone && (
          <div className="quest-ai-area">
            <textarea
              className="quest-ai-input"
              placeholder="Beskriv hur du genomförde uppdraget..."
              value={aiDesc}
              onChange={e => setAiDesc(e.target.value)}
              disabled={thinking || verdictApproved}
            />
            {thinking && (
              <div className="quest-ai-thinking" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', padding: 'var(--space-sm) 0' }}>
                <div className="skeleton-pulse" style={{ width: '88%', height: 12, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ width: '72%', height: 12, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ width: '55%', height: 12, borderRadius: 4 }} />
              </div>
            )}
            {verdict && (
              <div className={`quest-ai-verdict ${verdictApproved ? 'approved' : 'rejected'}`}>
                {verdictApproved ? <Check size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> : <X size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />} {verdictText}
              </div>
            )}
            {!verdict && !thinking && (
              <button type="button" className="complete-btn" onClick={handleAIValidate} disabled={!aiDesc.trim()}>
                VALIDERA MED AI
              </button>
            )}
          </div>
        )}

      </motion.div>

      {showDeleg && (
        <DelegationSheet quest={quest} onClose={() => setShowDeleg(false)} />
      )}

      {completingQuest && (
        <QuestCompleteModal
          quest={completingQuest}
          xpGained={lastXP}
          onClose={() => { setCompletingQuest(null); rerender(); }}
          rerender={rerender}
        />
      )}

      {showDetail && (
        <QuestDetailModal
          quest={quest}
          onClose={() => setShowDetail(false)}
          onComplete={() => { setShowDetail(false); handleComplete(); }}
          rerender={rerender}
        />
      )}
    </>
  );
}
