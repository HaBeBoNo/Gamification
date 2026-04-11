export function SectionEyebrow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 4,
      }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
        {subtitle}
      </div>
    </div>
  );
}
