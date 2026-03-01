import React, { useState } from 'react';
import { S } from './state/store';

import Onboarding from './components/Onboarding';
import Topbar from './components/Topbar';
import MetricsBar from './components/MetricsBar';
import QuestGrid from './components/QuestGrid';
import Leaderboard from './components/Leaderboard';
import Scoreboard from './components/Scoreboard';
import ActivityFeed from './components/ActivityFeed';
import AICoach from './components/AICoach';
import AdminPanel from './components/AdminPanel';

import LevelUpOverlay from './components/overlays/LevelUpOverlay';
import RewardOverlay from './components/overlays/RewardOverlay';
import MetricsModal from './components/overlays/MetricsModal';
import RefreshOverlay from './components/overlays/RefreshOverlay';
import SidequestNudge from './components/overlays/SidequestNudge';

export default function App() {
  const [tick, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);

  // Active tab: 'quests' | 'scoreboard'
  const [activeTab, setActiveTab] = useState('quests');

  // Overlays
  const [levelUp, setLevelUp] = useState(null);          // level number
  const [reward, setReward] = useState(null);            // { reward, tier }
  const [showMetrics, setShowMetrics] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [sidequestNudge, setSidequestNudge] = useState(null); // quests array
  const [showAdmin, setShowAdmin] = useState(false);

  function showLU(level) { setLevelUp(level); }
  function showRW(rw, tier) { setReward({ reward: rw, tier }); }

  if (!S.onboarded) {
    return <Onboarding rerender={rerender} />;
  }

  return (
    <div className="app-shell">
      <Topbar
        rerender={rerender}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdmin={() => setShowAdmin(true)}
      />
      <MetricsBar onMetricClick={() => setShowMetrics(true)} rerender={rerender} />

      <div className="body-grid">
        {/* Sidebar left */}
        <div className="sidebar-l" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Leaderboard />
          <AICoach rerender={rerender} />
        </div>

        {/* Center */}
        <div className="quest-center-wrapper">
          {activeTab === 'quests' && (
            <QuestGrid
              rerender={rerender}
              showLU={showLU}
              showRW={showRW}
              showSidequestNudge={(quests) => setSidequestNudge(quests)}
            />
          )}
          {activeTab === 'scoreboard' && <Scoreboard />}
        </div>

        {/* Sidebar right */}
        <div className="sidebar-r" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <ActivityFeed />
        </div>
      </div>

      {/* Overlays */}
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
