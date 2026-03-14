import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { CheckSquare, GitBranch, Trophy, MoreHorizontal, MessageCircle, Home, Activity, BarChart2, User, Lightbulb, ChevronRight, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Onboarding from '@/components/game/Onboarding';
import Topbar from '@/components/game/Topbar';
import MetricsBar from '@/components/game/MetricsBar';
import QuestGrid from '@/components/game/QuestGrid';
import Scoreboard from '@/components/game/Scoreboard';
import LeaderboardView from '@/components/game/LeaderboardView';
import ActivityFeed from '@/components/game/ActivityFeed';
import AICoach from '@/components/game/AICoach';
import CoachChat from '@/components/game/CoachChat';
import IdeasView from '@/components/game/IdeasView';
import AdminPanel from '@/components/game/AdminPanel';
import AdminCenter from '@/components/game/AdminCenter';
import InstallPrompt from '@/components/game/InstallPrompt';
import OfflineBanner from '@/components/game/OfflineBanner';
import NetworkToast from '@/components/game/NetworkToast';
import CommandPalette from '@/components/game/CommandPalette';
import NotificationPanel from '@/components/game/NotificationPanel';
import QuestDetail from '@/components/game/QuestDetail';
import SeasonView from '@/components/game/SeasonView';
import ShortcutsOverlay from '@/components/game/ShortcutsOverlay';
import { BottomNav } from '@/components/game/BottomNav';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { getUnreadCount, subscribeNotifications } from '@/state/notifications';

import LevelUpOverlay from '@/components/game/overlays/LevelUpOverlay';
import RewardOverlay from '@/components/game/overlays/RewardOverlay';
import MetricsModal from '@/components/game/overlays/MetricsModal';
import RefreshOverlay from '@/components/game/overlays/RefreshOverlay';
import SidequestNudge from '@/components/game/overlays/SidequestNudge';
import XPOverlay from '@/components/game/overlays/XPOverlay';

// Lazy-load BandHub to prevent Google OAuth import errors from crashing the whole app
const BandHub = lazy(() => import('@/components/game/BandHub'));

const PRIMARY_TABS = [
  { id: 'quests', icon: CheckSquare },
  { id: 'skilltree', icon: GitBranch },
  { id: 'leaderboard', icon: Trophy },
  { id: 'bandhub', icon: Globe },
  { id: 'more', icon: MoreHorizontal },
];

const OVERFLOW_ITEMS = [
  { id: 'coach', icon: MessageCircle, label: 'Coach', subtitle: 'Din personliga AI-coach' },
  { id: 'home', icon: Home, label: 'Hem', subtitle: 'Bandets översikt och metrics' },
  { id: 'activity', icon: Activity, label: 'Aktivitet', subtitle: 'Senaste händelser' },
  { id: 'season', icon: BarChart2, label: 'Säsong', subtitle: 'Säsongsöversikt och XP-kurva' },
  { id: 'profile', icon: User, label: 'Profil', subtitle: 'Inställningar och din data' },
];

const OVERFLOW_ITEMS_CARL = [
  ...OVERFLOW_ITEMS,
  { id: 'ideas', icon: Lightbulb, label: 'Idéer', subtitle: 'Lösa tankar' },
];

const viewTransition = { duration: 0.2, ease: 'easeOut' as const };
const sheetSpring = { type: 'spring' as const, stiffness: 400, damping: 35 };

export default function Index() {
  const [tick, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);

  const [activeTab, setActiveTab] = useState('quests');
  const [mobileTab, setMobileTab] = useState('quests');
  const [showMore, setShowMore] = useState(false);

  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [reward, setReward] = useState<{ reward: any; tier?: string } | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [sidequestNudge, setSidequestNudge] = useState<any[] | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [xpAmount, setXpAmount] = useState<number | null>(null);
  const [showCmd, setShowCmd] = useState(false);
  const [showAdminCenter, setShowAdminCenter] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [detailQuest, setDetailQuest] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(getUnreadCount());

  const isAdmin = S.me === 'hannes';
  const isCurl = S.me === 'carl';

  // Track unread notifications for dot on ••• icon
  useEffect(() => {
    return subscribeNotifications(() => setUnreadCount(getUnreadCount()));
  }, []);

  function showLU(level: number) { setLevelUp(level); }
  function showRW(rw: any, tier?: string) { setReward({ reward: rw, tier }); }
  function showXP(amount: number) { setXpAmount(amount); }

  const closeAll = useCallback(() => {
    setShowCmd(false);
    setShowAdminCenter(false);
    setShowNotifications(false);
    setDetailQuest(null);
    setShowAdmin(false);
    setShowMetrics(false);
    setSidequestNudge(null);
    setShowMore(false);
  }, []);

  const { showShortcutsOverlay, setShowShortcutsOverlay } = useKeyboardShortcuts({
    setMobileTab,
    setActiveTab,
    setShowCmd,
    closeAll,
    isCurl,
  });

  useEffect(() => {
    if (!isAdmin) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmd(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin]);

  const logoLongPressRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !isAdmin) return;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => { timer = setTimeout(() => setShowAdminCenter(true), 2000); };
    const cancel = () => clearTimeout(timer);
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchend', cancel);
    node.addEventListener('touchcancel', cancel);
    return () => {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchend', cancel);
      node.removeEventListener('touchcancel', cancel);
    };
  }, [isAdmin]);

  const shouldOnboard = !S.me || !S.onboarded;
  if (shouldOnboard) {
    return <Onboarding rerender={rerender} />;
  }

  function handleOverflowSelect(id: string) {
    setShowMore(false);
    setMobileTab(id);
    setActiveTab(id);
  }

  function handleTabTap(tabId: string) {
    if (tabId === 'more') {
      setShowMore(true);
      return;
    }
    setMobileTab(tabId);
    setActiveTab(tabId);
  }

  function getMobileContent() {
    switch (mobileTab) {
      case 'quests': return (
        <QuestGrid
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
          showSidequestNudge={(quests: any[]) => setSidequestNudge(quests)}
          onQuestTap={(q: any) => setDetailQuest(q)}
        />
      );
      case 'skilltree': return <Scoreboard />;
      case 'leaderboard': return <LeaderboardView />;
      case 'coach': return <CoachChat rerender={rerender} />;
      case 'activity': return <ActivityFeed />;
      case 'ideas': return <IdeasView />;
      case 'bandhub': return (
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
            Laddar Band Hub…
          </div>
        }>
          <BandHub />
        </Suspense>
      );
      case 'profile': return (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}>
          <div style={{ fontSize: 'var(--text-display)', marginBottom: 'var(--space-sm)' }}>👤</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-xs)' }}>{S.me}</div>
          <div style={{ fontSize: 'var(--text-caption)' }}>Profilinställningar kommer snart</div>
        </div>
      );
      case 'season': return (
        <div style={{ padding: 'var(--space-lg)' }}>
          <SeasonView />
        </div>
      );
      case 'home': return (
        <div>
          <MetricsBar onMetricClick={() => setShowMetrics(true)} rerender={rerender} />
          <AICoach rerender={rerender} />
        </div>
      );
      default: return (
        <QuestGrid
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
          showSidequestNudge={(quests: any[]) => setSidequestNudge(quests)}
          onQuestTap={(q: any) => setDetailQuest(q)}
        />
      );
    }
  }

  const overflowItems = isCurl ? OVERFLOW_ITEMS_CARL : OVERFLOW_ITEMS;
  const coachIconColor = MEMBERS[S.me || '']?.xpColor || 'var(--color-primary)';

  // ── Swipe between main tabs ──────────────────────────────────────
  const touchStartX = useRef(0);
  const SWIPE_TAB_IDS = ['quests', 'skilltree', 'leaderboard', 'bandhub'];

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    const currentIndex = SWIPE_TAB_IDS.indexOf(mobileTab);
    if (currentIndex === -1) return; // non-swipeable tab (e.g. coach, activity…)
    if (delta > 50 && currentIndex < SWIPE_TAB_IDS.length - 1) {
      handleTabTap(SWIPE_TAB_IDS[currentIndex + 1]);
    } else if (delta < -50 && currentIndex > 0) {
      handleTabTap(SWIPE_TAB_IDS[currentIndex - 1]);
    }
  }

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
        logoRef={logoLongPressRef}
        onNotifications={() => setShowNotifications(true)}
      />

      <div className="body-grid body-grid-no-sidebar">
        <div className="sidebar-l">
          <div className="stagger-1"><AICoach rerender={rerender} /></div>
        </div>

        <div className="quest-center-wrapper stagger-1">
          <div className="desktop-content">
            {activeTab === 'quests' && (
              <QuestGrid
                rerender={rerender}
                showLU={showLU}
                showRW={showRW}
                showXP={showXP}
                showSidequestNudge={(quests: any[]) => setSidequestNudge(quests)}
                onQuestTap={(q: any) => setDetailQuest(q)}
              />
            )}
            {activeTab === 'leaderboard' && <LeaderboardView />}
            {activeTab === 'skilltree' && <Scoreboard />}
          </div>

          <div
            className="mobile-content"
            style={{ paddingBottom: 80 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={mobileTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={viewTransition}
              >
                {getMobileContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="sidebar-r">
          <div className="stagger-2"><ActivityFeed /></div>
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <BottomNav
        activeTab={mobileTab}
        onTabChange={handleTabTap}
        showMore={showMore}
        onMoreTap={() => setShowMore(true)}
        unreadCount={unreadCount}
      />

      {/* ── Overflow bottom sheet ── */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              className="overflow-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
            />
            <motion.div
              className="overflow-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={sheetSpring}
              drag="y"
              dragDirectionLock
              dragElastic={0.12}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 700) {
                  setShowMore(false);
                }
              }}
            >
              <div className="overflow-handle" />
              {overflowItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <React.Fragment key={item.id}>
                    {i > 0 && <div className="overflow-sep" />}
                    <button className="overflow-row" onClick={() => handleOverflowSelect(item.id)}>
                      <Icon
                        size={20}
                        className="overflow-row-icon"
                        style={item.id === 'coach' ? { color: coachIconColor } : undefined}
                      />
                      <div className="overflow-row-text">
                        <span className="overflow-row-label">{item.label}</span>
                        <span className="overflow-row-sub">{item.subtitle}</span>
                      </div>
                      <ChevronRight size={16} className="overflow-row-chevron" />
                    </button>
                  </React.Fragment>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Overlays */}
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

      <NotificationPanel
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

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

      <ShortcutsOverlay
        open={showShortcutsOverlay}
        onClose={() => setShowShortcutsOverlay(false)}
      />
    </div>
  );
}
