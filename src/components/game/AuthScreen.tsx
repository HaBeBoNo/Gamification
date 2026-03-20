import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogleLogin() {
    if (!supabase) {
      setError('Konfigurationsfel — kontakta Hannes.');
      return;
    }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      setError('Inloggning misslyckades. Försök igen.');
      setLoading(false);
    }
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
        Logga in med ditt Google-konto
      </div>

      {error && (
        <div style={{
          fontSize: 13, color: '#ff6b6b',
          marginBottom: 12, textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: '100%', maxWidth: 320,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10,
          background: loading ? 'var(--color-border)' : 'var(--color-surface)',
          color: loading ? 'var(--color-text-muted)' : 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-pill)',
          padding: '14px', fontSize: 13,
          fontFamily: 'var(--font-ui)',
          letterSpacing: '0.08em',
          cursor: loading ? 'not-allowed' : 'pointer',
          touchAction: 'manipulation',
        }}
      >
        {!loading && (
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
        )}
        {loading ? 'LOGGAR IN...' : 'LOGGA IN MED GOOGLE'}
      </button>
    </div>
  );
}
