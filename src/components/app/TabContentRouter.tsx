import React, { Suspense, lazy } from 'react';
import { HomeScreen } from '@/components/game/HomeScreen';
import QuestGrid from '@/components/game/QuestGrid';
import Scoreboard from '@/components/game/Scoreboard';
import LeaderboardView from '@/components/game/LeaderboardView';
import ActivityFeed from '@/components/game/ActivityFeed';
import CoachChat from '@/components/game/CoachChat';
import IdeasView from '@/components/game/IdeasView';
import QuestHistory from '@/components/game/QuestHistory';
import SeasonView from '@/components/game/SeasonView';
import ProfileView from '@/components/game/ProfileView';

const BandHub = lazy(() => import('@/components/game/BandHub'));

const BandHubFallback = (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    padding: 'var(--space-3xl)',
    color: 'var(--color-text-muted)',
    fontSize: 'var(--text-caption)',
  }}>
    Laddar Band Hub…
  </div>
);

type TabContentRouterProps = {
  activeView: 'home' | 'tab';
  tab: string;
  rerender: () => void;
  showLU: (level: number) => void;
  showRW: (reward: any, tier?: string) => void;
  showXP: (amount: number) => void;
  showSidequestNudge: ((quests: any[]) => void) | undefined;
  onQuestTap: (quest: any) => void;
  onOpenCoach: (message?: string) => void;
  onMetricClick: () => void;
  onNavigate: (tabId: string) => void;
  onOpenNotifications: () => void;
};

export function TabContentRouter({
  activeView,
  tab,
  rerender,
  showLU,
  showRW,
  showXP,
  showSidequestNudge,
  onQuestTap,
  onOpenCoach,
  onMetricClick,
  onNavigate,
  onOpenNotifications,
}: TabContentRouterProps) {
  if (activeView === 'home') {
    return (
      <HomeScreen
        rerender={rerender}
        onMetricClick={onMetricClick}
        onNavigate={onNavigate}
        onOpenCoach={onOpenCoach}
        onOpenNotifications={onOpenNotifications}
      />
    );
  }

  switch (tab) {
    case 'quests':
      return (
        <QuestGrid
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
          showSidequestNudge={showSidequestNudge}
          onQuestTap={onQuestTap}
          onOpenCoach={onOpenCoach}
        />
      );
    case 'skilltree':
      return <Scoreboard />;
    case 'leaderboard':
      return <LeaderboardView />;
    case 'coach':
      return <CoachChat rerender={rerender} />;
    case 'activity':
      return <ActivityFeed />;
    case 'ideas':
      return <IdeasView onOpenCoach={onOpenCoach} onNavigate={onNavigate} />;
    case 'bandhub':
      return <Suspense fallback={BandHubFallback}><BandHub /></Suspense>;
    case 'profile':
      return <ProfileView />;
    case 'history':
      return <QuestHistory />;
    case 'season':
      return <div style={{ padding: 'var(--space-lg)' }}><SeasonView /></div>;
    default:
      return (
        <QuestGrid
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
          showSidequestNudge={showSidequestNudge}
          onQuestTap={onQuestTap}
          onOpenCoach={onOpenCoach}
        />
      );
  }
}
