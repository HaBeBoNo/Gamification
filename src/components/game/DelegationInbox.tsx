import React, { useState } from 'react';
import { S, save, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { notifyMembersSignal } from '@/lib/notificationSignals';
import { pushFeedEntry } from '@/lib/feed';
import { acceptQuestDelegation, declineQuestDelegation } from '@/lib/delegation';

interface DelegationInboxProps {
  rerender: () => void;
}

export default function DelegationInbox({ rerender }: DelegationInboxProps) {
  useGameStore((state) => state.tick);
  const pending = (S.quests || []).filter(
    (q: any) => q.delegatedTo === S.me && !q.delegationHandled
  );

  const [dismissing, setDismissing] = useState<Record<string, 'accept' | 'decline'>>({});

  if (pending.length === 0) return null;

  function handleAccept(questId: string) {
    if (!S.me) return;

    const quest = (S.quests || []).find((item: any) => String(item.id) === String(questId));
    if (!quest) return;

    const memberKey = S.me;
    const memberName = MEMBERS[memberKey]?.name || memberKey;
    const delegatorKey = quest.delegatedBy as string | undefined;

    acceptQuestDelegation(quest, memberKey);
    pushFeedEntry({
      who: memberKey,
      action: `accepterade "${quest.title}"`,
      xp: 0,
      type: 'delegation_accepted',
    });
    save();

    if (delegatorKey && delegatorKey !== memberKey) {
      void notifyMembersSignal({
        targetMemberKeys: [delegatorKey],
        type: 'delegation_accepted',
        title: `${memberName} accepterade ditt uppdrag`,
        body: quest.title,
        dedupeKey: `delegation-accepted:${quest.id}:${memberKey}`,
        payload: {
          memberId: memberKey,
          questId: quest.id,
          questTitle: quest.title,
        },
        push: {
          title: `${memberName} accepterade ditt uppdrag`,
          body: `"${quest.title}"`,
          excludeMember: memberKey,
          url: '/',
        },
      });
    }

    setDismissing(p => ({ ...p, [questId]: 'accept' }));
    setTimeout(() => { rerender(); }, 300);
  }

  function handleDecline(questId: string) {
    if (!S.me) return;

    const quest = (S.quests || []).find((item: any) => String(item.id) === String(questId));
    if (!quest) return;

    const memberKey = S.me;
    const memberName = MEMBERS[memberKey]?.name || memberKey;
    const delegatorKey = quest.delegatedBy as string | undefined;

    declineQuestDelegation(quest, memberKey);
    pushFeedEntry({
      who: memberKey,
      action: `tackade nej till "${quest.title}"`,
      xp: 0,
      type: 'delegation_declined',
    });
    save();

    if (delegatorKey && delegatorKey !== memberKey) {
      void notifyMembersSignal({
        targetMemberKeys: [delegatorKey],
        type: 'delegation_declined',
        title: `${memberName} tackade nej till ditt uppdrag`,
        body: quest.title,
        dedupeKey: `delegation-declined:${quest.id}:${memberKey}`,
        payload: {
          memberId: memberKey,
          questId: quest.id,
          questTitle: quest.title,
        },
        push: {
          title: `${memberName} tackade nej till ditt uppdrag`,
          body: `"${quest.title}"`,
          excludeMember: memberKey,
          url: '/',
        },
      });
    }

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
