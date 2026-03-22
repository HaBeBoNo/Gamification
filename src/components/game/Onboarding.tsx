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

const TOTAL_STEPS = 8;

const DEFAULT_COACH_NAMES: Record<string, string> = {
  hannes:   'Scout',
  martin:   'Brodern',
  niklas:   'Arkitekten',
  carl:     'Analytikern',
  nisse:    'Spegeln',
  simon:    'Rådgivaren',
  johannes: 'Kartläggaren',
  ludvig:   'Katalysatorn',
};

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
      }
      // Hämta eventuell befintlig data från Supabase, sedan pusha lokal data
      try { await syncFromSupabase(selectedMember!); } catch {}
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
      <div className="ob-overlay">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%',
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
      <div className="ob-overlay">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%',
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
      <div className="ob-overlay">
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
    <div className="ob-overlay">
      {/* Progress line */}
      <div className="ob-progress-bar">
        <div className="ob-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Step label */}
      {STEP_META[step]?.label && (
        <div className="ob-step-label">{STEP_META[step].label}</div>
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
              <div className="ob-member-grid">
                {Object.entries(MEMBERS).map(([key, m]: [string, any]) => (
                  <button
                    key={key}
                    className={`ob-member-btn${selectedMember === key ? ' selected' : ''}`}
                    onClick={() => setSelectedMember(key)}
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
              <div className="ob-question">{ONBOARDING_QUESTIONS[step - 2]}</div>
              <textarea
                className="ob-textarea"
                value={answers[step - 2]}
                onChange={e => setAnswer(step - 2, e.target.value)}
                placeholder="Skriv här..."
                rows={5}
                autoFocus
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
          <button className="ob-back-btn" onClick={back}>
            <ArrowLeft size={16} />
          </button>
        )}
        <button
          className="ob-primary-btn"
          onClick={handlePrimary}
          disabled={!canProceed()}
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