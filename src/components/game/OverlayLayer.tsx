import React from 'react';
import { X } from 'lucide-react';

import AdminPanel from './AdminPanel';
import AdminCenter from './AdminCenter';
import CommandPalette from './CommandPalette';
import NotificationPanel from './NotificationPanel';
import QuestDetail from './QuestDetail';
import QuestHistory from './QuestHistory';
import SeasonView from './SeasonView';
import ShortcutsOverlay from './ShortcutsOverlay';
import CoachInsightModal from './CoachInsightModal';

import LevelUpOverlay from './overlays/LevelUpOverlay';
import RewardOverlay from './overlays/RewardOverlay';
import MetricsModal from './overlays/MetricsModal';
import RefreshOverlay from './overlays/RefreshOverlay';
import SidequestNudge from './overlays/SidequestNudge';
import XPOverlay from './overlays/XPOverlay';

interface OverlayLayerProps {
  // Game overlays (from useOverlays)
  xpAmount: number | null;
  setXpAmount: (v: number | null) => void;
  levelUp: number | null;
  setLevelUp: (v: number | null) => void;
  reward: { reward: any; tier?: string } | null;
  setReward: (v: any) => void;
  refreshMsg: string | null;
  sidequestNudge: any[] | null;
  setSidequestNudge: (v: any) => void;
  showLU: (level: number) => void;
  showRW: (reward: any, tier?: string) => void;
  showXP: (amount: number) => void;

  // Modal states
  showMetrics: boolean;
  setShowMetrics: (v: boolean) => void;
  showAdmin: boolean;
  setShowAdmin: (v: boolean) => void;
  showCmd: boolean;
  setShowCmd: (v: boolean) => void;
  showAdminCenter: boolean;
  setShowAdminCenter: (v: boolean) => void;
  showNotifications: boolean;
  setShowNotifications: (v: boolean) => void;
  detailQuest: any | null;
  setDetailQuest: (v: any) => void;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  showShortcutsOverlay: boolean;
  setShowShortcutsOverlay: (v: boolean) => void;
  coachInsight: string | undefined;
  setCoachInsight: (v: string | undefined) => void;

  // Shared
  rerender: () => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenCoach?: (initialMessage?: string) => void;
}

export default function OverlayLayer(props: OverlayLayerProps) {
  const {
    xpAmount, setXpAmount,
    levelUp, setLevelUp,
    reward, setReward,
    refreshMsg,
    sidequestNudge, setSidequestNudge,
    showLU, showRW, showXP,
    showMetrics, setShowMetrics,
    showAdmin, setShowAdmin,
    showCmd, setShowCmd,
    showAdminCenter, setShowAdminCenter,
    showNotifications, setShowNotifications,
    detailQuest, setDetailQuest,
    showHistory, setShowHistory,
    showShortcutsOverlay, setShowShortcutsOverlay,
    coachInsight, setCoachInsight,
    rerender,
    onNavigateToTab,
    onOpenCoach,
  } = props;

  return (
    <>
      {/* Game overlays */}
      {xpAmount !== null && (
        <XPOverlay amount={xpAmount} onDone={() => setXpAmount(null)} />
      )}
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
      {refreshMsg && <RefreshOverlay message={refreshMsg} />}
      {sidequestNudge && (
        <SidequestNudge
          quests={sidequestNudge}
          onClose={() => setSidequestNudge(null)}
          rerender={rerender}
        />
      )}

      {/* Admin panels */}
      {showAdmin && (
        <AdminPanel
          rerender={rerender}
          onClose={() => setShowAdmin(false)}
        />
      )}
      {showCmd && (
        <CommandPalette
          onClose={() => setShowCmd(false)}
          isMobile={window.innerWidth < 768}
          onOpenAdminCenter={() => { setShowCmd(false); setShowAdminCenter(true); }}
        />
      )}
      {showAdminCenter && (
        <AdminCenter
          onClose={() => setShowAdminCenter(false)}
          rerender={rerender}
        />
      )}

      {/* Notification panel */}
      {showNotifications && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 300,
        }}
          onClick={() => setShowNotifications(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: 0, right: 0,
              width: '100%',
              maxWidth: 400,
              height: '100%',
              background: 'var(--color-surface)',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <NotificationPanel
              onClose={() => setShowNotifications(false)}
              onNavigate={onNavigateToTab}
              onOpenCoach={onOpenCoach}
            />
          </div>
        </div>
      )}

      {/* Quest detail */}
      {detailQuest && !detailQuest.__season && (
        <QuestDetail
          quest={detailQuest}
          onClose={() => setDetailQuest(null)}
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
        />
      )}
      {detailQuest?.__season && (
        <div className="overlay-backdrop" onClick={() => setDetailQuest(null)}>
          <div className="overlay-card" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <button className="overlay-close" onClick={() => setDetailQuest(null)}>✕</button>
            <SeasonView />
          </div>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      <ShortcutsOverlay
        open={showShortcutsOverlay}
        onClose={() => setShowShortcutsOverlay(false)}
      />

      {/* Coach insight modal */}
      {coachInsight && (
        <CoachInsightModal
          insight={coachInsight}
          onClose={() => setCoachInsight(undefined)}
        />
      )}

      {/* Quest history full-screen */}
      {showHistory && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'var(--color-bg)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
          }}>
            <div style={{
              fontSize: 11, letterSpacing: '0.1em',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-ui)',
            }}>
              UPPDRAGSHISTORIK
            </div>
            <button
              onClick={() => setShowHistory(false)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer', padding: 4,
                touchAction: 'manipulation',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <QuestHistory />
          </div>
        </div>
      )}
    </>
  );
}
