import type { HomeAttentionSurfaceState } from '@/hooks/useHomeSurface';
import { HeroCard } from '@/components/game/home/HeroCard';
import { BandStatusRow } from '@/components/game/home/BandStatusRow';
import { DailyCoachCard } from '@/components/game/home/DailyCoachCard';
import { ReengagementCard } from '@/components/game/home/ReengagementCard';
import { WaitingOnYouCard } from '@/components/game/home/WaitingOnYouCard';
import { HomeBandEcho } from '@/components/game/home/HomeBandEcho';
import { SECTION_GAP } from '@/components/game/home/constants';

interface HomeScreenProps {
  rerender: () => void;
  onMetricClick?: () => void;
  onNavigate?: (tab: string) => void;
  onOpenCoach?: (initialMessage?: string) => void;
  onOpenNotifications?: () => void;
  attentionSurface?: HomeAttentionSurfaceState;
}

export function HomeScreen({
  onNavigate,
  onOpenCoach,
  onOpenNotifications,
  attentionSurface,
}: HomeScreenProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: SECTION_GAP,
      paddingBottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-xl))',
    }}>
      <HeroCard />
      <BandStatusRow />
      <DailyCoachCard onNavigate={onNavigate} onOpenCoach={onOpenCoach} />
      <ReengagementCard
        onNavigate={onNavigate}
        onOpenCoach={onOpenCoach}
        onOpenNotifications={onOpenNotifications}
      />
      <WaitingOnYouCard
        onNavigate={onNavigate}
        onOpenNotifications={onOpenNotifications}
        onOpenCoach={onOpenCoach}
        surface={attentionSurface}
      />
      <HomeBandEcho onNavigate={onNavigate} />
    </div>
  );
}

export default HomeScreen;
