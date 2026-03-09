import React, { useState, useEffect } from 'react';
import { S } from './state/store';

import Onboarding from './components/game/Onboarding';
import Topbar from './components/game/Topbar';
import MetricsBar from './components/game/MetricsBar';
import QuestGrid from './components/game/QuestGrid';
import Leaderboard from './components/game/Leaderboard';
import Scoreboard from './components/game/Scoreboard';
import ActivityFeed from './components/game/ActivityFeed';
import AICoach from './components/game/AICoach';
import AdminPanel from './components/game/AdminPanel';

import LevelUpOverlay from './components/game/overlays/LevelUpOverlay';
import RewardOverlay from './components/game/overlays/RewardOverlay';
import MetricsModal from './components/game/overlays/MetricsModal';
import RefreshOverlay from './components/game/overlays/RefreshOverlay';
import SidequestNudge from './components/game/overlays/SidequestNudge';

export default function App() {
  const [tick, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);
  const [activeTab, setActiveTab] = useState('quests');
  const [levelUp, setLevelUp] = useState(null);
  const [reward, setReward] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [sidequestNudge, setSidequestNudge] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

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
        <div className="sidebar-l" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Leaderboard />
          <AICoach rerender={rerender} />
        </div>

        <div className="quest-center-wrapper">
          {activeTab === 'quests' && (
            <QuestGrid
              rerender={rerender}
              showLU={showLevelUp => setLevelUp(showLevelUp)}
              showRW={(rw, tier) => setReward({ reward: rw, tier })}
              showSidequestNudge={(quests) => setSidequestNudge(quests)}
            />
          )}
          {activeTab === 'scoreboard' && <Scoreboard />}
        </div>

        <div className="sidebar-r" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <ActivityFeed />
        </div>
      </div>

      {levelUp && <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />}
      {reward && <RewardOverlay reward={reward.reward} tier={reward.tier} onClose={() => setReward(null)} />}
      {showMetrics && <MetricsModal onClose={() => setShowMetrics(false)} rerender={rerender} />}
      {refreshMsg && <RefreshOverlay message={refreshMsg} />}
      {sidequestNudge && <SidequestNudge quests={sidequestNudge} onClose={() => setSidequestNudge(null)} rerender={rerender} />}
      {showAdmin && <AdminPanel rerender={rerender} onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
