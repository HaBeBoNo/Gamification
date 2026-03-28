import { useRef, useCallback, type TouchEvent } from 'react';

const SWIPE_TAB_IDS = ['quests', 'skilltree', 'leaderboard', 'bandhub'];
const MIN_DELTA_PX  = 50;    // px horizontal movement to trigger swipe
const MIN_VELOCITY  = 0.3;   // px/ms velocity threshold

/**
 * useSwipeNavigation — hanterar horisontella svep-gester för fliknavigering.
 *
 * @param activeTab   Aktuell aktiv flik (används för att räkna ut riktning)
 * @param onTabChange Callback som anropas med nästa/föregående flik-id
 */
export function useSwipeNavigation(
  activeTab: string,
  onTabChange: (tabId: string) => void,
) {
  const touchStartX    = useRef(0);
  const touchStartY    = useRef(0);
  const touchStartTime = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    touchStartX.current    = e.touches[0].clientX;
    touchStartY.current    = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent<HTMLElement>) => {
    const deltaX   = touchStartX.current - e.changedTouches[0].clientX;
    const deltaY   = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    const elapsed  = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaX) / elapsed;

    const currentIndex = SWIPE_TAB_IDS.indexOf(activeTab);
    if (currentIndex === -1) return;

    // Ignore vertical-dominant swipes
    if (deltaY > Math.abs(deltaX)) return;

    if (Math.abs(deltaX) > MIN_DELTA_PX || velocity > MIN_VELOCITY) {
      if (deltaX > 0 && currentIndex < SWIPE_TAB_IDS.length - 1) {
        onTabChange(SWIPE_TAB_IDS[currentIndex + 1]);
      } else if (deltaX < 0 && currentIndex > 0) {
        onTabChange(SWIPE_TAB_IDS[currentIndex - 1]);
      }
    }
  }, [activeTab, onTabChange]);

  return { handleTouchStart, handleTouchEnd };
}
