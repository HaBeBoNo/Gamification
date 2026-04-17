import React, { useEffect, useMemo, useState } from 'react';
import { S, save, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { CalendarCheck, Check, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type CheckoutEntry = { ts?: number; hrs?: number };

function getBandWeekSummary(weekKey: string): { totalHrs: number; checkedIn: number; total: number } {
  const memberIds = Object.keys(MEMBERS);
  let totalHrs = 0;
  let checkedIn = 0;

  for (const id of memberIds) {
    const char = S.chars[id];
    const checkouts = (char?.weeklyCheckouts ?? S.weeklyCheckouts) as Record<string, CheckoutEntry> | undefined;
    const entry = checkouts?.[weekKey] as CheckoutEntry | undefined;
    if (entry?.hrs != null) {
      totalHrs += Number(entry.hrs) || 0;
      checkedIn++;
    }
  }

  // Also check global weeklyCheckouts for current user
  const globalEntry = (S.weeklyCheckouts as Record<string, CheckoutEntry>)?.[weekKey];
  if (globalEntry?.hrs != null && checkedIn === 0) {
    totalHrs += Number(globalEntry.hrs) || 0;
    checkedIn = 1;
  }

  return { totalHrs: Math.round(totalHrs * 10) / 10, checkedIn, total: memberIds.length };
}

function getPersonalTrend(): 'up' | 'down' | 'flat' | null {
  const checkouts = S.weeklyCheckouts as Record<string, CheckoutEntry> | undefined;
  if (!checkouts) return null;

  const currentWeek = S.weekNum;
  const current = checkouts[`w${currentWeek}`];
  const previous = checkouts[`w${currentWeek - 1}`];

  if (!current?.hrs || !previous?.hrs) return null;

  const diff = Number(current.hrs) - Number(previous.hrs);
  if (diff > 1) return 'up';
  if (diff < -1) return 'down';
  return 'flat';
}

export default function WeeklyCheckout({ rerender }: { rerender: () => void }) {
  useGameStore((state) => state.tick);
  const weekKey = `w${S.weekNum}`;
  const checkout = S.weeklyCheckouts?.[weekKey] as CheckoutEntry | undefined;
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

  const bandSummary = useMemo(() => isDone ? getBandWeekSummary(weekKey) : null, [isDone, weekKey]);
  const trend = useMemo(() => isDone ? getPersonalTrend() : null, [isDone]);

  function handleCheckout() {
    if (isDone || parsedHours === null) return;
    S.weeklyCheckouts = {
      ...(S.weeklyCheckouts || {}),
      [weekKey]: { ts: Date.now(), hrs: parsedHours },
    };
    save();
    rerender();
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="checkout-bar" style={{ flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
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
        <button type="button"
          className={`checkout-btn ${isDone ? 'done' : ''}`}
          onClick={handleCheckout}
          disabled={isDone || parsedHours === null}
        >{isDone ? 'INCHECKAD' : 'SPARA'}</button>
      </div>
      {isDone && bandSummary && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 30,
          fontSize: 'var(--text-micro)',
          color: 'var(--color-text-muted)',
        }}>
          <span>Bandet: {bandSummary.totalHrs}h totalt · {bandSummary.checkedIn}/{bandSummary.total} incheckade</span>
          {trend && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: trend === 'up' ? 'var(--color-accent)' : trend === 'down' ? 'var(--color-text-muted)' : 'var(--color-text-muted)',
            }}>
              <TrendIcon size={12} strokeWidth={2} />
              {trend === 'up' ? 'Uppåt' : trend === 'down' ? 'Nedåt' : 'Stabilt'} vs förra veckan
            </span>
          )}
        </div>
      )}
    </div>
  );
}
