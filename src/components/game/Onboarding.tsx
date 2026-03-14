import React, { useState } from 'react';
import { S, save, defChar } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { generatePersonalQuests } from '@/hooks/useAI';
import { buildResponseProfile } from '../../hooks/useResponseProfile';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const TOTAL_STEPS = 9;

const DEFAULT_COACH_NAMES: Record<string, string> = {
  hannes:   'VERA',
  ludvig:   'MAX',
  martin:   'KARL',
  nisse:    'ATLAS',
  simon:    'NOVA',
  johannes: 'BIRK',
  carl:     'LEXA',
  niklas:   'GRID',
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
  { label: 'GENERERA',  bg: 'hsla(38, 66%, 47%, 0.08)' },
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
    const name = coachName.trim() || DEFAULT_COACH_NAMES[selectedMember] || 'COACH';
    S.chars[selectedMember].coachName = name;
    save();
    next();
  }

  async function startGenerate() {
    setGenerating(true);
    setError('');
    setGenMsg('Genererar personliga uppdrag...');
    try {
      await generatePersonalQuests(false, () => {});
      save();
    } catch {
      setError('Kunde inte generera uppdrag — fortsätter utan AI.');
    }
    setGenerating(false);
    triggerWelcome();
  }

  function triggerWelcome() {
    setShowWelcome(true);
    setTimeout(() => {
      S.onboarded = true;
      if (selectedMember && S.chars[selectedMember]) {
        S.chars[selectedMember].onboarded = true;
      }
      save();
      rerender();
    }, 2400);
  }

  const member = selectedMember ? MEMBERS[selectedMember] : null;
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
      case 8: return true;
      default: return true;
    }
  }

  function getButtonLabel() {
    if (step === 0) return 'Börja →';
    if (step === 1) return `Välj ${member?.name || '—'} →`;
    if (step === 7) return 'Spara namn →';
    if (step === 8) return 'Kom igång →';
    return 'Fortsätt';
  }

  function handlePrimary() {
    switch (step) {
      case 0: next(); break;
      case 1: confirmMember(); break;
      case 6: finishQuestions(); break;  // triggers profile build → advances to step 7 (coach)
      case 7: saveCoachAndNext(); break;  // saves coach name → advances to step 8 (generate)
      case 8: startGenerate(); break;
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
      <div className="ob-progress-track">
        <motion.div
          className="ob-progress-fill"
          animate={{ width: progressPct + '%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Back button */}
      {step > 1 && !generating && (
        <button
          className="ob-back"
          onClick={back}
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <ArrowLeft size={20} />
        </button>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          className="ob-step-container"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Abstract background shape */}
          <div
            className="ob-abstract-bg"
            style={{ background: `radial-gradient(ellipse at 50% 30%, ${stepBg} 0%, transparent 70%)` }}
          />

          <div className="ob-step-content">
            {STEP_META[step]?.label && (
              <div className="ob-step-label">{STEP_META[step].label}</div>
            )}

            {/* ── Step 0: Welcome ── */}
            {step === 0 && (
              <>
                <div className="ob-question">SEKTIONEN<br />HEADQUARTERS</div>
                <div className="ob-desc">
                  Välkommen till bandets gamification-system. Slutför uppdrag, samla XP och nå nya nivåer tillsammans.
                </div>
              </>
            )}

            {/* ── Step 1: Member selection ── */}
            {step === 1 && (
              <>
                <div className="ob-question">Vem är du i bandet?</div>
                <div className="member-grid ob-member-grid">
                  {Object.entries(MEMBERS).map(([id, m]) => (
                    <div
                      key={id}
                      className={`member-tile ${selectedMember === id ? 'selected' : ''}`}
                      onClick={() => setSelectedMember(id)}
                    >
                      <div className="member-tile-emoji"><MemberIcon id={id} size={28} /></div>
                      <div className="member-tile-name">{(m as any).name}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Steps 2–6: Five questions ── */}
            {step >= 2 && step <= 6 && (
              <>
                <div className="ob-question">{ONBOARDING_QUESTIONS[step - 2]}</div>
                <textarea
                  key={step}
                  className="ob-textarea"
                  placeholder="Skriv fritt..."
                  value={answers[step - 2]}
                  onChange={e => setAnswer(step - 2, e.target.value)}
                  autoFocus
                  rows={4}
                />
              </>
            )}

            {/* ── Step 7: Coach name ── */}
            {step === 7 && (
              <>
                <div className="ob-question">Din coach</div>
                <div className="ob-desc">
                  Din personliga coach är redo. Du kan byta namn när som helst — håll inne på namnet i chatten.
                </div>
                <input
                  className="ob-textarea"
                  style={{ resize: 'none', fontSize: 'var(--text-heading)', letterSpacing: '0.08em', textAlign: 'center' }}
                  value={coachName}
                  onChange={e => setCoachName(e.target.value.toUpperCase())}
                  maxLength={20}
                  autoFocus
                  placeholder={selectedMember ? DEFAULT_COACH_NAMES[selectedMember] : 'COACH'}
                />
              </>
            )}

            {/* ── Step 8: Generate quests ── */}
            {step === 8 && (
              <>
                <div className="ob-question">Generera uppdrag</div>
                <div className="ob-desc">AI skapar personliga uppdrag baserade på din profil.</div>
                {generating ? (
                  <div className="ob-generating">
                    <div className="refresh-spinner" />
                    <div className="ob-generating-text">{genMsg}</div>
                  </div>
                ) : (
                  error && <div className="ob-error">{error}</div>
                )}
              </>
            )}
          </div>

          {/* Bottom actions */}
          {!generating && (
            <div className="ob-bottom-actions">
              {step === 8 && (
                <button
                  className="ob-skip-btn"
                  onClick={triggerWelcome}
                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                >Hoppa över</button>
              )}
              <button
                className="ob-primary-btn"
                disabled={!canProceed()}
                onClick={handlePrimary}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                {getButtonLabel()}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
