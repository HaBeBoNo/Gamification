import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { S, notify, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MessageCircle, Home, Activity, BarChart2, User, Lightbulb, ChevronRight, LogOut, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Topbar from '@/components/game/Topbar';
import ActivityFeed from '@/components/game/ActivityFeed';
import AICoach from '@/components/game/AICoach';
import InstallPrompt from '@/components/game/InstallPrompt';
import OfflineBanner from '@/components/game/OfflineBanner';
import NetworkToast from '@/components/game/NetworkToast';
import OverlayLayer from '@/components/game/OverlayLayer';
import { BottomNav } from '@/components/game/BottomNav';
import { AuthGate } from '@/components/app/AuthGate';
import { OverflowSheet, type OverflowItem } from '@/components/app/OverflowSheet';
import { SecondaryTabShell } from '@/components/app/SecondaryTabShell';
import { TabContentRouter } from '@/components/app/TabContentRouter';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useOverlays } from '@/hooks/useOverlays';
import { markAllRead } from '@/state/notifications';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useAuth } from '@/hooks/useAuth';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useWaitingOnYouSurface } from '@/hooks/useHomeSurface';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { supabase } from '@/lib/supabase';
import { STORAGE_KEY } from '@/lib/config';
import { clearSocialSignalSync } from '@/lib/socialSignalPolicy';
import { unregisterPush } from '@/lib/webPush';
import { clearHomeAttentionSeen, markCurrentHomeAttentionSeen } from '@/lib/homeAttentionState';
import { clearBaselineSession, consumePushOpenMarker, recordAppOpenOncePerSession } from '@/lib/productBaseline';
const viewTransition = { duration: 0.2, ease: 'easeOut' as const };

const PRIMARY_TAB_IDS = new Set(['quests', 'bandhub', 'leaderboard']);

