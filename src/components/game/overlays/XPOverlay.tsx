import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface XPOverlayProps {
  amount: number;
  onDone: () => void;
}

export default function XPOverlay({ amount, onDone }: XPOverlayProps) {
  const [display, setDisplay] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const startRef = useRef<number | null>(null);
  const stableOnDone = useCallback(onDone, []);

  useEffect(() => {
    const duration = 600;
    function tick(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * amount));
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(stableOnDone, 300);
        }, 100);
      }
    }
    requestAnimationFrame(tick);
  }, [amount, stableOnDone]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="xp-overlay-backdrop"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        >
          <div className="xp-overlay-card">
            <div className="xp-overlay-glow" />
            <div className="xp-overlay-value">+{display}</div>
            <div className="xp-overlay-label">XP</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
