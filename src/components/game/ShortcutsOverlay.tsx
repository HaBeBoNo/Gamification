import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsOverlay({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="shortcuts-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="shortcuts-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="shortcuts-title">Kortkommandon</div>
            <div className="shortcuts-grid">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="shortcuts-row">
                  <span className="shortcuts-key">{s.key}</span>
                  <span className="shortcuts-desc">{s.desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
