import { describe, expect, it } from 'vitest';
import { createFeedCommentAction, parseFeedCommentAction } from './feed';
import { resolveFeedIntentItem } from './feedIntent';

describe('feed comment actions', () => {
  it('round-trips comments with quotes and parent ids', () => {
    const action = createFeedCommentAction({
      targetName: 'Hannes',
      contextLabel: 'Operation "POST"',
      comment: 'Bra "tagning" och snyggt avslut.',
      parentFeedItemId: 'feed-123',
    });

    const parsed = parseFeedCommentAction(action);

    expect(parsed).toMatchObject({
      targetName: 'Hannes',
      contextLabel: 'Operation "POST"',
      comment: 'Bra "tagning" och snyggt avslut.',
      parentFeedItemId: 'feed-123',
    });
  });

  it('still parses legacy comment actions', () => {
    const parsed = parseFeedCommentAction('kommenterade Hannes aktivitet: "Snyggt jobbat"');

    expect(parsed).toMatchObject({
      targetName: 'Hannes',
      contextLabel: 'aktivitet',
      comment: 'Snyggt jobbat',
      parentFeedItemId: null,
    });
  });
});

describe('feed intents', () => {
  it('falls back to owner/context matching when feed item id is missing', () => {
    const items = [
      { id: '1', who: 'hannes', action: 'slutförde "Demo" (+40 XP)' },
      { id: '2', who: 'martin', action: 'slutförde "Annat" (+30 XP)' },
    ];

    const resolved = resolveFeedIntentItem({
      id: 'intent-1',
      createdAt: Date.now(),
      mode: 'reply',
      feedItemId: 'missing',
      ownerKey: 'hannes',
      contextLabel: 'Demo',
    }, items);

    expect(resolved?.id).toBe('1');
  });
});
