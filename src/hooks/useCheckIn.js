import { S, save } from '../state/store';
import { awardXP } from './useXP';

/**
 * checkIn — registrerar närvaro på ett kalenderevent.
 * Skapar retroaktivt sidequest och tilldelar XP via awardXP
 * (som hanterar level-up, streak, stats etc).
 *
 * @param {string} eventId    - Google Calendar event id
 * @param {string} eventTitle - Evenemangets titel
 */
export function checkIn(eventId, eventTitle) {
  // Lazy-init: om store.js ännu inte har checkIns-arrayen
  if (!S.checkIns) S.checkIns = [];

  // Kontrollera att member inte redan checkat in
  const already = S.checkIns.find(
    c => c.eventId === eventId && c.member === S.me
  );
  if (already) return;

  // Spara check-in
  S.checkIns.push({
    id: Date.now(),
    eventId,
    eventTitle,
    member: S.me,
    ts: Date.now(),
  });

  // Retroaktivt sidequest
  const quest = {
    id: Date.now() + 1,
    owner: S.me,
    title: `Närvaro: ${eventTitle}`,
    desc: `Checkade in på ${eventTitle}.`,
    cat: 'health',
    xp: 40,
    recur: 'none',
    type: 'standard',
    region: '🇸🇪 Sverige',
    done: false,
    completedAt: Date.now(),
    retroactive: true,
  };

  S.quests.push(quest);

  // Tilldela XP via awardXP — hanterar level-up, streak, stats, feed
  awardXP(quest, 40, null);

  save();
}
