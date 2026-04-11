import { MemberIcon } from '@/components/icons/MemberIcons';
import { useHomeBandEchoSurface } from '@/hooks/useHomeSurface';
import { CARD_PAD_ROOM, CONTROL_HEIGHT, MOBILE_GUTTER, SECTION_GAP_COMPACT } from './constants';

export function HomeBandEcho({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) {
  const { items, loading, formatActivityAge, getHomeEchoSummary } = useHomeBandEchoSurface();

  return (
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: `0 0 ${SECTION_GAP_COMPACT}`,
      }}>
        Från bandet
      </p>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: CARD_PAD_ROOM, color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
            Lyssnar in bandet...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: CARD_PAD_ROOM, display: 'flex', flexDirection: 'column', gap: SECTION_GAP_COMPACT }}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text)', fontWeight: 600 }}>
              Det är lugnt i bandet just nu.
            </div>
            <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              När någon annan rör sig dyker det upp här först. Hela flödet finns fortfarande under Aktivitet.
            </div>
            <button
              onClick={() => onNavigate?.('activity')}
              style={{
                alignSelf: 'flex-start',
                marginTop: 'var(--space-xs)',
                background: 'transparent',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-pill)',
                minHeight: CONTROL_HEIGHT,
                padding: '0 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Öppna flödet
            </button>
          </div>
        ) : (
          <>
            {items.map((item, index) => {
              const summary = getHomeEchoSummary(item);
              const actor = item?.who;
              return (
                <button
                  key={String(item?.id || index)}
                  onClick={() => onNavigate?.('activity')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: SECTION_GAP_COMPACT,
                    padding: `var(--card-padding) ${CARD_PAD_ROOM}`,
                    background: 'transparent',
                    border: 'none',
                    borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <MemberIcon id={actor} size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', marginBottom: 4 }}>
                      <div style={{
                        fontSize: 'var(--text-caption)',
                        color: 'var(--color-text)',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {summary.title}
                      </div>
                      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {formatActivityAge(item)}
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      {summary.body}
                    </div>
                  </div>
                </button>
              );
            })}
            <div style={{ padding: `0 ${CARD_PAD_ROOM} ${CARD_PAD_ROOM}` }}>
              <button
                onClick={() => onNavigate?.('activity')}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  minHeight: CONTROL_HEIGHT,
                  padding: '0 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Se hela flödet
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
