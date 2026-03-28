import { useCallback } from 'react';

const LONG_PRESS_DURATION = 2000; // ms

/**
 * useLongPress — returnerar en ref-callback som fäster long-press-lyssnare
 * på det angivna DOM-elementet.
 *
 * @param onLongPress  Callback som anropas när long-press triggas
 * @param enabled      Om false, monteras inga lyssnare (t.ex. !isAdmin)
 */
export function useLongPress(
  onLongPress: () => void,
  enabled: boolean,
): (node: HTMLElement | null) => void {
  return useCallback(
    (node: HTMLElement | null) => {
      if (!node || !enabled) return;

      let timer: ReturnType<typeof setTimeout>;
      const start  = () => { timer = setTimeout(onLongPress, LONG_PRESS_DURATION); };
      const cancel = () => clearTimeout(timer);

      node.addEventListener('touchstart',  start,  { passive: true });
      node.addEventListener('touchend',    cancel);
      node.addEventListener('touchcancel', cancel);

      // React callback refs do not support cleanup return values in all cases,
      // so we store cleanup on the node itself to be safe.
      (node as any)._longPressCleanup = () => {
        node.removeEventListener('touchstart',  start);
        node.removeEventListener('touchend',    cancel);
        node.removeEventListener('touchcancel', cancel);
      };
    },
    [onLongPress, enabled],
  );
}
