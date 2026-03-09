import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (localStorage.getItem('hq-install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS fallback: show banner if standalone not detected
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
      setTimeout(() => setShow(true), 2000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem('hq-install-dismissed', '1');
  }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    }
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="install-banner">
      <Download size={18} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
      <div className="install-banner-text">
        <strong>Installera HQ</strong>
        <span>Lägg till appen på hemskärmen</span>
      </div>
      {deferredPrompt ? (
        <button className="install-banner-btn" onClick={handleInstall}>INSTALLERA</button>
      ) : (
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', maxWidth: 120 }}>
          Dela → Lägg till på hemskärmen
        </span>
      )}
      <button className="install-banner-close" onClick={dismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
