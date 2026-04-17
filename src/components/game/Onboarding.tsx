import React, { useState } from 'react';
import { S, save, defChar } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { generatePersonalQuests, WELCOME_MESSAGES } from '@/hooks/useAI';
import { buildResponseProfile } from '../../hooks/useResponseProfile';
import { syncToSupabase, syncFromSupabase } from '@/hooks/useSupabaseSync';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { createFirstLoginNotif, addNotifToAll } from '@/state/notifications';
import { fireAndForget } from '@/lib/async';
import { getBandmateKeys, notifyMembersSignal } from '@/lib/notificationSignals';
import { DEFAULT_COACH_NAMES } from '@/lib/coach';

const TOTAL_STEPS = 8;

/* ── Five universal onboarding questions ── */
const ONBOARDING_QUESTIONS = [
  'Berätta om ett ögonblick i Sektionen som du inte skulle vilja vara utan.',
  'Vad i din roll känns mest naturligt för dig?',
  'Vad i Sektionen ger dig energi?',
  'Vad skulle du vilja bli bättre på?',
  'Vad gör du som ingen annan i bandet gör på samma sätt?',
];

/* Step 0=welcome 1=member 2-6=questions 7=coach 8=generate */
const STEP_META = [
  { label: '',          bg: 'hsla(38, 66%, 47%, 0.08)' },
  { label: 'KARAKTÄR',  bg: 'hsla(258, 90%, 66%, 0.08)' },
  { label: 'MINNE',     bg: 'hsla(160, 84%, 39%, 0.08)' },
  { label: 'ROLL',      bg: 'hsla(213, 60%, 57%, 0.08)' },
  { label: 'ENERGI',    bg: 'hsla(45, 80%, 55%, 0.08)' },
  { label: 'TILLVÄXT',  bg: 'hsla(0, 91%, 71%, 0.08)' },
  { label: 'IDENTITET', bg: 'hsla(258, 90%, 66%, 0.08)' },
  { label: 'COACH',     bg: 'hsla(258, 90%, 66%, 0.08)' },
];

