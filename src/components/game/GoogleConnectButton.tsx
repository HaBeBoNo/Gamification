/**
 * GoogleConnectButton.tsx
 * OAuth2 connect/disconnect button using @react-oauth/google.
 * Shows user avatar + name when authenticated, Google login button when not.
 */

import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { LogOut } from 'lucide-react';
import {
  GOOGLE_SCOPES,
  handleTokenResponse,
  signOut,
  loadToken,
  GoogleTokenData,
} from '../../lib/googleAuth';

interface GoogleConnectButtonProps {
  /** Called after successful sign-in with the persisted token data */
  onConnect?: (token: GoogleTokenData) => void;
  /** Called after sign-out */
  onDisconnect?: () => void;
  /** Current token data (controlled from parent) */
  tokenData?: GoogleTokenData | null;
}

/* ── Google G logo SVG ── */
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.998 23.998 0 000 24c0 3.77.9 7.35 2.56 10.56l7.97-5.97z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function GoogleConnectButton({
  onConnect,
  onDisconnect,
  tokenData,
}: GoogleConnectButtonProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const login = useGoogleLogin({
    scope: GOOGLE_SCOPES,
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const data = await handleTokenResponse(
          tokenResponse.access_token,
          tokenResponse.expires_in ?? 3600
        );
        onConnect?.(data);
      } catch (e) {
        setError('Kunde inte hämta användarinfo.');
        console.error('Google login error:', e);
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      setError('Inloggning misslyckades.');
      console.error('Google OAuth error:', err);
    },
  });

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      onDisconnect?.();
    } finally {
      setLoading(false);
    }
  };

  // ── Authenticated state ──
  if (tokenData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {tokenData.user_picture ? (
          <img
            src={tokenData.user_picture}
            alt={tokenData.user_name ?? 'Google-konto'}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid var(--color-primary)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-caption)',
            color: 'var(--color-surface)',
            fontWeight: 700,
          }}>
            {(tokenData.user_name ?? 'G')[0].toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-primary)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 120,
          }}>
            {tokenData.user_name ?? tokenData.user_email ?? 'Google'}
          </div>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
            Ansluten
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={loading}
          style={{
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 'var(--text-micro)',
          }}
        >
          <LogOut size={12} />
          {loading ? '...' : 'Logga ut'}
        </button>
      </div>
    );
  }

  // ── Unauthenticated state ──
  return (
    <div>
      <button
        className="bh-connect-btn"
        onClick={() => login()}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}
      >
        <GoogleLogo size={16} />
        {loading ? 'Ansluter...' : 'Anslut Google'}
      </button>
      {error && (
        <div style={{
          fontSize: 'var(--text-micro)',
          color: 'var(--color-red, #e05040)',
          marginTop: 4,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
