import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { S, notify, useGameStore, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MessageCircle, Home, Activity, BarChart2, User, Lightbulb, ChevronRight, Settings, LogOut, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Onboarding from '@/components/game/Onboarding';
import AuthScreen from '@/components/game/AuthScreen';
import Topbar from '@/components/game/Topbar';
import MetricsBar from '@/components/game/MetricsBar';
import QuestGrid from '@/components/game/QuestGrid';
import Scoreboard from '@/components/game/Scoreboard';
import LeaderboardView from '@/components/game/LeaderboardView';
import ActivityFeed from '@/components/game/ActivityFeed';
import AICoach from '@/components/game/AICoach';
import CoachChat from '@/components/game/CoachChat';
import CoachInsightModal from '@/components/game/CoachInsightModal';
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
import QuestHistory from '@/components/game/QuestHistory';
import ShortcutsOverlay from '@/components/game/ShortcutsOverlay';
import { BottomNav } from '@/components/game/BottomNav';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useOverlays } from '@/hooks/useOverlays';
import { markAllRead } from '@/state/notifications';
import { useSupabaseData } from '@/hooks/useAuth';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useLongPress } from '@/hooks/useLongPress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

import LevelUpOverlay from '@/components/game/overlays/LevelUpOverlay';
import RewardOverlay from '@/components/game/overlays/RewardOverlay';
import MetricsModal from '@/components/game/overlays/MetricsModal';
import RefreshOverlay from '@/components/game/overlays/RefreshOverlay';
import SidequestNudge from '@/components/game/overlays/SidequestNudge';
import XPOverlay from '@/components/game/overlays/XPOverlay';

// Lazy-load BandHub to prevent Google OAuth import errors from crashing the whole app
const BandHub = lazy(() => import('@/components/game/BandHub'));

const viewTransition = { duration: 0.2, ease: 'easeOut' as const }; 
const sheetSpring = { type: 'spring' as const, stiffness: 400, damping: 35 };

