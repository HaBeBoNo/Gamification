import { describe, expect, it } from 'vitest';
import {
  createFeedCommentAction,
  getCommentActionTargetName,
  getCommentNotificationTargets,
  getFeedCommentMeta,
  parseFeedCommentAction,
} from './feed';
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

  it('prefers structured comment fields when available', () => {
    const parsed = getFeedCommentMeta({
      interaction_type: 'comment',
      parent_feed_item_id: 'feed-42',
      context_label: 'Demo',
      comment_body: 'Vi har en tydlig refräng här.',
      target_member_key: 'hannes',
      metadata: { targetMemberName: 'Hannes' },
    });

    expect(parsed).toMatchObject({
      targetName: 'Hannes',
      targetKey: 'hannes',
      contextLabel: 'Demo',
      comment: 'Vi har en tydlig refräng här.',
      parentFeedItemId: 'feed-42',
    });
  });

  it('targets both owner and reply target for comment signals', () => {
    const targets = getCommentNotificationTargets({
      actorKey: 'hannes',
      ownerKey: 'ludvig',
      replyTargetKey: 'niklas',
    });

    expect(targets).toEqual(['ludvig', 'niklas']);
  });

  it('falls back to reply target name for comment actions when replying in a thread', () => {
    expect(getCommentActionTargetName({
      ownerName: 'Ludvig',
      replyTargetName: 'Niklas',
    })).toBe('Niklas');
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

  it('ignores structured comment rows when resolving owner/context fallback', () => {
    const items = [
      {
        id: 'comment-1',
        who: 'martin',
        interaction_type: 'comment',
        comment_body: 'Bra steg.',
        target_member_key: 'hannes',
        context_label: 'Demo',
      },
      { id: 'feed-1', who: 'hannes', action: 'slutförde "Demo" (+40 XP)' },
    ];

    const resolved = resolveFeedIntentItem({
      id: 'intent-2',
      createdAt: Date.now(),
      mode: 'focus',
      ownerKey: 'hannes',
      contextLabel: 'Demo',
    }, items);

    expect(resolved?.id).toBe('feed-1');
  });
});
