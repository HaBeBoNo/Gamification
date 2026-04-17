import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    function handleAuthError(event: Event) {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.message) {
        setError(customEvent.detail.message);
      }
    }
    window.addEventListener('sek:auth-error', handleAuthError);
    return () => window.removeEventListener('sek:auth-error', handleAuthError);
  }, []);

  async function handleGoogleLogin() {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://gamification-habebonos-projects.vercel.app',
        scopes: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account consent',
        },
      },
    });
    if (error) {
      setError('Något gick fel med Google-inloggningen.');
    }
  }

  async function handleSendLink() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setError('Något gick fel. Kontrollera din email och försök igen.');
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  // Om supabase inte är konfigurerat — visa felmeddelande
  if (!supabase) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', background: 'var(--color-bg)',
        color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center',
        padding: 24,
      }}>
        Konfigurationsfel — kontakta Hannes.
      </div>
    );
  }

  if (sent) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: '32px 24px',
        background: 'var(--color-bg)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>📬</div>
        <div style={{
          fontSize: 20, fontWeight: 700,
          color: 'var(--color-text)', marginBottom: 12,
        }}>
          Kolla din email
        </div>
        <div style={{
          fontSize: 14, color: 'var(--color-text-muted)',
          maxWidth: 280, lineHeight: 1.6,
        }}>
          Vi skickade en inloggningslänk till <strong>{email}</strong>.
          Klicka på länken för att komma in.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', padding: '32px 24px',
      background: 'var(--color-bg)',
    }}>
      <div style={{
        fontSize: 13, letterSpacing: '0.15em',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-ui)', marginBottom: 8,
      }}>
        SEKTIONEN
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700,
        color: 'var(--color-text)', marginBottom: 4,
      }}>
        HEADQUARTERS
      </div>
      <div style={{
        fontSize: 13, color: 'var(--color-text-muted)',
        marginBottom: 40,
      }}>
        Ange din email för att logga in
      </div>

      <button type="button"
        onClick={handleGoogleLogin}
        style={{
          width: '100%', maxWidth: 320,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'var(--color-text-primary)',
          color: 'var(--color-base)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-pill)',
          padding: '13px', fontSize: 13,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          touchAction: 'manipulation',
          marginBottom: 16,
          boxSizing: 'border-box' as const,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.998 23.998 0 000 24c0 3.77.9 7.35 2.56 10.56l7.97-5.97z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Logga in med Google
      </button>

      <div style={{
        fontSize: 12, color: 'var(--color-text-muted)',
        marginBottom: 16,
      }}>
        eller via e-post
      </div>

      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSendLink()}
        placeholder="din@email.se"
        autoFocus
        style={{
          width: '100%', maxWidth: 320,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text)',
          padding: '14px 16px', fontSize: 15,
          fontFamily: 'var(--font-body)',
          marginBottom: 12, boxSizing: 'border-box' as const,
        }}
      />

      {error && (
        <div style={{
          fontSize: 13, color: '#ff6b6b',
          marginBottom: 12, textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      <button type="button"
        onClick={handleSendLink}
        disabled={!email.trim() || loading}
        style={{
          width: '100%', maxWidth: 320,
          background: email.trim() && !loading
            ? 'var(--color-primary)' : 'var(--color-border)',
          color: email.trim() && !loading
            ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          padding: '14px', fontSize: 13,
          fontFamily: 'var(--font-ui)',
          letterSpacing: '0.08em',
          cursor: email.trim() && !loading ? 'pointer' : 'not-allowed',
          touchAction: 'manipulation',
        }}
      >
        {loading ? 'SKICKAR...' : 'SKICKA INLOGGNINGSLÄNK'}
      </button>
    </div>
  );
}
