export type RegionDisplayKind = 'global' | 'personal' | 'local';

const LEADING_DECORATIVE_PREFIX = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\u200D|\uFE0F|\s)+/u;

export function stripDecorativePrefix(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const stripped = raw.replace(LEADING_DECORATIVE_PREFIX, '').trim();
  return stripped || raw;
}

export function formatRegionLabel(region?: string | null): string {
  return stripDecorativePrefix(region) || 'Global';
}

export function getRegionDisplayKind(region?: string | null): RegionDisplayKind {
  const label = formatRegionLabel(region).toLowerCase();
  if (label.includes('personal')) return 'personal';
  if (label.includes('global')) return 'global';
  return 'local';
}
