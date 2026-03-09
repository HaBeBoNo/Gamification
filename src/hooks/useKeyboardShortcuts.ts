import { useEffect, useState, useCallback } from 'react';

interface ShortcutHandlers {
  setMobileTab?: (tab: string) => void;
  setActiveTab?: (tab: string) => void;
  setShowCmd?: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowShortcuts?: (v: boolean) => void;
  closeAll?: () => void;
  isCurl?: boolean;
}

export const SHORTCUTS = [
  { key: 'H', desc: 'Hem' },
  { key: 'Q', desc: 'Uppdrag' },
  { key: 'C', desc: 'Coach' },
  { key: 'A', desc: 'Aktivitet' },
  { key: 'P', desc: 'Profil' },
  { key: 'I', desc: 'Idéer (Carl)' },
  { key: '?', desc: 'Visa kortkommandon' },
  { key: 'Esc', desc: 'Stäng panel/modal' },
  { key: '⌘K', desc: 'Kommandopalett' },
];

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const [showHints, setShowHints] = useState(false);
  const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === '?') {
      e.preventDefault();
      setShowShortcutsOverlay(v => !v);
      return;
    }

    if (e.key === 'Escape') {
      setShowShortcutsOverlay(false);
      setShowHints(false);
      handlers.closeAll?.();
      return;
    }

    const key = e.key.toUpperCase();
    switch (key) {
      case 'H':
        handlers.setMobileTab?.('home');
        handlers.setActiveTab?.('quests');
        break;
      case 'Q':
        handlers.setMobileTab?.('quests');
        handlers.setActiveTab?.('quests');
        break;
      case 'C':
        handlers.setMobileTab?.('coach');
        break;
      case 'A':
        handlers.setMobileTab?.('activity');
        break;
      case 'P':
        handlers.setMobileTab?.('profile');
        handlers.setActiveTab?.('scoreboard');
        break;
      case 'I':
        if (handlers.isCurl) handlers.setMobileTab?.('ideas');
        break;
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return { showHints, showShortcutsOverlay, setShowShortcutsOverlay };
}