export default function Onboarding({ rerender }: { rerender: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  /* One state slot per question */
  const [answers, setAnswers] = useState(['', '', '', '', '']);

  const [coachName, setCoachName] = useState('');

  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [error, setError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [buildingProfile, setBuildingProfile] = useState(false);

  function next() { setDirection(1); setStep(s => s + 1); }
  function back() { if (step > 1) { setDirection(-1); setStep(s => s - 1); } }

  function setAnswer(i: number, val: string) {
    setAnswers(prev => { const a = [...prev]; a[i] = val; return a; });
  }

  function confirmMember() {
    if (!selectedMember) return;
    S.me = selectedMember;
    if (!S.chars[selectedMember]) S.chars[selectedMember] = defChar(selectedMember);
    setCoachName(DEFAULT_COACH_NAMES[selectedMember] || 'COACH');
    next();
  }

  /** Called after the last question (step 6). Saves answers, builds profile, then advances to generate. */
  async function finishQuestions() {
    if (!selectedMember) return;

    /* Save answers to familiar char fields for backward-compat with useAI.js */
    const char = S.chars[selectedMember];
    char.motivation  = answers[0];
    char.roleEnjoy   = answers[1];
    char.roleDrain   = answers[2];
    char.hiddenValue = answers[3];
    char.gap         = answers[4];
    save();

    /* Build response profile via Claude API */
    setBuildingProfile(true);
    try {
      const profile = await buildResponseProfile(answers);
      if (profile) {
        S.chars[selectedMember].responseProfile = profile;
        save();
      }
    } catch {
      /* Fail silently — app continues without profile */
    }
    setBuildingProfile(false);
    next(); // → generate step (step 7)
  }

  function saveCoachAndNext() {
    if (!selectedMember) return;
    const char = S.chars[selectedMember];
    char.coachName = coachName.trim() || defaultCoachName;
    save();
    startGenerate();
  }

  async function startGenerate() {
    setGenerating(true);
    setError('');
    setGenMsg('Genererar personliga uppdrag...');
    try {
      await generatePersonalQuests(false);
      save();
    } catch {
      setError('Kunde inte generera uppdrag — fortsätter utan AI.');
    }
    setGenerating(false);
    triggerWelcome();
  }

  function triggerWelcome() {
    setShowWelcome(true);
    setTimeout(async () => {
      // Sätt onboarded-flaggor INNAN sync, så att de inte skrivs över
      S.onboarded = true;
      if (selectedMember && S.chars[selectedMember]) {
        S.chars[selectedMember].onboarded = true;
      }
      save();
      // Skicka first-login notifikation till alla
      if (selectedMember) {
        const memberName = (MEMBERS as any)[selectedMember]?.name || selectedMember;
        const notif = createFirstLoginNotif(selectedMember, memberName);
        addNotifToAll(notif);
        fireAndForget(notifyMembersSignal({
          targetMemberKeys: getBandmateKeys(selectedMember),
          type: 'first_login',
          title: `${memberName} har anslutit sig till Headquarters! 🎉`,
          body: 'Välkommen till bandet.',
          dedupeKey: `first-login:${selectedMember}`,
          payload: {
            memberId: selectedMember,
          },
        }), 'send onboarding welcome notification');
      }
      // Synka till Supabase direkt
      try { await syncToSupabase(selectedMember!); } catch {}
      rerender();
    }, 2400);
  }

  const member = selectedMember ? MEMBERS[selectedMember] : null;
  const defaultCoachName = DEFAULT_COACH_NAMES[selectedMember || ''] || 'Coach';
  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  function canProceed() {
    switch (step) {
      case 0: return true;
      case 1: return !!selectedMember;
      case 2: return answers[0].trim().length > 0;
      case 3: return answers[1].trim().length > 0;
      case 4: return answers[2].trim().length > 0;
      case 5: return answers[3].trim().length > 0;
      case 6: return answers[4].trim().length > 0;
      case 7: return coachName.trim().length > 0;
      default: return true;
    }
  }

  function getButtonLabel() {
    if (step === 0) return 'Börja →';
    if (step === 1) return `Välj ${member?.name || '—'} →`;
    if (step === 7) return 'Spara namn →';
    return 'Fortsätt';
  }

  function handlePrimary() {
    switch (step) {
      case 0: next(); break;
      case 1: confirmMember(); break;
      case 6: finishQuestions(); break;  // triggers profile build → advances to step 7 (coach)
      case 7: saveCoachAndNext(); break;  // saves coach name → auto-triggers generation
      default: next(); break;
    }
  }

  /* ── Profile-building interstitial ── */
  if (buildingProfile) {
    return (
      <div className="ob-overlay" style={{
        minHeight: '100dvh',
        padding: 'env(safe-area-inset-top) 24px env(safe-area-inset-bottom)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', flex: 1,
          gap: 'var(--space-lg)',
        }}>
          <motion.div
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--color-accent)',
            }}
            animate={{ opacity: [1, 0.25, 1], scale: [1, 0.75, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-muted)',
          }}>
            Förbereder din profil...
          </div>
        </div>
      </div>
    );
  }

  /* ── Quest-generating interstitial ── */
  if (generating) {
    return (
      <div className="ob-overlay" style={{
        minHeight: '100dvh',
        padding: 'env(safe-area-inset-top) 24px env(safe-area-inset-bottom)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', flex: 1,
          gap: 'var(--space-lg)',
        }}>
          <motion.div
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--color-accent)',
            }}
            animate={{ opacity: [1, 0.25, 1], scale: [1, 0.75, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div style={{
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
            letterSpacing: '0.08em',
          }}>
            Förbereder dina uppdrag...
          </div>
        </div>
      </div>
    );
  }

  /* ── Welcome interstitial ── */
  if (showWelcome) {
    return (
      <div className="ob-overlay" style={{
        minHeight: '100dvh',
        padding: 'env(safe-area-inset-top) 24px env(safe-area-inset-bottom)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        overflowY: 'auto',
      }}>
        <motion.div
          className="ob-welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {selectedMember && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="ob-welcome-icon"
            >
              <MemberIcon id={selectedMember} size={64} color={member?.xpColor} />
            </motion.div>
          )}
          <motion.div
            className="ob-welcome-name"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            {member?.name}
          </motion.div>
          <motion.div
            className="ob-welcome-sub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            Välkommen till Headquarters.
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const stepBg = STEP_META[step]?.bg || 'transparent';

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
  };

  return (
    <div className="ob-overlay" style={{
      minHeight: '100dvh',
      padding: 'env(safe-area-inset-top) 24px env(safe-area-inset-bottom)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg)',
      overflowY: 'auto',
    }}>
      {/* Progress line */}
      <div className="ob-progress-bar" style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 3,
        background: 'var(--color-border)',
        zIndex: 10,
      }}>
        <div className="ob-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Step label */}
      {STEP_META[step]?.label && (
        <div className="ob-step-label" style={{
          fontSize: 10,
          letterSpacing: '0.15em',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-ui)',
          textAlign: 'center',
          marginTop: 16,
          marginBottom: 32,
        }}>{STEP_META[step].label}</div>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          className="ob-step"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{ background: stepBg }}
        >
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="ob-step-inner">
              <div className="ob-title">Välkommen till<br />Headquarters</div>
              <div className="ob-body">
                Det här är din personliga spelmiljö för Sektionen.<br />
                Vi börjar med att lära känna dig lite bättre.
              </div>
            </div>
          )}

          {/* ── Step 1: Choose member ── */}
          {step === 1 && (
            <div className="ob-step-inner">
              <div className="ob-title">Vem är du?</div>
              <div className="ob-member-grid" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                width: '100%',
                marginBottom: 100,
              }}>
                {Object.entries(MEMBERS).map(([key, m]: [string, any]) => (
                  <button type="button"
                    key={key}
                    className={`ob-member-btn${selectedMember === key ? ' selected' : ''}`}
                    onClick={() => setSelectedMember(key)}
                    style={{
                      padding: '16px 12px',
                      borderRadius: 12,
                      border: '2px solid',
                      borderColor: selectedMember === key ? 'var(--color-primary)' : 'var(--color-border)',
                      background: selectedMember === key ? 'var(--color-primary)10' : 'var(--color-surface)',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      textAlign: 'center',
                      minHeight: 80,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <MemberIcon id={key} size={40} color={m.xpColor} />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Steps 2–6: Questions ── */}
          {step >= 2 && step <= 6 && (
            <div className="ob-step-inner">
              <div className="ob-question" style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--color-text)',
                lineHeight: 1.3,
                marginBottom: 16,
                fontFamily: 'var(--font-display)',
              }}>{ONBOARDING_QUESTIONS[step - 2]}</div>
              <textarea
                className="ob-textarea"
                value={answers[step - 2]}
                onChange={e => setAnswer(step - 2, e.target.value)}
                placeholder="Skriv här..."
                rows={5}
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 120,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  color: 'var(--color-text)',
                  padding: '14px',
                  fontSize: 16,
                  fontFamily: 'var(--font-body)',
                  resize: 'none',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              />
            </div>
          )}

          {/* ── Step 7: Coach name ── */}
          {step === 7 && (
            <div className="ob-step-inner">
              <div className="ob-title">Din coach</div>
              <div className="ob-body">
                Vad ska din personliga coach heta?
              </div>
              <input
                className="ob-input"
                value={coachName}
                onChange={e => setCoachName(e.target.value)}
                placeholder={defaultCoachName}
                autoFocus
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="ob-nav">
        {step > 1 && (
          <button type="button" className="ob-back-btn" onClick={back}>
            <ArrowLeft size={16} />
          </button>
        )}
        <button type="button"
          className="ob-primary-btn"
          onClick={handlePrimary}
          disabled={!canProceed()}
          style={{
            position: 'fixed',
            bottom: 'calc(24px + env(safe-area-inset-bottom))',
            left: 24, right: 24,
            background: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            border: 'none',
            borderRadius: '999px',
            padding: '16px',
            fontSize: 15,
            fontFamily: 'var(--font-ui)',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            touchAction: 'manipulation',
            zIndex: 10,
          }}
        >
          {getButtonLabel()}
        </button>
      </div>

      {error && (
        <div className="ob-error">{error}</div>
      )}
    </div>
  );
}
