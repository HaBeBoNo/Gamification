import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

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

      <button
        onClick={handleSendLink}
        disabled={!email.trim() || loading}
        style={{
          width: '100%', maxWidth: 320,
          background: email.trim() && !loading
            ? 'var(--color-primary)' : 'var(--color-border)',
          color: email.trim() && !loading
            ? '#fff' : 'var(--color-text-muted)',
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
