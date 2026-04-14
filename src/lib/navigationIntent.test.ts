import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildBandHubIntentUrl,
  consumeBandHubIntent,
  consumeBandHubIntentFromUrl,
  queueBandHubIntent,
} from './navigationIntent';

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
  };
}

beforeEach(() => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage,
      sessionStorage,
      location: {
        href: 'https://hq.example/?sek_nav=bandhub&sek_bandhub_tab=kalender&sek_event_id=rep-1&sek_push_open=1',
        origin: 'https://hq.example',
      },
      history: {
        replaceState: (_state: unknown, _title: string, nextUrl: string) => {
          window.location.href = `https://hq.example${nextUrl}`;
        },
      },
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
    configurable: true,
  });
});

describe('navigationIntent', () => {
  it('queues and consumes a bandhub intent with event context', () => {
    queueBandHubIntent({
      tab: 'kalender',
      eventId: 'rep-2',
      source: 'test',
    });

    expect(consumeBandHubIntent()).toMatchObject({
      tab: 'kalender',
      eventId: 'rep-2',
      source: 'test',
    });
    expect(consumeBandHubIntent()).toBeNull();
  });

  it('consumes bandhub intent from url and preserves unrelated params', () => {
    expect(consumeBandHubIntentFromUrl()).toMatchObject({
      tab: 'kalender',
      eventId: 'rep-1',
      source: 'url',
    });
    expect(window.location.href).toContain('sek_push_open=1');
    expect(window.location.href).not.toContain('sek_nav=');
  });

  it('builds a relative url for bandhub deep links', () => {
    expect(buildBandHubIntentUrl({
      tab: 'kalender',
      eventId: 'rep-3',
      source: 'push:calendar_rsvp',
    })).toBe('/?sek_nav=bandhub&sek_bandhub_tab=kalender&sek_event_id=rep-3&sek_nav_source=push%3Acalendar_rsvp');
  });
});
