import React, { useState } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';

interface DelegationInboxProps {
  rerender: () => void;
}

export default function DelegationInbox({ rerender }: DelegationInboxProps) {
  const pending = (S.quests || []).filter(
    (q: any) => q.delegatedTo === S.me && !q.delegationHandled
  );

  const [dismissing, setDismissing] = useState<Record<string, 'accept' | 'decline'>>({});

  if (pending.length === 0) return null;

  function handleAccept(questId: string) {
    setDismissing(p => ({ ...p, [questId]: 'accept' }));
    setTimeout(() => { rerender(); }, 300);
  }

  function handleDecline(questId: string) {
    setDismissing(p => ({ ...p, [questId]: 'decline' }));
    setTimeout(() => { rerender(); }, 300);
  }

  return (
    <div className="inbox-section">
      <div className="inbox-header">
        <span className="inbox-label">Inkorg</span>
        <span className="inbox-count">{pending.length}</span>
      </div>
      <AnimatePresence>
        {pending.map((q: any) => {
          const sender = q.delegatedBy ? MEMBERS[q.delegatedBy] : null;
          const status = dismissing[q.id];
          if (status) return null;
          return (
            <motion.div
              key={q.id}
              className="inbox-card"
              style={sender ? { borderLeft: `3px solid ${sender.xpColor}` } : undefined}
              initial={{ opacity: 1, y: 0 }}
              exit={status === 'accept'
                ? { y: 20, opacity: 0, transition: { duration: 0.25 } }
                : { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
              }
              layout
            >
              {sender && (
                <div className="inbox-sender">
                  <MemberIcon id={q.delegatedBy} size={20} color={sender.xpColor} />
                  <span>{sender.name}</span>
                </div>
              )}
              <div className="inbox-quest-title">{q.title}</div>
              {q.delegationNote && <div className="inbox-note">{q.delegationNote}</div>}
              <div className="inbox-actions">
                <button className="inbox-accept" onClick={() => handleAccept(q.id)}>Acceptera</button>
                <button className="inbox-decline" onClick={() => handleDecline(q.id)}>Tacka nej</button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
