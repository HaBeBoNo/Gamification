import React, { useEffect, useMemo, useState } from 'react';
import { S, save, useGameStore } from '@/state/store';
import { CalendarCheck, Check } from 'lucide-react';

export default function WeeklyCheckout({ rerender }: { rerender: () => void }) {
  useGameStore((state) => state.tick);
  const weekKey = `w${S.weekNum}`;
  const checkout = S.weeklyCheckouts?.[weekKey] as { ts?: number; hrs?: number } | undefined;
  const isDone = !!checkout;
  const [hours, setHours] = useState(() => {
    const value = Number(checkout?.hrs);
    return Number.isFinite(value) && value >= 0 ? String(value) : '';
  });
  const parsedHours = useMemo(() => {
    if (!hours.trim()) return null;
    const normalized = hours.replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }, [hours]);

  useEffect(() => {
    const value = Number(checkout?.hrs);
    setHours(Number.isFinite(value) && value >= 0 ? String(value) : '');
  }, [weekKey, checkout?.hrs]);

  function handleCheckout() {
    if (isDone || parsedHours === null) return;
    S.weeklyCheckouts = {
      ...(S.weeklyCheckouts || {}),
      [weekKey]: { ts: Date.now(), hrs: parsedHours },
    };
    save();
    rerender();
  }

  return (
    <div className="checkout-bar">
      <CalendarCheck size={20} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      <div className="checkout-text">
        {isDone ? <><Check size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Vecka {S.weekNum} incheckad · {Number(checkout?.hrs || 0)}h</> : `Vecka ${S.weekNum} — hur många timmar landade?`}
      </div>
      {!isDone && (
        <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 10px',
          minHeight: 36,
          borderRadius: '999px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-elevated)',
        }}>
          <input
            type="number"
            min="0"
            max="80"
            step="0.5"
            inputMode="decimal"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            placeholder="0"
            style={{
              width: 52,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: 'var(--text-caption)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>h</span>
        </label>
      )}
      <button
        className={`checkout-btn ${isDone ? 'done' : ''}`}
        onClick={handleCheckout}
        disabled={isDone || parsedHours === null}
      >{isDone ? 'INCHECKAD' : 'SPARA'}</button>
    </div>
  );
}
