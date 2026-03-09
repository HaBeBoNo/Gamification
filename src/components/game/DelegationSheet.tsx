import React, { useState } from 'react';
import { S } from '@/state/store';
import { MEMBERS, MEMBER_IDS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';

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
    if (!selectedMember) return;
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
