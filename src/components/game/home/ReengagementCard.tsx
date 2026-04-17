import { useReengagementSurface } from '@/hooks/useHomeSurface';
import { queueBandHubIntent } from '@/lib/navigationIntent';
import { CARD_PAD_ROOM, CONTROL_HEIGHT, MOBILE_GUTTER, SECTION_GAP_COMPACT } from './constants';

export function ReengagementCard({
  onNavigate,
  onOpenCoach,
  onOpenNotifications,
}: {
  onNavigate?: (tab: string) => void;
  onOpenCoach?: (initialMessage?: string) => void;
  onOpenNotifications?: () => void;
}) {
  const { me, loading, plan } = useReengagementSurface();

  if (!me) return null;
  if (!loading && !plan) return null;

  return (
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <div style={{
        background: 'color-mix(in srgb, var(--color-primary-muted) 38%, var(--color-surface-elevated))',
        borderRadius: 'var(--radius-card)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
        padding: CARD_PAD_ROOM,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          color: 'var(--color-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 8,
        }}>
          {plan?.eyebrow || 'Tillbaka in'}
        </div>
        {loading ? (
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
            Kalibrerar...
          </div>
        ) : (
          <>
            <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', fontWeight: 600, marginBottom: 6 }}>
              {plan?.title}
            </div>
            {plan?.subtitle ? (
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
                marginBottom: SECTION_GAP_COMPACT,
              }}>
                {plan.subtitle}
              </div>
            ) : null}
            <button type="button"
              onClick={() => {
                if (!plan) return;
                if (plan.target === 'notifications') {
                  onOpenNotifications?.();
                  return;
                }
                if (plan.target === 'coach') {
                  onOpenCoach?.();
                  return;
                }
                if (plan.target === 'bandhub') {
                  queueBandHubIntent(plan.bandHubIntent || {
                    tab: 'kalender',
                    source: 'reengagement',
                  });
                }
                onNavigate?.(plan.target);
              }}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-surface)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                minHeight: CONTROL_HEIGHT,
                padding: '0 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {plan?.cta}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
