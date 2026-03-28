import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * useFocusTrap — fångar tangentbordsfokus inom ett givet element.
 *
 * Returnerar en ref att fästa på modal-containern.
 * När modalen öppnas (active=true) fångas Tab och Shift+Tab inuti containern,
 * och fokus återgår till det element som var fokuserat innan modalen öppnades.
 *
 * @param active  Om true aktiveras trappan (t.ex. när modalen är synlig)
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Remember what was focused before modal opened
    previousFocus.current = document.activeElement as HTMLElement;

    // Focus first focusable element in modal
    const focusables = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const nodeList    = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const focusableEls: HTMLElement[] = Array.from(nodeList);
      if (focusableEls.length === 0) return;

      const first = focusableEls[0] as HTMLElement;
      const last  = focusableEls[focusableEls.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus to previous element on unmount
      previousFocus.current?.focus();
    };
  }, [active]);

  return containerRef;
}
