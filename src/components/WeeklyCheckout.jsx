import React from 'react';
import { S, save } from '../state/store';

export default function WeeklyCheckout({ rerender }) {
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
      <span style={{ fontSize:'1.1rem' }}>📅</span>
      <div className="checkout-text">
        {isDone
          ? `Vecka ${S.weekNum} incheckad ✓`
          : `Vecka ${S.weekNum} — checka in dina timmar`}
      </div>
      <button
        className={`checkout-btn ${isDone ? 'done' : ''}`}
        onClick={handleCheckout}
        disabled={isDone}
      >
        {isDone ? 'INCHECKAD' : 'CHECKA IN'}
      </button>
    </div>
  );
}
