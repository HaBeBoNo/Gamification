import { describe, expect, it } from 'vitest';
import { resolveFeedCreatedAt } from './useFeedSync';

describe('resolveFeedCreatedAt', () => {
  it('prefers explicit timestamps when present', () => {
    expect(resolveFeedCreatedAt({
      ts: '2026-04-06T12:34:56.000Z',
      syncId: 'feed_1712400000000_demo',
    })).toBe('2026-04-06T12:34:56.000Z');
  });

  it('derives a stable timestamp from sync ids when feed item lacks ts', () => {
    expect(resolveFeedCreatedAt({
      syncId: 'feed_1712400000000_demo',
    })).toBe(new Date(1712400000000).toISOString());
  });

  it('falls back to epoch when the item has no stable time identity', () => {
    expect(resolveFeedCreatedAt({
      action: 'saknar tid',
    })).toBe(new Date(0).toISOString());
  });
});
