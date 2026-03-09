import React, { useState, useEffect } from 'react';
import { S, save, defChar } from '@/state/store';
import { MEMBERS, ROLE_TYPES } from '@/data/members';
import { generatePersonalQuests } from '@/hooks/useAI';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const TOTAL_STEPS = 8;

const STEP_META = [
  { label: '', bg: 'hsla(38, 66%, 47%, 0.08)' },
  { label: 'KARAKTÄR', bg: 'hsla(258, 90%, 66%, 0.08)' },
  { label: 'MOTIVATION', bg: 'hsla(160, 84%, 39%, 0.08)' },
  { label: 'ROLL', bg: 'hsla(213, 60%, 57%, 0.08)' },
  { label: 'UTMANINGAR', bg: 'hsla(0, 91%, 71%, 0.08)' },
  { label: 'VÄRDE', bg: 'hsla(45, 80%, 55%, 0.08)' },
  { label: 'AI', bg: 'hsla(239, 84%, 67%, 0.08)' },
  { label: 'GENERERA', bg: 'hsla(38, 66%, 47%, 0.08)' },
];

const ROLE_TYPE_CARDS = [
  { id: 'builder', name: 'Builder', desc: 'Bygger struktur och riktning på lång sikt' },
  { id: 'amplifier', name: 'Amplifier', desc: 'Skapar räckvidd och energi utåt' },
  { id: 'enabler', name: 'Enabler', desc: 'Möjliggör för andra — osynligt arbete med hög systemvikt' },
];

