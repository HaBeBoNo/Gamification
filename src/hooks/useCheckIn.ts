import { S, save } from '../state/store';
import { MEMBERS } from '../data/members';
import { awardXP } from './useXP';
import { sendPush } from '../lib/sendPush';

/**
 * checkIn — registrerar närvaro på ett kalenderevent.
 * Skapar retroaktivt sidequest och tilldelar XP via awardXP
 * (som hanterar level-up, streak, stats etc).
 *
 * @param eventId    Google Calendar event id
 * @param eventTitle Evenemangets titel
 */
export function checkIn(eventId: string, eventTitle: string): void {
  // Lazy-init: om store.js ännu inte har checkIns-arrayen
  if (!S.checkIns) S.checkIns = [];

  // Kontrollera att member inte redan checkat in
  const already = S.checkIns.find(
    (c: { eventId: string; member?: string; memberKey?: string; type?: string }) =>
      c.eventId === eventId &&
      c.type !== 'rsvp' &&
      (c.member === S.me || c.memberKey === S.me)
  );
  if (already) return;

  // Spara check-in
  S.checkIns.push({
    id:         Date.now(),
    eventId,
    eventTitle,
    member:     S.me,
    memberKey:  S.me,
    ts:         Date.now(),
  });

  // Retroaktivt sidequest
  const quest = {
    id:          Date.now() + 1,
    owner:       S.me,
    title:       `Närvaro: ${eventTitle}`,
    desc:        `Checkade in på ${eventTitle}.`,
    cat:         'health',
    xp:          40,
    stars:       '',
    recur:       'none' as const,
    type:        'standard',
    region:      '🇸🇪 Sverige',
    done:        false,
    personal:    false,
    completedAt: Date.now(),
    retroactive: true,
  };

  S.quests.push(quest);

  // Tilldela XP via awardXP — hanterar level-up, streak, stats, feed
  // Extra UI-callback-params är valfria och utelämnas avsiktligt här
  void awardXP(quest, 40, null, undefined, undefined, undefined, undefined);

  // Push-notis: kalender-incheckning
  const memberName = MEMBERS[S.me]?.name || S.me;
  sendPush(
    `${memberName} checkade in`,
    `Närvarade på ${eventTitle || 'bandaktivitet'}`,
    S.me,
    '/'
  );

  save();
}
