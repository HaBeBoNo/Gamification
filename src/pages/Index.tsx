import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { S, notify, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MessageCircle, Home, Activity, BarChart2, User, Lightbulb, ChevronRight, LogOut, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Onboarding from '@/components/game/Onboarding';
import AuthScreen from '@/components/game/AuthScreen';
import Topbar from '@/components/game/Topbar';
import { HomeScreen } from '@/components/game/HomeScreen';
import QuestGrid from '@/components/game/QuestGrid';
import Scoreboard from '@/components/game/Scoreboard';
import LeaderboardView from '@/components/game/LeaderboardView';
import ActivityFeed from '@/components/game/ActivityFeed';
import AICoach from '@/components/game/AICoach';
import CoachChat from '@/components/game/CoachChat';
import IdeasView from '@/components/game/IdeasView';
import InstallPrompt from '@/components/game/InstallPrompt';
import OfflineBanner from '@/components/game/OfflineBanner';
import NetworkToast from '@/components/game/NetworkToast';
import SeasonView from '@/components/game/SeasonView';
import ProfileView from '@/components/game/ProfileView';
import OverlayLayer from '@/components/game/OverlayLayer';
import { BottomNav } from '@/components/game/BottomNav';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useOverlays } from '@/hooks/useOverlays';
import { markAllRead } from '@/state/notifications';
import { useSupabaseData } from '@/hooks/useAuth';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useFeedSync } from '@/hooks/useFeedSync';
import { useSocialNotifications } from '@/hooks/useSocialNotifications';
import { usePresenceSync } from '@/hooks/usePresenceSync';
import { STORAGE_KEY } from '@/lib/config';
import { clearSocialSignalSync } from '@/lib/socialSignalPolicy';
import { unregisterPush } from '@/lib/webPush';

// Lazy-load BandHub to prevent Google OAuth import errors from crashing the whole app
const BandHub = lazy(() => import('@/components/game/BandHub'));

const viewTransition = { duration: 0.2, ease: 'easeOut' as const };
const sheetSpring = { type: 'spring' as const, stiffness: 400, damping: 35 };

const BandHubFallback = (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
    Laddar Band Hub…
  </div>
);

const PRIMARY_TAB_IDS = new Set(['quests', 'bandhub', 'leaderboard']);

type OverflowItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  subtitle: string;
  section: string;
  intro?: string;
};

function SecondaryTabShell({
  icon: Icon,
  label,
  subtitle,
  intro,
  children,
}: {
  icon: React.ElementType;
  label: string;
  subtitle: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="secondary-view-shell">
      <div className="secondary-view-header">
        <div className="secondary-view-eyebrow">Mer</div>
        <div className="secondary-view-title-row">
          <div className="secondary-view-icon">
            <Icon size={18} />
          </div>
          <div>
            <div className="secondary-view-title">{label}</div>
            <div className="secondary-view-subtitle">{subtitle}</div>
          </div>
        </div>
        {intro ? <div className="secondary-view-intro">{intro}</div> : null}
      </div>
      <div className="secondary-view-body">
        {children}
      </div>
    </div>
  );
}

