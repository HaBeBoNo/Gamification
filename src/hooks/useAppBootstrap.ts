import { useEffect } from 'react';
import { useFeedSync } from '@/hooks/useFeedSync';
import { useSocialNotifications } from '@/hooks/useSocialNotifications';
import { usePresenceSync } from '@/hooks/usePresenceSync';
import { useSupabaseData } from '@/hooks/useAuth';
import { ensurePushRegistration } from '@/lib/webPush';

export function useAppBootstrap(currentSurface: string, memberKey: string | null) {
  useFeedSync();
  useSocialNotifications();
  usePresenceSync(currentSurface);
  useSupabaseData(memberKey);

  useEffect(() => {
    if (!memberKey || typeof document === 'undefined' || typeof window === 'undefined') return;
    const currentMemberKey = memberKey;

    void ensurePushRegistration(currentMemberKey, {
      promptIfNeeded: false,
      reason: 'bootstrap',
    });

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      void ensurePushRegistration(currentMemberKey, {
        promptIfNeeded: false,
        reason: 'resume',
      });
    }

    function handleOnline() {
      void ensurePushRegistration(currentMemberKey, {
        promptIfNeeded: false,
        reason: 'online',
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [memberKey]);
}
