import React from 'react';
import { X, Gift } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export default function RewardOverlay({ reward, tier, onClose }: { reward: any; tier?: string; onClose: () => void }) {
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(reward));
  if (!reward) return null;
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div
        ref={trapRef}
        className="overlay-card"
        role="dialog"
        aria-modal="true"
        aria-label="Belöning"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="overlay-close" onClick={onClose} aria-label="Stäng belöning"><X size={14} /></button>
        <div className="overlay-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Gift size={20} strokeWidth={2} />
          Belöning!
        </div>
        <span className={`rw-tier rw-tier-${tier || 'common'}`}>{(tier || 'common').toUpperCase()}</span>
        <div className="rw-text">{reward?.text || 'Bra jobbat!'}</div>
        <div className="rw-flavor">{reward?.flavor || ''}</div>
        <button type="button" className="complete-btn" onClick={onClose}>HÄMTA IN</button>
      </div>
    </div>
  );
}
