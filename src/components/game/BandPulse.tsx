import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MEMBERS } from '@/data/members';
import { ChevronRight, Flame, Moon, Zap } from 'lucide-react';
import { MOBILE_GUTTER } from '@/components/game/home/constants';

type PulseLevel = 'Vilande' | 'Aktiv' | 'I eld';

interface BandPulseProps {
  onNavigate?: (tab: string) => void;
}

export function BandPulse({ onNavigate }: BandPulseProps) {
  const [activeToday, setActiveToday] = useState(0);
  const [xp48h, setXp48h] = useState(0);
  const [pulse, setPulse] = useState<PulseLevel>('Vilande');
  const [loading, setLoading] = useState(true);
  const retriesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadWithRetry() {
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('activity_feed')
        .select('who, xp, created_at')
        .gte('created_at', since48h);

      if (cancelled) return;

      if (!data && retriesRef.current < 3) {
        retriesRef.current += 1;
        retryTimer = setTimeout(() => {
          void loadWithRetry();
        }, 2000);
        return;
      }

      if (data) {
        retriesRef.current = 0;
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

      setLoading(false);
    }

    void loadWithRetry();

    const channel = supabase
      .channel('band-pulse')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, () => {
        retriesRef.current = 0;
        void loadWithRetry();
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return (
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-card)',
        height: 88,
        border: '1px solid var(--color-border)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    </div>
  );

  const pulseColor =
    pulse === 'I eld' ? 'var(--color-accent)' :
    pulse === 'Aktiv' ? 'var(--color-primary)' :
    'var(--color-text-muted)';
  const PulseIcon = pulse === 'I eld' ? Flame : pulse === 'Aktiv' ? Zap : Moon;
  const Wrapper = onNavigate ? 'button' : 'div';

  return (
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 var(--section-gap-compact)',
      }}>
        Bandpuls
      </div>
      <Wrapper
        {...(onNavigate ? { type: 'button', onClick: () => onNavigate('activity') } : {})}
        style={{
          width: '100%',
          background: 'var(--color-surface-elevated)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--card-padding-room)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--section-gap-compact)',
          border: '1px solid var(--color-border)',
          textAlign: 'left',
          cursor: onNavigate ? 'pointer' : 'default',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{
              fontSize: 'var(--text-body)',
              color: pulseColor,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <PulseIcon size={15} strokeWidth={1.9} />
              {pulse}
            </span>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              Hur bandet rör sig senaste 48 timmarna
            </span>
          </div>
          {onNavigate ? (
            <div style={{
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}>
              <ChevronRight size={16} strokeWidth={1.9} />
            </div>
          ) : null}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-subheading)', color: 'var(--color-text)' }}>{activeToday}</div>
            <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>aktiva idag</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-subheading)', color: 'var(--color-text)' }}>{xp48h}</div>
            <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>XP / 48h</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-subheading)', color: 'var(--color-text)' }}>{Object.keys(MEMBERS).length}</div>
            <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>i bandet</div>
          </div>
        </div>
      </Wrapper>
    </div>
  );
}