export default function Index() {
  // Zustand-driven reactivity: alla save()/notify() triggar re-render
  useGameStore(s => s.tick);
  const rerender = notify;

  const [activeTab, setActiveTab] = useState('quests');
  const [mobileTab, setMobileTab] = useState('quests');
  const [showMore, setShowMore] = useState(false);

  const {
    levelUp, setLevelUp,
    reward, setReward,
    xpAmount, setXpAmount,
    refreshMsg,
    sidequestNudge, setSidequestNudge,
    showLU, showRW, showXP, showSidequestNudge,
    closeOverlays,
  } = useOverlays();

  const [showMetrics, setShowMetrics] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [showAdminCenter, setShowAdminCenter] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [detailQuest, setDetailQuest] = useState<any | null>(null);
  // Reactive unread count — re-renders automatically when notifications change
  const unreadCount = useGameStore(s => s.notifications.filter((n: any) => !n.read).length);

  const [coachInsight, setCoachInsight] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);

  const { refreshing, handlePullStart, handlePullMove, handlePullEnd } = usePullToRefresh(S.me);

  // Google OAuth auth gate — wait for both auth and Supabase sync to complete
  const { user, memberKey, loading: authLoading, synced } = useAuth();

  // Sync från Supabase när S.me är satt (vid varje app-start)
  useSupabaseData(S.me);

  const isAdmin = S.me === 'hannes';
  const isCurl  = S.me === 'carl';

  const { handleTouchStart, handleTouchEnd } = useSwipeNavigation(mobileTab, handleTabTap);

  function openNotifications() {
    setShowNotifications(true);
    markAllRead();
  }

  const closeAll = useCallback(() => {
    setShowCmd(false);
    setShowAdminCenter(false);
    setShowNotifications(false);
    setDetailQuest(null);
    setShowAdmin(false);
    setShowMetrics(false);
    setShowMore(false);
    closeOverlays();
  }, [closeOverlays]);

  // Stable callbacks for QuestGrid props — prevents React.memo from breaking
  const handleQuestTap  = useCallback((q: any) => setDetailQuest(q), []);
  const handleOpenCoach = useCallback((msg?: string) => {
    if (msg) setCoachInsight(msg);
    else handleTabTap('coach');
  }, []);

  const keyboardHandlers = useMemo(() => ({
    setMobileTab,
    setActiveTab,
    setShowCmd,
    closeAll,
    isCurl,
  }), [closeAll, isCurl]);

  const { showShortcutsOverlay, setShowShortcutsOverlay } = useKeyboardShortcuts(keyboardHandlers);

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

  const logoLongPressRef = useLongPress(() => setShowAdminCenter(true), isAdmin);

  // Show loading screen until Supabase sync is complete (guards onboarding check)
  if (!synced) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--color-bg)',
      color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)',
      fontFamily: 'var(--font-ui)', letterSpacing: '0.1em'
    }}>
      SEKTIONEN HQ
    </div>
  );

  if (!user) {
    return <AuthScreen />;
  }

  console.log('=== INDEX DEBUG ===');
  console.log('authLoading:', authLoading);
  console.log('synced:', synced);
  console.log('user:', user?.email);
  console.log('S.me:', S.me);
  console.log('S.onboarded:', S.onboarded);
  console.log('shouldOnboard:', !S.me || (!S.onboarded && !S.chars[S.me]?.onboarded));
  console.log('===================');

  const shouldOnboard = synced && (!S.onboarded || !S.me);
  if (shouldOnboard) {
    return <Onboarding rerender={rerender} />;
  }

  async function handleOverflowSelect(id: string) {
    setShowMore(false);
    if (id === 'logout') {
      if (supabase) await supabase.auth.signOut();
      localStorage.clear();
      window.location.reload();
      return;
    }
    if (id === 'admin') {
      setShowAdmin(true);
      return;
    }
    if (id === 'history') {
      setShowHistory(true);
      return;
    }
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
          showSidequestNudge={showSidequestNudge}
          onQuestTap={handleQuestTap}
          onOpenCoach={handleOpenCoach}
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
          <MetricsBar onMetricClick={() => setShowMetrics(true)} />
          <AICoach rerender={rerender} />
        </div>
      );
      default: return (
        <QuestGrid
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
          showSidequestNudge={showSidequestNudge}
          onQuestTap={handleQuestTap}
          onOpenCoach={handleOpenCoach}
        />
      );
    }
  }

  const coachName = S.chars[S.me]?.coachName ||
    ({ hannes: 'Scout', martin: 'Brodern', niklas: 'Arkitekten', carl: 'Analytikern',
       nisse: 'Spegeln', simon: 'Rådgivaren', johannes: 'Kartläggaren', ludvig: 'Katalysatorn'
    } as Record<string, string>)[S.me || ''] || 'Coach';

  const overflowItems = [
    { id: 'coach',    icon: MessageCircle, label: coachName,    subtitle: 'Din personliga AI-coach' },
    { id: 'home',     icon: Home,          label: 'Hem',        subtitle: 'Bandets översikt och metrics' },
    { id: 'activity', icon: Activity,      label: 'Aktivitet',  subtitle: 'Senaste händelser' },
    { id: 'season',   icon: BarChart2,     label: 'Säsong',     subtitle: 'Säsongsöversikt och XP-kurva' },
    { id: 'profile',  icon: User,          label: 'Profil',     subtitle: 'Inställningar och din data' },
    { id: 'history', icon: Clock, label: 'Uppdragshistorik', subtitle: 'Avklarade uppdrag' },
    ...(isCurl  ? [{ id: 'ideas', icon: Lightbulb, label: 'Idéer',  subtitle: 'Lösa tankar' }] : []),
    ...(isAdmin ? [{ id: 'admin', icon: Settings,  label: 'Admin',  subtitle: 'Systemkontroller' }] : []),
    { id: 'logout', icon: LogOut, label: 'Logga ut', subtitle: 'Avsluta session' },
  ];

  const coachIconColor = MEMBERS[S.me || '']?.xpColor || 'var(--color-primary)';

  // ── Swipe between main tabs (see useSwipeNavigation) ──────────────

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
        onNotifications={openNotifications}
      />

      {refreshing && (
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '8px',
          fontSize: 12, color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-ui)', letterSpacing: '0.08em',
        }}>
          Uppdaterar...
        </div>
      )}

      <div id="main-content" className="body-grid body-grid-no-sidebar">
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
                showSidequestNudge={showSidequestNudge}
                onQuestTap={(q: any) => setDetailQuest(q)}
                onOpenCoach={(msg?: string) => { if (msg) { setCoachInsight(msg); } else { handleTabTap('coach'); } }}
              />
            )}
            {activeTab === 'leaderboard' && <LeaderboardView />}
            {activeTab === 'skilltree' && <Scoreboard />}
            {activeTab === 'bandhub' && (
              <Suspense fallback={
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
                  Laddar Band Hub…
                </div>
              }>
                <BandHub />
              </Suspense>
            )}
          </div>

          <div
            className="mobile-content"
            style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom)))" }}
            onTouchStart={(e) => {
              handlePullStart(e);
              handleTouchStart(e);
            }}
            onTouchMove={handlePullMove}
            onTouchEnd={(e) => {
              handlePullEnd();
              handleTouchEnd(e);
            }}
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
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          </div>
        </div>
      )}

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

      {coachInsight && (
        <CoachInsightModal
          insight={coachInsight}
          onClose={() => setCoachInsight(undefined)}
        />
      )}

      {showHistory && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'var(--color-bg)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
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

          {/* Innehåll */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <QuestHistory />
          </div>
        </div>
      )}
    </div>
  );
}