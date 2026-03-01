import React, { useState } from 'react';
import { S, save, defChar } from '../state/store';
import { MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL } from '../data/members';
import { HIDDEN_BY_TYPE, getRoleHidden } from '../data/quests';
import { generatePersonalQuests } from '../hooks/useAI';

const TOTAL_STEPS = 8;

export default function Onboarding({ rerender }) {
  const [step, setStep] = useState(0);
  const [selectedMember, setSelectedMember] = useState(null);
  const [motivation, setMotivation] = useState('');
  const [roleEnjoy, setRoleEnjoy] = useState('');
  const [roleDrain, setRoleDrain] = useState('');
  const [hiddenValue, setHiddenValue] = useState('');
  const [gap, setGap] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('anthropic-key') || '');
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [error, setError] = useState('');

  function next() { setStep(s => s + 1); }

  function selectMember(id) {
    setSelectedMember(id);
  }

  function confirmMember() {
    if (!selectedMember) return;
    S.me = selectedMember;
    if (!S.chars[selectedMember]) {
      S.chars[selectedMember] = defChar(selectedMember);
    }
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
    if (apiKey.trim()) {
      localStorage.setItem('anthropic-key', apiKey.trim());
    }
    next();
  }

  function startGenerate() {
    setGenerating(true);
    setError('');
    generatePersonalQuests(
      S, MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL, HIDDEN_BY_TYPE, getRoleHidden,
      false,
      {
        onStart: () => setGenMsg('Genererar personliga uppdrag...'),
        onProgress: (msg) => setGenMsg(msg),
        onDone: (quests) => {
          save();
          setGenerating(false);
          next();
        },
        onError: (msg) => {
          setError(msg);
          setGenerating(false);
          // Continue without personal quests
          next();
        },
      }
    );
  }

  function finish() {
    S.onboarded = true;
    save();
    rerender();
  }

  const member = selectedMember ? MEMBERS[selectedMember] : null;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="ob-step">STEG {step + 1} / {TOTAL_STEPS}</div>

        {step === 0 && (
          <>
            <div className="ob-title">SEKTIONEN<br />WAR ROOM</div>
            <div className="ob-subtitle">
              Välkommen till bandets gamification-system. Slutför uppdrag,
              samla XP och nå nya nivåer tillsammans.
            </div>
            <button className="ob-btn" onClick={next}>BÖRJA →</button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="ob-title">VÄLJ DIN KARAKTÄR</div>
            <div className="ob-subtitle">Vem är du i bandet?</div>
            <div className="member-grid">
              {Object.entries(MEMBERS).map(([id, m]) => (
                <div
                  key={id}
                  className={`member-tile ${selectedMember === id ? 'selected' : ''}`}
                  onClick={() => selectMember(id)}
                >
                  <div className="member-tile-emoji">{m.emoji}</div>
                  <div className="member-tile-name">{m.name}</div>
                </div>
              ))}
            </div>
            <button className="ob-btn" disabled={!selectedMember} onClick={confirmMember}>
              VÄLJ {member?.name?.toUpperCase() || '—'} →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-title">DIN MOTIVATION</div>
            <div className="ob-subtitle">
              Varför är du med i Sektionen? Vad driver dig?
            </div>
            <textarea
              className="ob-input"
              placeholder="Beskriv din motivation..."
              value={motivation}
              onChange={e => setMotivation(e.target.value)}
            />
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ob-title">DIN ROLL</div>
            <div className="ob-subtitle">
              Vad njuter du mest av i din roll som {member?.role}?
            </div>
            <textarea
              className="ob-input"
              placeholder="Det jag njuter mest av..."
              value={roleEnjoy}
              onChange={e => setRoleEnjoy(e.target.value)}
            />
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 4 && (
          <>
            <div className="ob-title">UTMANINGAR</div>
            <div className="ob-subtitle">
              Vad är jobbigt eller dränerar din energi?
            </div>
            <textarea
              className="ob-input"
              placeholder="Det som är jobbigt..."
              value={roleDrain}
              onChange={e => setRoleDrain(e.target.value)}
            />
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 5 && (
          <>
            <div className="ob-title">DITT DOLDA VÄRDE</div>
            <div className="ob-subtitle">
              Vad kan du som ingen annan vet om? Vad är ditt gap att fylla?
            </div>
            <textarea
              className="ob-input"
              placeholder="Mitt dolda värde / styrka..."
              value={hiddenValue}
              onChange={e => setHiddenValue(e.target.value)}
            />
            <textarea
              className="ob-input"
              style={{ marginTop: 8 }}
              placeholder="Gap jag vill fylla..."
              value={gap}
              onChange={e => setGap(e.target.value)}
            />
            <button className="ob-btn" onClick={saveProfile}>NÄSTA →</button>
          </>
        )}

        {step === 6 && (
          <>
            <div className="ob-title">AI-NYCKEL</div>
            <div className="ob-subtitle">
              Ange din Anthropic API-nyckel för att aktivera AI-coaching och
              personliga uppdrag. (Valfritt — hoppa över för att fortsätta utan AI.)
            </div>
            <input
              type="password"
              className="ob-input"
              style={{ resize: 'none', minHeight: 'unset', height: 40 }}
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <div style={{ display:'flex', gap:8 }}>
              <button className="ob-btn" style={{ flex:1 }} onClick={next}>
                HOPPA ÖVER
              </button>
              <button className="ob-btn" style={{ flex:1 }} onClick={saveApiKey}>
                SPARA NYCKEL →
              </button>
            </div>
          </>
        )}

        {step === 7 && (
          <>
            <div className="ob-title">GENERERA UPPDRAG</div>
            <div className="ob-subtitle">
              AI skapar personliga uppdrag baserade på din profil.
            </div>
            {generating ? (
              <div className="ob-generating">
                <div className="refresh-spinner" style={{
                  width:32, height:32,
                  border:'3px solid rgba(255,255,255,0.1)',
                  borderTopColor:'var(--gold)',
                  borderRadius:'50%',
                  animation:'spin 0.8s linear infinite'
                }} />
                <div className="ob-generating-text">{genMsg}</div>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ color:'var(--red)', fontSize:'0.8rem' }}>{error}</div>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <button className="ob-btn" onClick={finish}>HOPPA ÖVER</button>
                  <button className="ob-btn" onClick={startGenerate}>GENERERA →</button>
                </div>
              </>
            )}
          </>
        )}

        <div className="ob-dots">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`ob-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
