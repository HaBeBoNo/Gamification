import React from 'react';
import Onboarding from '@/components/game/Onboarding';
import AuthScreen from '@/components/game/AuthScreen';

type AuthGateProps = {
  synced: boolean;
  user: any;
  shouldOnboard: boolean;
  rerender: () => void;
  children: React.ReactNode;
};

export function AuthGate({
  synced,
  user,
  shouldOnboard,
  rerender,
  children,
}: AuthGateProps) {
  if (!synced) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-caption)',
        fontFamily: 'var(--font-ui)',
        letterSpacing: '0.1em',
      }}>
        SEKTIONEN HQ
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (shouldOnboard) return <Onboarding rerender={rerender} />;

  return <>{children}</>;
}
