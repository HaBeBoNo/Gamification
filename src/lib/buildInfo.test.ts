import { describe, expect, it } from 'vitest';
import { formatBuildLabel, formatBuildStamp } from './buildInfo';

describe('buildInfo', () => {
  it('formats readable build labels from iso timestamps', () => {
    const label = formatBuildLabel('2026-04-14T21:11:00.000Z');
    expect(label).toContain('apr');
    expect(label).toContain('14');
  });

  it('combines commit and build label into one stamp', () => {
    expect(formatBuildStamp('17fea55', '2026-04-14T21:11:00.000Z')).toMatch(/^17fea55 · /);
  });

  it('falls back to the raw value when the build time is unknown', () => {
    expect(formatBuildStamp('', 'okänd')).toBe('okänd');
  });
});
