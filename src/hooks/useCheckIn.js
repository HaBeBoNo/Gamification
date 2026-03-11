import { S, save } from '../state/store';

/**
 * checkIn — registrerar närvaro på ett kalenderevent.
 * Skapar retroaktivt sidequest (40 XP), uppdaterar activity feed
 * och sparar check-in i S.checkIns.
 *
 * @param {string} eventId    - Google Calendar event id
 * @param {string} eventTitle - Evenemangets titel
 * @param {Function} [rerender] - Frivillig callback för att tvinga re-render
 */
export function checkIn(eventId, eventTitle, rerender) {
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

  // Retroaktivt sidequest med XP
  const xp = 40;
  const ts = new Date().toLocaleTimeString('sv-SE', {
    hour: '2-digit', minute: '2-digit',
  });

  S.quests.push({
    id: Date.now() + 1,
    owner: S.me,
    title: `Närvaro: ${eventTitle}`,
    desc: `Checkade in på ${eventTitle}.`,
    cat: 'health',
    xp,
    recur: 'none',
    type: 'standard',
    region: '🇸🇪 Sverige',
    done: true,
    completedAt: Date.now(),
    retroactive: true,
  });

  // XP till member
  S.chars[S.me].xp = (S.chars[S.me].xp || 0) + xp;
  S.chars[S.me].totalXp = (S.chars[S.me].totalXp || 0) + xp;

  // Activity feed
  S.feed.unshift({
    who: S.me,
    action: `checkade in på ${eventTitle} 📍`,
    xp,
    time: ts,
  });

  save();
  rerender?.();
}
