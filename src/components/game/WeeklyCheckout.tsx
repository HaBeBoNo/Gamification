import React from 'react';
import { S, save } from '@/state/store';
import { CalendarCheck } from 'lucide-react';

export default function WeeklyCheckout({ rerender }: { rerender: () => void }) {
  const weekKey = `w${S.weekNum}`;
  const checkout = S.weeklyCheckouts?.[weekKey];
  const isDone = !!checkout;

  function handleCheckout() {
    if (isDone) return;
    S.weeklyCheckouts = {
      ...(S.weeklyCheckouts || {}),
      [weekKey]: { ts: Date.now(), hrs: 0 },
    };
    save();
    rerender();
  }

  return (
    <div className="checkout-bar">
      <CalendarCheck size={20} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      <div className="checkout-text">
        {isDone ? `Vecka ${S.weekNum} incheckad ✓` : `Vecka ${S.weekNum} — checka in dina timmar`}
      </div>
      <button
        className={`checkout-btn ${isDone ? 'done' : ''}`}
        onClick={handleCheckout}
        disabled={isDone}
      >{isDone ? 'INCHECKAD' : 'CHECKA IN'}</button>
    </div>
  );
}
