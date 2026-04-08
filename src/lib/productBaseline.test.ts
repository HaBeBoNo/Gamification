import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearBaselineSession,
  getProductBaselineSnapshot,
  recordAppOpenOncePerSession,
  recordSocialResponseLatencies,
} from './productBaseline';

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

beforeEach(() => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage,
      sessionStorage,
      location: { href: 'https://hq.example/' },
      history: { replaceState: () => undefined },
    },
    configurable: true,
  });
});

describe('productBaseline', () => {
  it('records app opens only once per session for a member', () => {
    recordAppOpenOncePerSession({ memberKey: 'hannes', source: 'direct', path: '/' });
    recordAppOpenOncePerSession({ memberKey: 'hannes', source: 'push', path: '/quests' });

    const snapshot = getProductBaselineSnapshot('hannes');
    expect(snapshot.appOpens).toHaveLength(1);
    expect(snapshot.appOpens[0]).toMatchObject({
      memberKey: 'hannes',
      source: 'direct',
      path: '/',
    });

    clearBaselineSession('hannes');
    recordAppOpenOncePerSession({ memberKey: 'hannes', source: 'push', path: '/quests' });

    expect(getProductBaselineSnapshot('hannes').appOpens).toHaveLength(2);
  });

  it('stores only the first social response latency per feed item', () => {
    recordSocialResponseLatencies('hannes', [
      {
        feedItemId: 'feed-1',
        responseType: 'feed_comment',
        actionTs: 1000,
        responseTs: 2000,
      },
    ]);

    recordSocialResponseLatencies('hannes', [
      {
        feedItemId: 'feed-1',
        responseType: 'feed_reaction',
        actionTs: 1000,
        responseTs: 2500,
      },
      {
        feedItemId: 'feed-2',
        responseType: 'feed_witness',
        actionTs: 3000,
        responseTs: 5000,
      },
    ]);

    const snapshot = getProductBaselineSnapshot('hannes');
    expect(snapshot.socialResponseLatencies).toHaveLength(2);
    expect(snapshot.socialResponseLatencies.find((sample) => sample.feedItemId === 'feed-1')?.latencyMs).toBe(1000);
    expect(snapshot.socialResponseLatencies.find((sample) => sample.feedItemId === 'feed-2')?.latencyMs).toBe(2000);
  });
});