export default function Onboarding({ rerender }: { rerender: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [motivation, setMotivation] = useState('');
  const [roleEnjoy, setRoleEnjoy] = useState('');
  const [roleDrain, setRoleDrain] = useState('');
  const [hiddenValue, setHiddenValue] = useState('');
  const [gap, setGap] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('anthropic-key') || '');
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [error, setError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  function next() { setDirection(1); setStep(s => s + 1); }
  function back() { if (step > 1) { setDirection(-1); setStep(s => s - 1); } }

  function selectMember(id: string) { setSelectedMember(id); }

  function confirmMember() {
    if (!selectedMember) return;
    S.me = selectedMember;
    if (!S.chars[selectedMember]) S.chars[selectedMember] = defChar(selectedMember);
    next();
  }

  function saveProfile() {
    if (!selectedMember) return;
    const char = S.chars[selectedMember];
    char.motivation = motivation;
    char.roleEnjoy = roleEnjoy;
    char.roleDrain = roleDrain;
    char.hiddenValue = hiddenValue;
    char.gap = gap;
    save();
    next();
  }

  function saveApiKey() {
    if (apiKey.trim()) localStorage.setItem('anthropic-key', apiKey.trim());
    next();
  }

  async function startGenerate() {
    setGenerating(true);
    setError('');
    setGenMsg('Genererar personliga uppdrag...');
    try {
      await generatePersonalQuests(false, () => {});
      save();
    } catch (e) {
      setError('Kunde inte generera uppdrag — fortsätter utan AI.');
    }
    setGenerating(false);
    triggerWelcome();
  }

  function triggerWelcome() {
    setShowWelcome(true);
    setTimeout(() => {
      S.onboarded = true;
      save();
      rerender();
    }, 2400);
  }

  function finish() {
    triggerWelcome();
  }

  const member = selectedMember ? MEMBERS[selectedMember] : null;
  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  function canProceed() {
    switch (step) {
      case 0: return true;
      case 1: return !!selectedMember;
      case 2: return motivation.trim().length > 0;
      case 3: return roleEnjoy.trim().length > 0;
      case 4: return roleDrain.trim().length > 0;
      case 5: return hiddenValue.trim().length > 0;
      case 6: return true;
      case 7: return true;
      default: return true;
    }
  }

  function getButtonLabel() {
    if (step === 0) return 'Börja →';
    if (step === 1) return `Välj ${member?.name || '—'} →`;
    if (step === 7) return 'Kom igång →';
    return 'Fortsätt';
  }

  function handlePrimary() {
    switch (step) {
      case 0: next(); break;
      case 1: confirmMember(); break;
      case 5: saveProfile(); break;
      case 6: saveApiKey(); break;
      case 7: startGenerate(); break;
      default: next(); break;
    }
  }

  // Welcome interstitial
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
      {step > 1 && (
        <button className="ob-back" onClick={back}>
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
          <div className="ob-abstract-bg" style={{ background: `radial-gradient(ellipse at 50% 30%, ${stepBg} 0%, transparent 70%)` }} />

          <div className="ob-step-content">
            {STEP_META[step]?.label && (
              <div className="ob-step-label">{STEP_META[step].label}</div>
            )}

            {step === 0 && (
              <>
                <div className="ob-question">SEKTIONEN<br />HEADQUARTERS</div>
                <div className="ob-desc">Välkommen till bandets gamification-system. Slutför uppdrag, samla XP och nå nya nivåer tillsammans.</div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="ob-question">Vem är du i bandet?</div>
                <div className="member-grid ob-member-grid">
                  {Object.entries(MEMBERS).map(([id, m]) => (
                    <div key={id} className={`member-tile ${selectedMember === id ? 'selected' : ''}`} onClick={() => selectMember(id)}>
                      <div className="member-tile-emoji"><MemberIcon id={id} size={28} /></div>
                      <div className="member-tile-name">{m.name}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="ob-question">Varför är du med i Sektionen?<br />Vad driver dig?</div>
                <textarea
                  className="ob-textarea"
                  placeholder="Beskriv din motivation..."
                  value={motivation}
                  onChange={e => setMotivation(e.target.value)}
                  autoFocus
                  rows={4}
                />
              </>
            )}

            {step === 3 && (
              <>
                <div className="ob-question">Vad njuter du mest av i din roll som {member?.role}?</div>
                <textarea
                  className="ob-textarea"
                  placeholder="Det jag njuter mest av..."
                  value={roleEnjoy}
                  onChange={e => setRoleEnjoy(e.target.value)}
                  autoFocus
                  rows={4}
                />
              </>
            )}

            {step === 4 && (
              <>
                <div className="ob-question">Vad är jobbigt eller dränerar din energi?</div>
                <textarea
                  className="ob-textarea"
                  placeholder="Det som är jobbigt..."
                  value={roleDrain}
                  onChange={e => setRoleDrain(e.target.value)}
                  autoFocus
                  rows={4}
                />
              </>
            )}

            {step === 5 && (
              <>
                <div className="ob-question">Vad kan du som ingen annan vet om?</div>
                <textarea
                  className="ob-textarea"
                  placeholder="Mitt dolda värde / styrka..."
                  value={hiddenValue}
                  onChange={e => setHiddenValue(e.target.value)}
                  autoFocus
                  rows={4}
                />
                <textarea
                  className="ob-textarea"
                  style={{ marginTop: 'var(--space-md)' }}
                  placeholder="Gap jag vill fylla..."
                  value={gap}
                  onChange={e => setGap(e.target.value)}
                  rows={3}
                />
              </>
            )}

            {step === 6 && (
              <>
                <div className="ob-question">AI-nyckel</div>
                <div className="ob-desc">Ange din Anthropic API-nyckel för AI-coaching och personliga uppdrag. (Valfritt)</div>
                <input
                  type="password"
                  className="ob-textarea"
                  style={{ minHeight: 'unset', height: 48 }}
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  autoFocus
                />
              </>
            )}

            {step === 7 && (
              <>
                <div className="ob-question">Generera uppdrag</div>
                <div className="ob-desc">AI skapar personliga uppdrag baserade på din profil.</div>
                {generating ? (
                  <div className="ob-generating">
                    <div className="refresh-spinner" />
                    <div className="ob-generating-text">{genMsg}</div>
                  </div>
                ) : (
                  <>
                    {error && <div className="ob-error">{error}</div>}
                  </>
                )}
              </>
            )}
          </div>

          {/* Bottom button */}
          {!generating && (
            <div className="ob-bottom-actions">
              {step === 6 && (
                <button className="ob-skip-btn" onClick={next}>Hoppa över</button>
              )}
              {step === 7 && (
                <button className="ob-skip-btn" onClick={finish}>Hoppa över</button>
              )}
              <button
                className="ob-primary-btn"
                disabled={!canProceed()}
                onClick={handlePrimary}
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
