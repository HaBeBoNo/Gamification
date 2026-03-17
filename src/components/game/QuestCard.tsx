import React, { useState, useRef } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { getRoleHidden } from '@/data/quests';
import { awardXP, calcQuestXP } from '@/hooks/useXP';
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

  function handleComplete() {
    if (isDone || !me) return;
    if (needsAI && !verdict?.approved) return;

    const xpEarned = calcQuestXP(me, quest.xp || 30);
    const idx = S.quests.findIndex((q: any) => q.id === quest.id);
    const completedQuest = { ...quest, done: true, completedAt: Date.now() };
    if (idx >= 0) S.quests[idx] = completedQuest;

    showXP?.(xpEarned);

    awardXP(quest, xpEarned, null, rerender,
      (level) => showLU?.(level),
      (reward, tier) => showRW?.(reward, tier),
    );
    save();

    // Öppna utvärderingsmodal istället för direkt rerender
    setLastXP(xpEarned);
    setCompletingQuest(completedQuest);
  }

  function handleAIValidate() {
    if (!aiDesc.trim() || !me) return;
    setThinking(true);
    aiValidate(quest, aiDesc, null, () => {
      setThinking(false);
      const idx = S.quests.findIndex((q: any) => q.id === quest.id);
      if (idx >= 0) setVerdict(S.quests[idx].aiVerdict);
      rerender();
    });
  }

  const badgeClass = CAT_BADGE[quest.cat] || 'badge-daily';
  const badgeLabel = CAT_LABEL[quest.cat] || quest.cat?.toUpperCase() || 'UPPDRAG';
  const dotClass = CAT_DOT[quest.cat] || 'cat-global';

  return (
    <>
      <motion.div
        className={`quest-card ${isDone ? 'done' : ''}`}
        whileTap={isDone ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        layout
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
        onClick={() => !isDone && !menuOpen && setShowDetail(true)}
        style={{ cursor: isDone ? 'default' : 'pointer' }}
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

      {showDetail && !isDone && (
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
