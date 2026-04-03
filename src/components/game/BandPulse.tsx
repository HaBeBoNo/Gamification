import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MEMBERS } from '@/data/members.js';

type PulseLevel = 'Vilande' | 'Aktiv' | 'I eld';

export function BandPulse() {
  const [activeToday, setActiveToday] = useState(0);
  const [xp48h, setXp48h] = useState(0);
  const [pulse, setPulse] = useState<PulseLevel>('Vilande');

  useEffect(() => {
    async function load() {
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const sinceToday = new Date();
      sinceToday.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('activity_feed')
        .select('who, xp, created_at')
        .gte('created_at', since48h);

      if (!data) return;

      const todayStr = new Date().toDateString();
      const activeMemberKeys = new Set(
        data
          .filter(item => new Date(item.created_at).toDateString() === todayStr)
          .map(item => item.who)
      );
      const totalXP = data.reduce((sum, item) => sum + (item.xp ?? 0), 0);

      setActiveToday(activeMemberKeys.size);
      setXp48h(totalXP);

      if (activeMemberKeys.size >= 5 || totalXP > 500) setPulse('I eld');
      else if (activeMemberKeys.size >= 2 || totalXP > 100) setPulse('Aktiv');
      else setPulse('Vilande');
    }

    load();

    const channel = supabase
      .channel('band-pulse')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const pulseColor =
    pulse === 'I eld' ? 'var(--color-accent)' :
    pulse === 'Aktiv' ? 'var(--color-primary)' :
    'var(--color-text-muted)';

  const pulseEmoji = pulse === 'I eld' ? '🔥' : pulse === 'Aktiv' ? '⚡' : '😴';

  return (
    <div style={{
      background: 'var(--color-surface-elevated)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md) var(--space-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-md)',
      margin: '0 var(--space-md) var(--space-md)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Band Pulse
        </span>
        <span style={{ fontSize: 'var(--text-body)', color: pulseColor, fontWeight: 600 }}>
          {pulseEmoji} {pulse}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-heading)', color: 'var(--color-text)' }}>{activeToday}</div>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>aktiva idag</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-heading)', color: 'var(--color-text)' }}>{xp48h}</div>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>XP / 48h</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-heading)', color: 'var(--color-text)' }}>{Object.keys(MEMBERS).length}</div>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>members</div>
        </div>
      </div>
    </div>
  );
}
