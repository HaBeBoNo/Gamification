import React, { useState } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { awardXP, calcQuestXP } from '@/hooks/useXP';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { ChevronLeft, RefreshCw, Zap, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CAT_COLORS: Record<string, string> = {
  wisdom: 'var(--cat-wisdom)', tech: 'var(--cat-tech)', social: 'var(--cat-social)',
  money: 'var(--cat-money)', health: 'var(--cat-health)', global: 'var(--cat-global)',
};

interface Props {
  quest: any;
  onClose: () => void;
  rerender: () => void;
  showLU?: (level: number) => void;
  showRW?: (reward: any, tier?: string) => void;
  showXP?: (amount: number) => void;
}

export default function QuestDetail({ quest, onClose, rerender, showLU, showRW, showXP }: Props) {
  const [reflection, setReflection] = useState('');
  const [completing, setCompleting] = useState(false);
  const me = S.me;
  const isDone = quest.done;
  const isStrategic = quest.type === 'strategic';
  const canComplete = !isStrategic || reflection.trim().length > 0;
  const catColor = CAT_COLORS[quest.cat] || 'var(--color-primary)';
  const delegator = quest.delegatedBy ? MEMBERS[quest.delegatedBy] : null;

  function handleComplete() {
    if (isDone || !me || completing) return;
    if (isStrategic && !reflection.trim()) return;
    setCompleting(true);

    const xpEarned = calcQuestXP(me, quest.xp || 30);
    const idx = S.quests.findIndex((q: any) => q.id === quest.id);
    if (idx >= 0) {
      S.quests[idx] = {
        ...quest,
        done: true,
        completedAt: Date.now(),
        reflection: reflection || undefined,
      };
    }

    showXP?.(xpEarned);

    awardXP(quest, xpEarned, null,
      (level) => showLU?.(level),
      (reward, tier) => showRW?.(reward, tier),
    );
    save();

    setTimeout(() => onClose(), 600);
  }

  const recurLabel = quest.recur === 'weekly' ? 'Varje vecka' : quest.recur === 'monthly' ? 'Varje månad' : null;

  return (
    <AnimatePresence>
      <motion.div
        className="qd-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="qd-panel"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 40 }}
        >
          <div className="qd-header">
            <button className="qd-back" onClick={onClose}>
              <ChevronLeft size={24} strokeWidth={1.5} />
            </button>
          </div>

          <div className="qd-body">
            <motion.div
              className="qd-title-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <span className="qd-cat-dot" style={{ background: catColor }} />
              <h2 className="qd-title">{quest.title}</h2>
            </motion.div>

            <motion.div
              className="qd-region-pill"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {quest.region || '🌐 Global'}
            </motion.div>

            <motion.div
              className="qd-xp-display"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <span className="qd-xp-value">{quest.xp}</span>
              <span className="qd-xp-label">XP</span>
            </motion.div>

            <motion.p
              className="qd-desc"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {quest.desc}
            </motion.p>

            {recurLabel && (
              <motion.div
                className="qd-meta-row"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <RefreshCw size={14} strokeWidth={2} />
                <span>Återkommande · {recurLabel}</span>
              </motion.div>
            )}

            {quest.synergyTrigger && (
              <motion.div
                className="qd-meta-row qd-synergy"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Zap size={14} strokeWidth={2} />
                <span>Aktiverar synergi när avklarad</span>
              </motion.div>
            )}

            {delegator && (
              <motion.div
                className="qd-meta-row"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <MemberIcon id={quest.delegatedBy} size={20} color={delegator.xpColor} />
                <span>Skickat av {delegator.name}</span>
              </motion.div>
            )}

            {!isDone && (
              <motion.div
                className="qd-reflection"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <label className="qd-reflection-label">DIN REFLEKTION</label>
                <textarea
                  className="qd-reflection-input"
                  placeholder="Vad hände? Vad lärde du dig?"
                  value={reflection}
                  onChange={e => setReflection(e.target.value)}
                  rows={4}
                />
                {isStrategic && (
                  <span className="qd-reflection-note">
                    Reflektion krävs för att avklara detta uppdrag.
                  </span>
                )}
              </motion.div>
            )}
          </div>

          <div className="qd-footer">
            {isDone ? (
              <div className="qd-completed-row">
                <Check size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Avklarad {quest.completedAt ? new Date(quest.completedAt).toLocaleDateString('sv-SE') : ''}
              </div>
            ) : (
              <button
                className="qd-complete-btn"
                onClick={handleComplete}
                disabled={!canComplete || completing}
              >
                {isStrategic
                  ? 'Markera som avklarad'
                  : 'Markera som gjord · Inga krav'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
