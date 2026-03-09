import React from 'react';
import { X, Gift } from 'lucide-react';

export default function RewardOverlay({ reward, tier, onClose }: { reward: any; tier?: string; onClose: () => void }) {
  if (!reward) return null;
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <button className="overlay-close" onClick={onClose}><X size={14} /></button>
        <div className="overlay-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Gift size={20} strokeWidth={2} />
          Belöning!
        </div>
        <span className={`rw-tier rw-tier-${tier || 'common'}`}>{(tier || 'common').toUpperCase()}</span>
        <div className="rw-text">{reward?.text || 'Bra jobbat!'}</div>
        <div className="rw-flavor">{reward?.flavor || ''}</div>
        <button className="complete-btn" onClick={onClose}>HÄMTA IN</button>
      </div>
    </div>
  );
}
