import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function LevelUpOverlay({ level, onClose }: { level: number | null; onClose: () => void }) {
  useEffect(() => {
    if (!level) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [level, onClose]);

  if (!level) return null;

  const confettiPieces = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.3,
    duration: 1.5 + Math.random() * 0.5,
    x: (Math.random() - 0.5) * 200,
    rotation: Math.random() * 720,
  }));

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <motion.div
        className="overlay-card lu-overlay"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Confetti pieces */}
        {confettiPieces.map(piece => (
          <motion.span
            key={piece.id}
            style={{
              position: 'absolute',
              fontSize: '24px',
              pointerEvents: 'none',
            }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: piece.x, y: -60, opacity: 0, rotate: piece.rotation }}
            transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeOut' }}
          >
            ✨
          </motion.span>
        ))}

        <div className="lu-label">LEVEL UP!</div>
        <div className="lu-level">{level}</div>
        <div className="overlay-subtitle" style={{ textAlign: 'center' }}>Du har nått en ny nivå. Fortsätt kämpa!</div>
        <button className="complete-btn" style={{ alignSelf: 'center' }} onClick={onClose}>FORTSÄTT</button>
      </motion.div>
    </div>
  );
}
