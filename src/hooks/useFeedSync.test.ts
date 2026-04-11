import { beforeEach, describe, expect, it } from 'vitest';
import { resolveFeedCreatedAt } from './useFeedSync';
import { useGameStore } from '@/state/store';

describe('feed store slice', () => {
  beforeEach(() => {
    useGameStore.getState().setFeed([]);
  });

  it('notifies subscribers immediately when a feed entry is appended', () => {
    let observedFeedLength = 0;
    const unsubscribe = useGameStore.subscribe((state) => {
      observedFeedLength = state.feed.length;
    });

    useGameStore.getState().appendFeedEntry({
      who: 'niklas',
      action: 'gav en signal',
      xp: 0,
      ts: '2026-04-11T10:00:00.000Z',
      syncId: 'feed_1712829600000_demo',
    });

    unsubscribe();

    expect(observedFeedLength).toBe(1);
    expect(useGameStore.getState().feed).toHaveLength(1);
  });
});

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
