import { S, save } from '../state/store';
import { awardXP } from './useXP';
import { MEMBERS } from '@/data/members';
import { getBandmateKeys, notifyMembersSignal } from '@/lib/notificationSignals';
import { addCalendarPresenceCheckIn } from '@/lib/calendarState';

/**
 * checkIn — registrerar närvaro på ett kalenderevent.
 * Skapar retroaktivt sidequest och tilldelar XP via awardXP
 * (som hanterar level-up, streak, stats etc).
 *
 * @param eventId    Google Calendar event id
 * @param eventTitle Evenemangets titel
 */
export async function checkIn(eventId: string, eventTitle: string): Promise<void> {
  if (!S.me) return;

  const nextCheckIns = addCalendarPresenceCheckIn(S.checkIns, {
    id: Date.now(),
    eventId,
    eventTitle,
    memberKey: S.me,
    ts: Date.now(),
  });
  if (nextCheckIns.length === S.checkIns.length) return;
  S.checkIns = nextCheckIns;

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

  save();

  const memberName = (MEMBERS as Record<string, { name?: string }>)[S.me]?.name || S.me;
  await notifyMembersSignal({
    targetMemberKeys: getBandmateKeys(S.me),
    type: 'calendar_check_in',
    title: `${memberName} checkade in`,
    body: eventTitle,
    dedupeKey: `calendar-check-in:${S.me}:${eventId}`,
    payload: {
      memberId: S.me,
      eventId,
      eventTitle,
    },
    push: {
      title: '📍 Någon är på plats',
      body: `${memberName} checkade in på ${eventTitle}`,
      excludeMember: S.me,
      url: '/',
    },
  });
}
