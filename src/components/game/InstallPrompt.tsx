import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'sektionen_install_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Platform = 'android-native' | 'android-fallback' | 'ios' | 'hidden';

function getPlatform(deferredPrompt: Event | null): Platform {
  // Already running as installed PWA — don't show
  if (window.matchMedia('(display-mode: standalone)').matches) return 'hidden';
  // navigator.standalone covers iOS home-screen launch
  if ((navigator as any).standalone) return 'hidden';

  if (deferredPrompt) return 'android-native';

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  if (isIOS) return 'ios';

  // Android/Chrome without beforeinstallprompt (already installed, or not eligible)
  const isAndroid = /android/.test(ua);
  const isChrome  = /chrome/.test(ua) && !/edg/.test(ua);
  if (isAndroid && isChrome) return 'android-fallback';

  return 'hidden';
}

function wasDismissedRecently(): boolean {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [platform, setPlatform] = useState<Platform>('hidden');

  useEffect(() => {
    if (wasDismissedRecently()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const p = getPlatform(e);
      if (p !== 'hidden') {
        setPlatform(p);
        setShow(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect iOS / Android-fallback after a short delay (UA check)
    const timer = setTimeout(() => {
      if (wasDismissedRecently()) return;
      const p = getPlatform(null);
      if (p !== 'hidden') {
        setPlatform(p);
        setShow(true);
      }
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  async function handleInstall() {
    if (deferredPrompt) {
      (deferredPrompt as any).prompt();
      await (deferredPrompt as any).userChoice;
    }
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="install-banner">
      {platform === 'ios' ? (
        <Share size={18} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
      ) : (
        <Download size={18} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
      )}

      <div className="install-banner-text">
        <strong>Installera Sektionen</strong>
        {platform === 'android-native' && (
          <span>Lägg till appen på hemskärmen</span>
        )}
        {platform === 'android-fallback' && (
          <span>Tryck på Meny (⋮) och välj "Lägg till på startskärmen"</span>
        )}
        {platform === 'ios' && (
          <span>Tryck på dela-ikonen och välj "Lägg till på hemskärmen"</span>
        )}
      </div>

      {platform === 'android-native' ? (
        <button className="install-banner-btn" onClick={handleInstall}>
          INSTALLERA
        </button>
      ) : null}

      <button className="install-banner-close" onClick={dismiss} aria-label="Stäng">
        <X size={16} />
      </button>
    </div>
  );
}
