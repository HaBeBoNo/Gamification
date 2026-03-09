import React, { useState } from 'react';
import { S } from '@/state/store';
import { Home, Compass, Bot, Activity, User, Lightbulb } from 'lucide-react';

import Onboarding from '@/components/game/Onboarding';
import Topbar from '@/components/game/Topbar';
import MetricsBar from '@/components/game/MetricsBar';
import QuestGrid from '@/components/game/QuestGrid';
import Scoreboard from '@/components/game/Scoreboard';
import Leaderboard from '@/components/game/Leaderboard';
import ActivityFeed from '@/components/game/ActivityFeed';
import AICoach from '@/components/game/AICoach';
import AdminPanel from '@/components/game/AdminPanel';
import InstallPrompt from '@/components/game/InstallPrompt';
import OfflineBanner from '@/components/game/OfflineBanner';
import NetworkToast from '@/components/game/NetworkToast';

import LevelUpOverlay from '@/components/game/overlays/LevelUpOverlay';
import RewardOverlay from '@/components/game/overlays/RewardOverlay';
import MetricsModal from '@/components/game/overlays/MetricsModal';
import RefreshOverlay from '@/components/game/overlays/RefreshOverlay';
import SidequestNudge from '@/components/game/overlays/SidequestNudge';

const TABS_BASE = [
  { id: 'home', icon: Home },
  { id: 'quests', icon: Compass },
  { id: 'coach', icon: Bot },
  { id: 'activity', icon: Activity },
  { id: 'profile', icon: User },
];

const TABS_CARL = [
  { id: 'home', icon: Home },
  { id: 'quests', icon: Compass },
  { id: 'coach', icon: Bot },
  { id: 'activity', icon: Activity },
  { id: 'ideas', icon: Lightbulb },
  { id: 'profile', icon: User },
];

export default function Index() {
  const [tick, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);

  const [activeTab, setActiveTab] = useState('quests');
  const [mobileTab, setMobileTab] = useState('home');

  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [reward, setReward] = useState<{ reward: any; tier?: string } | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [sidequestNudge, setSidequestNudge] = useState<any[] | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  function showLU(level: number) { setLevelUp(level); }
  function showRW(rw: any, tier?: string) { setReward({ reward: rw, tier }); }

  if (!S.onboarded) {
    return <Onboarding rerender={rerender} />;
  }

  const isCurl = S.me === 'carl';
  const tabs = isCurl ? TABS_CARL : TABS_BASE;

  return (
    <div className="app-shell">
      <OfflineBanner />
      <InstallPrompt />
      <NetworkToast />
      <Topbar
        rerender={rerender}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdmin={() => setShowAdmin(true)}
      />
      <MetricsBar onMetricClick={() => setShowMetrics(true)} rerender={rerender} />

      <div className="body-grid">
        <div className="sidebar-l">
          <div className="stagger-1"><Leaderboard /></div>
          <div className="stagger-2"><AICoach rerender={rerender} /></div>
        </div>

        <div className="quest-center-wrapper stagger-1">
          {activeTab === 'quests' && (
            <QuestGrid
              rerender={rerender}
              showLU={showLU}
              showRW={showRW}
              showSidequestNudge={(quests: any[]) => setSidequestNudge(quests)}
            />
          )}
          {activeTab === 'scoreboard' && <Scoreboard />}
        </div>

        <div className="sidebar-r">
          <div className="stagger-2"><ActivityFeed /></div>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="bottom-tab-bar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`bottom-tab-bar-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setMobileTab(tab.id);
                if (tab.id === 'home' || tab.id === 'quests') setActiveTab('quests');
                if (tab.id === 'profile') setActiveTab('scoreboard');
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            </button>
          );
        })}
      </div>

      {levelUp && (
        <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
      )}
      {reward && (
        <RewardOverlay
          reward={reward.reward}
          tier={reward.tier}
          onClose={() => setReward(null)}
        />
      )}
      {showMetrics && (
        <MetricsModal
          onClose={() => setShowMetrics(false)}
          rerender={rerender}
        />
      )}
      {refreshMsg && (
        <RefreshOverlay message={refreshMsg} />
      )}
      {sidequestNudge && (
        <SidequestNudge
          quests={sidequestNudge}
          onClose={() => setSidequestNudge(null)}
          rerender={rerender}
        />
      )}
      {showAdmin && (
        <AdminPanel
          rerender={rerender}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