export default function Index() {
  // Zustand-driven reactivity: alla save()/notify() triggar re-render
  useGameStore(s => s.tick);
  const rerender = notify;
  useFeedSync();
  useSocialNotifications();

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
  const unreadCount = useGameStore(s => s.notifications.filter((n: any) => !n.read).length);
  const currentSurface = activeView === 'home' ? 'home' : activeTab;

  const [coachInsight, setCoachInsight] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const { refreshing, handlePullStart, handlePullMove, handlePullEnd } = usePullToRefresh(S.me);

  // Google OAuth auth gate
  const { user, synced } = useAuth();
  usePresenceSync(currentSurface);

  // Sync from Supabase on app start
  useSupabaseData(S.me);

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

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (import.meta.env.DEV) console.warn('[SW] New version available — reloading');
            window.location.reload();
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (import.meta.env.DEV) console.warn('[SW] Controller changed — reloading');
      window.location.reload();
    });
  }, []);

  // ── Auth & loading gates ──────────────────────────────────────────

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

  if (!user) return <AuthScreen />;

  const shouldOnboard = synced && !S.onboarded && !S.chars[S.me!]?.onboarded;
  if (shouldOnboard) return <Onboarding rerender={rerender} />;

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
      if (currentMember) clearSocialSignalSync(currentMember);
      window.location.reload();
      return;
    }
    if (id === 'history') { setShowHistory(true); return; }
    if (id === 'home') { setActiveView('home'); return; }
    setActiveView('tab');
    setMobileTab(id);
    setActiveTab(id);
  }

  // ── Content renderers ─────────────────────────────────────────────

  function renderContent(tab: string) {
    if (activeView === 'home') {
      return (
        <HomeScreen
          rerender={rerender}
          onMetricClick={() => setShowMetrics(true)}
          onNavigate={handleTabTap}
          onOpenCoach={handleOpenCoach}
          onOpenNotifications={openNotifications}
        />
      );
    }

    switch (tab) {
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
      case 'bandhub': return <Suspense fallback={BandHubFallback}><BandHub /></Suspense>;
      case 'profile': return <ProfileView />;
      case 'season': return <div style={{ padding: 'var(--space-lg)' }}><SeasonView /></div>;
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

  const COACH_NAMES_INDEX: Record<string, string> = { hannes: 'Scout', martin: 'Brodern', niklas: 'Arkitekten', carl: 'Analytikern',
       nisse: 'Spegeln', simon: 'Rådgivaren', johannes: 'Kartläggaren', ludvig: 'Katalysatorn' };
  const coachName: string = (S.chars[S.me!]?.coachName || (S.me ? COACH_NAMES_INDEX[S.me] : undefined) || 'Coach') as string;

  const overflowItems: OverflowItem[] = [
    {
      id: 'coach',
      icon: MessageCircle,
      label: coachName,
      subtitle: 'Din personliga AI-coach',
      section: 'Fokus',
      intro: 'Coachrummet ska kännas som en tydlig förlängning av uppdragen, inte en sidofunktion.',
    },
    {
      id: 'activity',
      icon: Activity,
      label: 'Aktivitet',
      subtitle: 'Bandets signaler och svar',
      section: 'Fokus',
      intro: 'Här ska interaktionen kännas levande och lätt att följa vidare in i trådar.',
    },
    {
      id: 'home',
      icon: Home,
      label: 'Hem',
      subtitle: 'Bandets överblick och puls',
      section: 'Överblick',
    },
    {
      id: 'season',
      icon: BarChart2,
      label: 'Säsong',
      subtitle: 'Progress, tempo och riktning',
      section: 'Överblick',
      intro: 'Säsongen ska kännas som långsam rörelse framåt, inte som ett separat statistikverktyg.',
    },
    {
      id: 'profile',
      icon: User,
      label: 'Profil',
      subtitle: 'Din progression och form',
      section: 'Överblick',
      intro: 'Profilen ska läsa som en personlig berättelse om hur du rör dig genom säsongen.',
    },
    {
      id: 'history',
      icon: Clock,
      label: 'Uppdragshistorik',
      subtitle: 'Det du faktiskt har gjort',
      section: 'Verktyg',
    },
    ...(isCurl ? [{
      id: 'ideas',
      icon: Lightbulb,
      label: 'Idéer',
      subtitle: 'Lösa tankar och nästa frön',
      section: 'Verktyg',
      intro: 'Här ska idéer få landa snabbt utan att kännas som en tung process.',
    }] : []),
    {
      id: 'logout',
      icon: LogOut,
      label: 'Logga ut',
      subtitle: 'Avsluta session',
      section: 'Konto',
    },
  ];
  const overflowItemById = Object.fromEntries(overflowItems.map((item) => [item.id, item])) as Record<string, OverflowItem>;
  const mobileOverflowActive = activeView === 'tab' && !PRIMARY_TAB_IDS.has(mobileTab);

  const coachIconColor = MEMBERS[S.me || '']?.xpColor || 'var(--color-primary)';

  // ── Render ────────────────────────────────────────────────────────

  const content = renderContent(activeTab);
  const secondaryTab = activeView === 'tab' ? overflowItemById[activeTab] : undefined;
  const framedContent = secondaryTab && secondaryTab.id !== 'home'
    ? (
      <SecondaryTabShell
        icon={secondaryTab.icon}
        label={secondaryTab.label}
        subtitle={secondaryTab.subtitle}
        intro={secondaryTab.intro}
      >
        {content}
      </SecondaryTabShell>
    )
    : content;

  const mobileContent = renderContent(mobileTab);
  const mobileSecondaryTab = activeView === 'tab' ? overflowItemById[mobileTab] : undefined;
  const framedMobileContent = mobileSecondaryTab && mobileSecondaryTab.id !== 'home'
    ? (
      <SecondaryTabShell
        icon={mobileSecondaryTab.icon}
        label={mobileSecondaryTab.label}
        subtitle={mobileSecondaryTab.subtitle}
        intro={mobileSecondaryTab.intro}
      >
        {mobileContent}
      </SecondaryTabShell>
    )
    : mobileContent;

  return (
    <div className="app-shell">
      <OfflineBanner />
      <InstallPrompt />
      <NetworkToast />
      <Topbar
        onNotifications={openNotifications}
        onLogoClick={() => setActiveView('home')}
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
          {/* Desktop: render active tab directly */}
          <div className="desktop-content">
            {framedContent}
          </div>

          {/* Mobile: animated tab transitions */}
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
        </div>

        <div className="sidebar-r">
          <div className="stagger-2"><ActivityFeed /></div>
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

      {/* Overflow bottom sheet */}
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
                if (info.offset.y > 90 || info.velocity.y > 700) setShowMore(false);
              }}
            >
              <div className="overflow-handle" />
              <div className="overflow-sheet-header">
                <div className="overflow-sheet-eyebrow">Mer</div>
                <div className="overflow-sheet-title">Fler rum i HQ</div>
                <div className="overflow-sheet-subtitle">
                  Sekundära ytor som fortfarande ska kännas lika genomarbetade som huvudflikarna.
                </div>
              </div>
              {overflowItems.map((item, i) => {
                const Icon = item.icon;
                const previous = overflowItems[i - 1];
                const active = activeView === 'tab' ? activeTab === item.id : item.id === 'home' && activeView === 'home';
                const showSection = !previous || previous.section !== item.section;
                return (
                  <React.Fragment key={item.id}>
                    {showSection ? (
                      <div className="overflow-section-title">{item.section}</div>
                    ) : (
                      <div className="overflow-sep" />
                    )}
                    <button
                      className={`overflow-row ${active ? 'is-active' : ''}`}
                      onClick={() => handleOverflowSelect(item.id)}
                    >
                      <Icon
                        size={20}
                        className="overflow-row-icon"
                        style={item.id === 'coach' ? { color: coachIconColor } : undefined}
                      />
                      <div className="overflow-row-text">
                        <span className="overflow-row-label">{item.label}</span>
                        <span className="overflow-row-sub">{item.subtitle}</span>
                      </div>
                      <div className="overflow-row-meta">
                        {active ? <span className="overflow-row-active">Här nu</span> : null}
                        <ChevronRight size={16} className="overflow-row-chevron" />
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
        showHistory={showHistory} setShowHistory={setShowHistory}
        showShortcutsOverlay={showShortcutsOverlay} setShowShortcutsOverlay={setShowShortcutsOverlay}
        coachInsight={coachInsight} setCoachInsight={setCoachInsight}
        rerender={rerender}
        onNavigateToTab={handleTabTap}
        onOpenCoach={handleOpenCoach}
      />
    </div>
  );
}
