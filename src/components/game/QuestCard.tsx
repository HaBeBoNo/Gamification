import React, { useState, useRef } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { getRoleHidden } from '@/data/quests';
import { awardXP, calcQuestXP } from '@/hooks/useXP';
import { sendPush } from '@/lib/sendPush';
import { aiValidate } from '@/hooks/useAI';
import { Check, X, Zap, Paperclip } from 'lucide-react';
import { motion } from 'framer-motion';
import DelegationSheet from './DelegationSheet';
import QuestCompleteModal from './QuestCompleteModal';
import QuestDetailModal from './QuestDetailModal';

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

  const me = S.me;
  const isDone = quest.done;
  const needsAI = quest.aiRequired;
  const isParticipant = quest.participants?.includes(S.me) || false;

  function handleComplete() {
    if (isDone || !me) return;
    if (needsAI && !verdict?.approved) return;

    const xpEarned = calcQuestXP(me, quest.xp || 30);
    const idx = S.quests.findIndex((q: any) => q.id === quest.id);

    // Kollaborativt quest med deltagare — per-deltagare completion
    if (quest.collaborative && quest.participants?.length > 0) {
      if (idx < 0) return;
      const q = S.quests[idx];
      if (!q.completedBy) q.completedBy = [];
      const completedBy = q.completedBy as string[];
      if (!completedBy.includes(me)) completedBy.push(me);

      // XP till den som just slutförde
      awardXP(quest, xpEarned, null,
        (level) => showLU?.(level),
        (reward, tier) => showRW?.(reward, tier),
      );
      showXP?.(xpEarned);

      const everyoneDone = (q.participants as string[]).every(
        (id: string) => completedBy.includes(id)
      );

      if (everyoneDone) {
        q.done = true;
        const memberName = (MEMBERS as any)[me]?.name || me;
        sendPush(
          `${memberName} slutförde ert gemensamma uppdrag`,
          `"${quest.title}" — alla deltagare klara! 🎉`,
          me,
          '/'
        );
      } else {
        const memberName = (MEMBERS as any)[me]?.name || me;
        const remaining = (q.participants as string[]).filter(
          (id: string) => !completedBy.includes(id)
        ).length;
        sendPush(
          `${memberName} slutförde sin del`,
          `"${quest.title}" — ${remaining} kvar`,
          me,
          '/'
        );
      }

      if (!S.chars[me].completedQuests) S.chars[me].completedQuests = [];
      S.chars[me].completedQuests.push({
        id: quest.id,
        title: quest.title,
        xp: xpEarned,
        cat: quest.cat,
        reflection: '',
        completedAt: Date.now(),
      });

      save();

      if (everyoneDone) {
        setTimeout(() => {
          S.quests = S.quests.filter((sq: any) => sq.id !== quest.id);
          save();
          rerender?.();
        }, 1500);
      } else {
        rerender?.();
      }

      setLastXP(xpEarned);
      setCompletingQuest({ ...quest, done: everyoneDone, completedAt: Date.now() });
      return;
    }

    // Vanligt quest — befintlig logik oförändrad
    const completedQuest = { ...quest, done: true, completedAt: Date.now() };
    if (idx >= 0) S.quests[idx] = completedQuest;

    showXP?.(xpEarned);

    awardXP(quest, xpEarned, null,
      (level) => showLU?.(level),
      (reward, tier) => showRW?.(reward, tier),
    );

    // Spara i historik
    if (!S.chars[me].completedQuests) S.chars[me].completedQuests = [];
    S.chars[me].completedQuests.push({
      id: quest.id,
      title: quest.title,
      xp: xpEarned,
      cat: quest.cat,
      reflection: '',
      completedAt: Date.now(),
    });

    save();

    // Auto-ta bort quest efter 1.5 sekunder
    setTimeout(() => {
      S.quests = S.quests.filter((sq: any) => sq.id !== quest.id);
      save();
      rerender?.();
    }, 1500);

    // Öppna utvärderingsmodal istället för direkt rerender
    setLastXP(xpEarned);
    setCompletingQuest(completedQuest);
  }

  function handleAIValidate() {
    if (!aiDesc.trim() || !me) return;
    setThinking(true);
    aiValidate(quest, aiDesc, null).then(() => {
      setThinking(false);
      const idx = S.quests.findIndex((q: any) => q.id === quest.id);
      if (idx >= 0) setVerdict(S.quests[idx].aiVerdict);
    });
  }

  function handleJoin(quest: any) {
    if (!quest.participants) quest.participants = [];
    if (quest.participants.includes(S.me)) return;

    quest.participants.push(S.me);

    S.feed.unshift({
      who: S.me,
      action: `anslöt sig till "${quest.title}" 🤝`,
      xp: 0,
      time: new Date().toLocaleTimeString('sv-SE', {
        hour: '2-digit', minute: '2-digit'
      }),
    });

    save();
    rerender?.();
  }

  const badgeClass = CAT_BADGE[quest.cat] || 'badge-daily';
  const badgeLabel = CAT_LABEL[quest.cat] || quest.cat?.toUpperCase() || 'UPPDRAG';
  const dotClass = CAT_DOT[quest.cat] || 'cat-global';

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
          <button
            className="quest-menu-trigger"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Meny"
          >
            •••
          </button>
        )}

        {menuOpen && (
          <div className="quest-menu-dropdown" onClick={e => e.stopPropagation()}>
            <button
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
            <span className="quest-region">{quest.region}</span>
          )}
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
            {(MEMBERS as any)[quest.initiator]?.emoji} från {(MEMBERS as any)[quest.initiator]?.name}
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
          <button
            onClick={(e) => { e.stopPropagation(); handleJoin(quest); }}
            style={{
              background: isParticipant
                ? 'var(--color-accent)20'
                : 'var(--color-primary)',
              color: isParticipant ? 'var(--color-accent)' : '#fff',
              border: 'none',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              cursor: isParticipant ? 'default' : 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {isParticipant ? '✓ Ansluten' : 'Anslut'}
          </button>
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
              {quest.participants.length + 1} members
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

        {needsAI && !isDone && (
          <div className="quest-ai-area">
            <textarea
              className="quest-ai-input"
              placeholder="Beskriv hur du genomförde uppdraget..."
              value={aiDesc}
              onChange={e => setAiDesc(e.target.value)}
              disabled={thinking || verdict?.approved}
            />
            {thinking && (
              <div className="quest-ai-thinking" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', padding: 'var(--space-sm) 0' }}>
                <div className="skeleton-pulse" style={{ width: '88%', height: 12, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ width: '72%', height: 12, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ width: '55%', height: 12, borderRadius: 4 }} />
              </div>
            )}
            {verdict && (
              <div className={`quest-ai-verdict ${verdict.approved ? 'approved' : 'rejected'}`}>
                {verdict.approved ? <Check size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> : <X size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />} {verdict.message || verdict.text}
              </div>
            )}
            {!verdict && !thinking && (
              <button className="complete-btn" onClick={handleAIValidate} disabled={!aiDesc.trim()}>
                VALIDERA MED AI
              </button>
            )}
          </div>
        )}

        {!isDone && needsAI && verdict?.approved && (
          <button
            className="complete-btn"
            onClick={e => { e.stopPropagation(); handleComplete(); }}
          >
            SLUTFÖR
          </button>
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
