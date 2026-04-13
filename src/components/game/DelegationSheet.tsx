import React, { useState } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS, MEMBER_IDS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { notifyMembersSignal } from '@/lib/notificationSignals';
import { pushFeedEntry } from '@/lib/feed';
import { applyQuestDelegation } from '@/lib/delegation';

interface DelegationSheetProps {
  quest: any;
  onClose: () => void;
}

export default function DelegationSheet({ quest, onClose }: DelegationSheetProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(true);

  const otherMembers = MEMBER_IDS.filter(id => id !== S.me);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function handleSend() {
    if (!selectedMember || !S.me) return;

    const questIndex = (S.quests || []).findIndex((item: any) => item.id === quest?.id);
    if (questIndex < 0) return;

    const liveQuest = S.quests[questIndex];
    const senderKey = S.me;
    const senderName = MEMBERS[senderKey]?.name || senderKey;
    const receiverName = MEMBERS[selectedMember]?.name || selectedMember;
    const trimmedNote = note.trim();
    const delegatedAt = Date.now();

    applyQuestDelegation(liveQuest, {
      delegatedBy: senderKey,
      delegatedTo: selectedMember,
      note: trimmedNote,
      ts: delegatedAt,
    });

    pushFeedEntry({
      who: senderKey,
      action: `skickade "${liveQuest.title}" till ${receiverName}`,
      xp: 0,
      type: 'delegation_sent',
    });

    save();

    void notifyMembersSignal({
      targetMemberKeys: [selectedMember],
      type: 'delegation_received',
      title: `${senderName} skickade dig ett uppdrag`,
      body: liveQuest.title,
      dedupeKey: `delegation:${liveQuest.id}:${senderKey}:${selectedMember}:${delegatedAt}`,
      payload: {
        memberId: senderKey,
        questId: liveQuest.id,
        questTitle: liveQuest.title,
        delegationNote: trimmedNote || undefined,
      },
      push: {
        title: `${senderName} skickade dig ett uppdrag`,
        body: `"${liveQuest.title}"`,
        excludeMember: senderKey,
        url: '/',
      },
    });

    handleClose();
  }

  function handleDragEnd(_: any, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 100 || info.velocity.y > 300) {
      handleClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="deleg-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="deleg-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
          >
            <div className="deleg-handle" />
            <div className="deleg-sheet-title">Skicka uppdrag till</div>

            <div className="deleg-member-list">
              {otherMembers.map(id => {
                const member = MEMBERS[id];
                if (!member) return null;
                return (
                  <button
                    key={id}
                    className={`deleg-member-row ${selectedMember === id ? 'selected' : ''}`}
                    onClick={() => setSelectedMember(id)}
                  >
                    <MemberIcon id={id} size={24} color={member.xpColor} />
                    <span className="deleg-member-name">{member.name}</span>
                  </button>
                );
              })}
            </div>

            <input
              className="deleg-note-field"
              placeholder="Lägg till ett meddelande..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            <button
              className="deleg-send-btn"
              onClick={handleSend}
              disabled={!selectedMember}
            >
              Skicka uppdrag
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
