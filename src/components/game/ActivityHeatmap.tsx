import React, { useState, useEffect, useRef } from 'react';
import { S } from '@/state/store';

interface ActivityHeatmapProps {
  memberId: string;
  xpColor: string;
  compact?: boolean; // 26 cols for other members
}

function getCompletionMap(memberId: string): Record<string, number> {
  const map: Record<string, number> = {};
  (S.quests || []).forEach((q: any) => {
    if (q.done && (q.owner === memberId || q.completedBy === memberId)) {
      const d = q.completedAt ? new Date(q.completedAt) : null;
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        map[key] = (map[key] || 0) + 1;
      }
    }
  });
  return map;
}

function getStreaks(completionMap: Record<string, number>) {
  const dates = Object.keys(completionMap).sort();
  if (dates.length === 0) return { current: 0, longest: 0, total: Object.values(completionMap).reduce((s, v) => s + v, 0) };

  let longest = 1;
  let current = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Check streaks
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (86400000));
    if (diffDays === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  // Check if current streak is still active (last date is today or yesterday)
  const lastDate = dates[dates.length - 1];
  const lastD = new Date(lastDate);
  const diffFromToday = Math.round((today.getTime() - lastD.getTime()) / 86400000);
  if (diffFromToday > 1) current = 0;

  return { current, longest, total: Object.values(completionMap).reduce((s, v) => s + v, 0) };
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const DAY_LABELS = ['M', '', 'O', '', 'F', '', ''];

export default function ActivityHeatmap({ memberId, xpColor, compact }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const weeks = compact ? 26 : 52;
  const cellSize = compact ? 9 : 11;
  const gap = 2;

  const completionMap = getCompletionMap(memberId);
  const streaks = getStreaks(completionMap);

  // Build grid data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7 - 1) - dayOfWeek);

  const grid: { date: Date; key: string; count: number }[][] = [];
  const d = new Date(startDate);
  for (let w = 0; w < weeks; w++) {
    const week: typeof grid[0] = [];
    for (let day = 0; day < 7; day++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      week.push({ date: new Date(d), key, count: completionMap[key] || 0 });
      d.setDate(d.getDate() + 1);
    }
    grid.push(week);
  }

  // Month labels
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  grid.forEach((week, wi) => {
    const firstDay = week[0];
    const m = firstDay.date.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: MONTHS_SHORT[m], col: wi });
      lastMonth = m;
    }
  });

  // Intersection observer for stagger animation
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  function getCellColor(count: number) {
    if (count === 0) return 'var(--color-surface-elevated)';
    const alpha = count === 1 ? 0.25 : count === 2 ? 0.5 : count === 3 ? 0.75 : 1;
    return xpColor + (alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : '');
  }

  function handleCellHover(e: React.MouseEvent, cell: typeof grid[0][0]) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const parentRect = ref.current?.getBoundingClientRect();
    if (!parentRect) return;
    setTooltip({
      x: rect.left - parentRect.left + cellSize / 2,
      y: rect.top - parentRect.top - 4,
      date: cell.date.toLocaleDateString('sv-SE'),
      count: cell.count,
    });
  }

  const gridWidth = weeks * (cellSize + gap) - gap;
  const labelWidth = compact ? 0 : 20;

  return (
    <div className="heatmap-wrap" ref={ref}>
      {/* Month labels */}
      {!compact && (
        <div className="heatmap-months" style={{ marginLeft: labelWidth, width: gridWidth }}>
          {monthLabels.map((ml, i) => (
            <span
              key={i}
              className="heatmap-month-label"
              style={{ left: ml.col * (cellSize + gap) }}
            >
              {ml.label}
            </span>
          ))}
        </div>
      )}

      <div className="heatmap-body">
        {/* Day labels */}
        {!compact && (
          <div className="heatmap-day-labels" style={{ width: labelWidth }}>
            {DAY_LABELS.map((l, i) => (
              <span key={i} className="heatmap-day-label" style={{ height: cellSize, lineHeight: cellSize + 'px' }}>
                {l}
              </span>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="heatmap-grid" style={{ gap, gridTemplateColumns: `repeat(${weeks}, ${cellSize}px)`, gridTemplateRows: `repeat(7, ${cellSize}px)` }}>
          {grid.map((week, wi) =>
            week.map((cell, di) => (
              <div
                key={`${wi}-${di}`}
                className="heatmap-cell"
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: getCellColor(cell.count),
                  gridColumn: wi + 1,
                  gridRow: di + 1,
                  opacity: visible ? 1 : 0,
                  transition: `opacity 200ms ease-out ${wi * 15}ms`,
                }}
                onMouseEnter={e => handleCellHover(e, cell)}
                onMouseLeave={() => setTooltip(null)}
                onTouchStart={e => {
                  const touch = e.touches[0];
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  const parentRect = ref.current?.getBoundingClientRect();
                  if (parentRect) {
                    setTooltip({
                      x: rect.left - parentRect.left + cellSize / 2,
                      y: rect.top - parentRect.top - 4,
                      date: cell.date.toLocaleDateString('sv-SE'),
                      count: cell.count,
                    });
                  }
                }}
                onTouchEnd={() => setTooltip(null)}
              />
            ))
          )}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <span>{tooltip.date}</span>
          <span>{tooltip.count > 0 ? `${tooltip.count} uppdrag` : 'Ingen aktivitet'}</span>
        </div>
      )}

      {/* Stat pills */}
      <div className="heatmap-stats">
        <div className="heatmap-stat-pill">
          <span className="heatmap-stat-value">{streaks.total}</span>
          <span className="heatmap-stat-label">slutförda</span>
        </div>
        <div className="heatmap-stat-pill">
          <span className="heatmap-stat-value">{streaks.current}</span>
          <span className="heatmap-stat-label">streak</span>
        </div>
        <div className="heatmap-stat-pill">
          <span className="heatmap-stat-value">{streaks.longest}</span>
          <span className="heatmap-stat-label">längsta</span>
        </div>
      </div>
    </div>
  );
}
