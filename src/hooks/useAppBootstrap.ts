import { useFeedSync } from '@/hooks/useFeedSync';
import { useSocialNotifications } from '@/hooks/useSocialNotifications';
import { usePresenceSync } from '@/hooks/usePresenceSync';
import { useSupabaseData } from '@/hooks/useAuth';

export function useAppBootstrap(currentSurface: string, memberKey: string | null) {
  useFeedSync();
  useSocialNotifications();
  usePresenceSync(currentSurface);
  useSupabaseData(memberKey);
}