export default function Index() {
  // Zustand-driven reactivity: alla save()/notify() triggar re-render
  useGameStore(s => s.tick);
  const rerender = notify;
  const hasReloadedForServiceWorker = useRef(false);

  const [activeView, setActiveView] = useState<'home' | 'tab'>('home');
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [detailQuest, setDetailQuest] = useState<any | null>(null);
  const unreadCount = useGameStore((s) => s.notifications.filter((n: any) => !n.read).length);
  const currentSurface = activeView === 'home' ? 'home' : activeTab;

  const [coachInsight, setCoachInsight] = useState<string | undefined>();
  const { refreshing, handlePullStart, handlePullMove, handlePullEnd } = usePullToRefresh(S.me);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const homeAttentionSurface = useWaitingOnYouSurface(activeView === 'home');

  // Google OAuth auth gate
  const { user, synced } = useAuth();
  useAppBootstrap(currentSurface, S.me);

  const isCurl  = S.me === 'carl';

  const handleTabTap = useCallback((tabId: string) => {
    if (tabId === 'more') { setShowMore(true); return; }
    setActiveView('tab');
    setMobileTab(tabId);
    setActiveTab(tabId);
  }, []);

  const { handleTouchStart, handleTouchEnd } = useSwipeNavigation(mobileTab, handleTabTap);

  const handleMobileTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    handlePullStart(e);
    if (activeView !== 'home') {
      handleTouchStart(e);
    }
  }, [activeView, handlePullStart, handleTouchStart]);

  const handleMobileTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    handlePullEnd();
    if (activeView !== 'home') {
      handleTouchEnd(e);
    }
  }, [activeView, handlePullEnd, handleTouchEnd]);

  function openNotifications() {
    if (S.me) {
      markCurrentHomeAttentionSeen(S.me);
    }
    setShowNotifications(true);
    markAllRead();
  }

  const closeAll = useCallback(() => {
    setShowNotifications(false);
    setDetailQuest(null);
    setShowMetrics(false);
    setShowMore(false);
    closeOverlays();
  }, [closeOverlays]);

  const handleQuestTap  = useCallback((q: any) => setDetailQuest(q), []);
  const handleOpenCoach = useCallback((msg?: string) => {
    if (msg) setCoachInsight(msg);
    else handleTabTap('coach');
  }, [handleTabTap]);

  const keyboardHandlers = useMemo(() => ({
    setMobileTab,
    setActiveTab,
    closeAll,
    isCurl,
  }), [closeAll, isCurl]);

  const { showShortcutsOverlay, setShowShortcutsOverlay } = useKeyboardShortcuts(keyboardHandlers);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let mounted = true;
    let activeRegistration: ServiceWorkerRegistration | null = null;

    const triggerReload = () => {
      if (hasReloadedForServiceWorker.current) return;
      hasReloadedForServiceWorker.current = true;
      window.location.reload();
    };

    const checkForUpdates = () => {
      void navigator.serviceWorker.getRegistration().then((registration) => {
        if (!mounted || !registration) return;
        activeRegistration = registration;
        void registration.update().catch(() => undefined);
      });
    };

    const handleControllerChange = () => {
      if (import.meta.env.DEV) console.warn('[SW] Controller changed — reloading');
      triggerReload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    const handleWindowFocus = () => {
      checkForUpdates();
    };

    const handleUpdateFound = () => {
      const newWorker = activeRegistration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (import.meta.env.DEV) console.warn('[SW] New version available — reloading');
          triggerReload();
        }
      });
    };

    navigator.serviceWorker.ready.then((registration) => {
      if (!mounted) return;
      activeRegistration = registration;
      registration.addEventListener('updatefound', handleUpdateFound);
      void registration.update().catch(() => undefined);
    });

    const updateInterval = window.setInterval(checkForUpdates, 60_000);

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    checkForUpdates();

    return () => {
      mounted = false;
      window.clearInterval(updateInterval);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      activeRegistration?.removeEventListener('updatefound', handleUpdateFound);
    };
  }, []);

  useEffect(() => {
    if (!synced || !S.me) return;

    const source = consumePushOpenMarker() ? 'push' : 'direct';
    recordAppOpenOncePerSession({
      memberKey: S.me,
      source,
      path: typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.hash || ''}`
        : '/',
    });
  }, [synced, S.me]);

  const shouldOnboard = synced && !S.onboarded && !S.chars[S.me!]?.onboarded;

  // ── Handlers ──────────────────────────────────────────────────────

  async function handleOverflowSelect(id: string) {
    setShowMore(false);
    if (id === 'logout') {
      const currentMember = S.me;
      if (currentMember) {
        await unregisterPush(currentMember);
      }
      if (supabase) await supabase.auth.signOut();
      localStorage.removeItem(STORAGE_KEY);
      if (currentMember) {
        clearSocialSignalSync(currentMember);
        clearHomeAttentionSeen(currentMember);
        clearBaselineSession(currentMember);
      }
      window.location.reload();
      return;
    }
    if (id === 'home') { setActiveView('home'); return; }
    setActiveView('tab');
    setMobileTab(id);
    setActiveTab(id);
  }

  const COACH_NAMES_INDEX: Record<string, string> = { hannes: 'Scout', martin: 'Brodern', niklas: 'Arkitekten', carl: 'Analytikern',
       nisse: 'Spegeln', simon: 'Rådgivaren', johannes: 'Kartläggaren', ludvig: 'Katalysatorn' };
  const coachName: string = (S.chars[S.me!]?.coachName || (S.me ? COACH_NAMES_INDEX[S.me] : undefined) || 'Coach') as string;

  const overflowItems: OverflowItem[] = [
    {
      id: 'coach',
      icon: MessageCircle,
      label: coachName,
      section: 'Fokus',
    },
    {
      id: 'activity',
      icon: Activity,
      label: 'Aktivitet',
      section: 'Fokus',
    },
    {
      id: 'home',
      icon: Home,
      label: 'Hem',
      section: 'Överblick',
    },
    {
      id: 'season',
      icon: BarChart2,
      label: 'Säsong',
      section: 'Överblick',
    },
    {
      id: 'profile',
      icon: User,
      label: 'Profil',
      section: 'Överblick',
    },
    {
      id: 'history',
      icon: Clock,
      label: 'Uppdragshistorik',
      section: 'Verktyg',
    },
    ...(isCurl ? [{
      id: 'ideas',
      icon: Lightbulb,
      label: 'Idéer',
      section: 'Verktyg',
    }] : []),
    {
      id: 'logout',
      icon: LogOut,
      label: 'Logga ut',
      section: 'Konto',
    },
  ];
  const overflowItemById = Object.fromEntries(overflowItems.map((item) => [item.id, item])) as Record<string, OverflowItem>;
  const mobileOverflowActive = activeView === 'tab' && !PRIMARY_TAB_IDS.has(mobileTab);

  const coachIconColor = MEMBERS[S.me || '']?.xpColor || 'var(--color-primary)';

  // ── Render ────────────────────────────────────────────────────────

  const content = (
    <TabContentRouter
      activeView={activeView}
      tab={activeTab}
      rerender={rerender}
      showLU={showLU}
      showRW={showRW}
      showXP={showXP}
      showSidequestNudge={showSidequestNudge}
      onQuestTap={handleQuestTap}
      onOpenCoach={handleOpenCoach}
      onMetricClick={() => setShowMetrics(true)}
      onNavigate={handleTabTap}
      onOpenNotifications={openNotifications}
      attentionSurface={homeAttentionSurface}
    />
  );
  const secondaryTab = activeView === 'tab' ? overflowItemById[activeTab] : undefined;
  const framedContent = secondaryTab && secondaryTab.id !== 'home'
    ? (
      <SecondaryTabShell
        icon={secondaryTab.icon}
        label={secondaryTab.label}
      >
        {content}
      </SecondaryTabShell>
    )
    : content;

  const mobileContent = (
    <TabContentRouter
      activeView={activeView}
      tab={mobileTab}
      rerender={rerender}
      showLU={showLU}
      showRW={showRW}
      showXP={showXP}
      showSidequestNudge={showSidequestNudge}
      onQuestTap={handleQuestTap}
      onOpenCoach={handleOpenCoach}
      onMetricClick={() => setShowMetrics(true)}
      onNavigate={handleTabTap}
      onOpenNotifications={openNotifications}
      attentionSurface={homeAttentionSurface}
    />
  );
  const mobileSecondaryTab = activeView === 'tab' ? overflowItemById[mobileTab] : undefined;
  const framedMobileContent = mobileSecondaryTab && mobileSecondaryTab.id !== 'home'
    ? (
      <SecondaryTabShell
        icon={mobileSecondaryTab.icon}
        label={mobileSecondaryTab.label}
      >
        {mobileContent}
      </SecondaryTabShell>
    )
    : mobileContent;

  return (
    <AuthGate synced={synced} user={user} shouldOnboard={shouldOnboard} rerender={rerender}>
    <div className="app-shell">
      <OfflineBanner />
      <InstallPrompt />
      <NetworkToast />
      <Topbar
        onNotifications={openNotifications}
        onLogoClick={() => setActiveView('home')}
        notificationCount={homeAttentionSurface.unreadCount}
        hasAttention={homeAttentionSurface.unreadCount > 0 || homeAttentionSurface.signals.length > 0}
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
          {isDesktop ? (
            <div className="desktop-content">
              {framedContent}
            </div>
          ) : (
            <div
              className="mobile-content"
              style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
              onTouchStart={handleMobileTouchStart}
              onTouchMove={handlePullMove}
              onTouchEnd={handleMobileTouchEnd}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={mobileTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={viewTransition}
                >
                  {framedMobileContent}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="sidebar-r">
          <div className="stagger-2"><ActivityFeed compact /></div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <BottomNav
        activeTab={mobileTab}
        activeView={activeView}
        onTabChange={handleTabTap}
        showMore={showMore}
        overflowActive={mobileOverflowActive}
        onMoreTap={() => setShowMore(true)}
        unreadCount={unreadCount}
      />

      <OverflowSheet
        show={showMore}
        items={overflowItems}
        activeView={activeView}
        activeTab={activeTab}
        coachIconColor={coachIconColor}
        onClose={() => setShowMore(false)}
        onSelect={handleOverflowSelect}
      />

      {/* All overlays & modals */}
      <OverlayLayer
        xpAmount={xpAmount} setXpAmount={setXpAmount}
        levelUp={levelUp} setLevelUp={setLevelUp}
        reward={reward} setReward={setReward}
        refreshMsg={refreshMsg}
        sidequestNudge={sidequestNudge} setSidequestNudge={setSidequestNudge}
        showLU={showLU} showRW={showRW} showXP={showXP}
        showMetrics={showMetrics} setShowMetrics={setShowMetrics}
        showNotifications={showNotifications} setShowNotifications={setShowNotifications}
        detailQuest={detailQuest} setDetailQuest={setDetailQuest}
        showShortcutsOverlay={showShortcutsOverlay} setShowShortcutsOverlay={setShowShortcutsOverlay}
        coachInsight={coachInsight} setCoachInsight={setCoachInsight}
        rerender={rerender}
        onNavigateToTab={handleTabTap}
        onOpenCoach={handleOpenCoach}
      />
    </div>
    </AuthGate>
  );
}
