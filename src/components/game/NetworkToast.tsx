import React, { useEffect, useState, useCallback } from 'react';
import { WifiOff } from 'lucide-react';
import { RUNTIME_ISSUE_EVENT } from '@/lib/runtimeHealth';

interface ToastItem {
  id: number;
  message: string;
}

let showToastFn: ((msg: string) => void) | null = null;

export function showNetworkToast(msg = 'HQ tappade kontakten — försöker igen...') {
  showToastFn?.(msg);
}

export default function NetworkToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts(prev => {
      if (prev.length > 0 && prev[prev.length - 1].message === message) return prev;
      return [...prev, { id, message }];
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    showToastFn = addToast;
    return () => { showToastFn = null; };
  }, [addToast]);

  // Listen for failed fetches globally
  useEffect(() => {
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await origFetch(...args);
        if (!res.ok && res.status >= 500) {
          addToast('HQ tappade kontakten — försöker igen...');
        }
        return res;
      } catch (err) {
        addToast('HQ tappade kontakten — försöker igen...');
        throw err;
      }
    };
    return () => { window.fetch = origFetch; };
  }, [addToast]);

  // Listen for Supabase sync failures
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addToast(detail?.message || 'Synkronisering misslyckades');
    };
    window.addEventListener('sek:sync-error', handler);
    return () => window.removeEventListener('sek:sync-error', handler);
  }, [addToast]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.toast) return;
      addToast(detail?.issue?.message || 'En funktion kor i reservlage');
    };
    window.addEventListener(RUNTIME_ISSUE_EVENT, handler);
    return () => window.removeEventListener(RUNTIME_ISSUE_EVENT, handler);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="network-toast-container">
      {toasts.map(t => (
        <div key={t.id} className="network-toast">
          <WifiOff size={14} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
