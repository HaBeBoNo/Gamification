import React, { useState, useEffect, useRef, useCallback } from 'react';

interface XPOverlayProps {
  amount: number;
  onDone: () => void;
}

export default function XPOverlay({ amount, onDone }: XPOverlayProps) {
  const [display, setDisplay] = useState(0);
  const [fading, setFading] = useState(false);
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
          setFading(true);
          setTimeout(stableOnDone, 300);
        }, 100);
      }
    }
    requestAnimationFrame(tick);
  }, [amount, stableOnDone]);

  return (
    <div className={`xp-overlay-backdrop ${fading ? 'xp-fading' : ''}`}>
      <div className="xp-overlay-card">
        <div className="xp-overlay-glow" />
        <div className="xp-overlay-value">+{display}</div>
        <div className="xp-overlay-label">XP</div>
      </div>
    </div>
  );
}
