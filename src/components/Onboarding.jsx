import React, { useState } from 'react';
import { S, save, defChar } from '../state/store';
import { MEMBERS } from '../data/members';
import { generatePersonalQuests } from '../hooks/useAI';
import { BASE_QUESTS } from '../data/quests';

const TOTAL_STEPS = 10;

const MEMBER_ROLE_COPY = {
  hannes:   "Du ser vad bandet är innan det vet det självt. Berättelsen runt musiken är lika viktig som musiken — och det är du som håller den levande.",
  ludvig:   "Bandet håller ihop för att du finns. Inte för att du bestämmer — utan för att du bryr dig på riktigt. Det är svårare än det låter och vanligare än du tror att det saknas.",
  martin:   "Du är anledningen till att det låter som det gör. Men du är också den med mest erfarenhet i rummet — det är ett verktyg ingen annan har. Använd det.",
  nisse:    "Du tar energi och gör den till rörelse. En låt når Japan för att du finns. En följare blir en fan för att du bryr dig om att berätta varför musiken spelar roll.",
  simon:    "Du öppnar dörrar. Inte med charm — med förtroende. Folk litar på dig och det är därför bandet spelar live. Utan dig finns musiken men den stannar i studion.",
  johannes: "Ingenting händer på scen utan dig. Det är inte en överdrift — det är logistikens sanning. Du är den som gör att allt annat kan ske.",
  carl:     "Du bygger kapacitet för andras kreativitet. Varje bidrag du söker är en investering i något som annars aldrig hade hänt. Du är ny i rollen — men iteration är metoden och du har redan börjat.",
  niklas:   "Systemen fungerar för att du tar hand om dem. Det är inte glamoröst men det är avgörande. Replocalen, utrustningen, infrastrukturen — det är din domän och alla tar det för givet tills det slutar fungera.",
};

export default function Onboarding({ rerender }) {
  const [step, setStep] = useState(0);
  const [selectedMember, setSelectedMember] = useState(null);
  const [motivation, setMotivation] = useState('');
  const [roleEnjoy, setRoleEnjoy] = useState('');
  const [roleDrain, setRoleDrain] = useState('');
  const [hiddenValue, setHiddenValue] = useState('');
  const [gap, setGap] = useState('');
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
    finish();
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
            <div className="ob-title">HEADQUARTERS</div>
            <div className="ob-subtitle">
              Sektionen är på väg från ideell förening till professionellt band.
              Operation POST II pågår — EP till juli 2026.<br /><br />
              Det här systemet hjälper dig bidra på dina egna villkor.
              Svara ärligt — dina svar formar dina personliga uppdrag.
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

        {step === 2 && member && (
          <>
            <div className="ob-subtitle" style={{ lineHeight: 1.8, fontSize: '1rem' }}>
              {MEMBER_ROLE_COPY[selectedMember] || ''}
            </div>
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ob-title">
              {selectedMember === 'ludvig'
                ? 'VARFÖR ÄR DU MED I SEKTIONEN?'
                : 'VARFÖR SPELAR DU MUSIK?'}
            </div>
            <div className="ob-subtitle">
              {selectedMember === 'ludvig'
                ? 'Inte den officiella anledningen — den äkta. Vad håller dig kvar?'
                : 'Inte vad du tror att du borde svara — vad som faktiskt driver dig när ingen annan ser på.'}
            </div>
            <textarea
              className="ob-input"
              placeholder={selectedMember === 'ludvig'
                ? 'Det som får mig att fortsätta...'
                : 'Det som får mig att stanna kvar...'}
              value={motivation}
              onChange={e => setMotivation(e.target.value)}
            />
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 4 && (
          <>
            <div className="ob-title">DIN ROLL I VERKLIGHETEN</div>
            <div className="ob-subtitle">
              Din titel är {member?.role}. Men vad gör du faktiskt —
              det du gör med glädje, utan att det känns som jobb?
            </div>
            <textarea
              className="ob-input"
              placeholder="Det jag gör utan att kalla det jobb..."
              value={roleEnjoy}
              onChange={e => setRoleEnjoy(e.target.value)}
            />
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 5 && (
          <>
            <div className="ob-title">VAD KOSTAR MER ÄN DET GER?</div>
            <div className="ob-subtitle">
              Det finns säkert saker i din roll som dränerar dig.
              Det är viktig information — AI:n skapar inga uppdrag i de kategorierna.
            </div>
            <textarea
              className="ob-input"
              placeholder="Det som tömmer mig..."
              value={roleDrain}
              onChange={e => setRoleDrain(e.target.value)}
            />
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 6 && (
          <>
            <div className="ob-title">DITT DOLDA VÄRDE</div>
            <div className="ob-subtitle">
              Vad gör du för bandet som ingen lägger märke till?
              Det osynliga arbetet som skulle saknas om du försvann.
            </div>
            <textarea
              className="ob-input"
              placeholder="Det ingen ber om men som skulle saknas..."
              value={hiddenValue}
              onChange={e => setHiddenValue(e.target.value)}
            />
            <button className="ob-btn" onClick={next}>NÄSTA →</button>
          </>
        )}

        {step === 7 && (
          <>
            <div className="ob-title">VAD SER DU ATT INGEN GÖR?</div>
            <div className="ob-subtitle">
              Det finns säkert ett gap i bandet — något som borde hända
              men som ingen tagit ansvar för. Vad ser du?
            </div>
            <textarea
              className="ob-input"
              placeholder="Det jag ser att ingen gör..."
              value={gap}
              onChange={e => setGap(e.target.value)}
            />
            <button className="ob-btn" onClick={saveProfile}>NÄSTA →</button>
          </>
        )}

        {step === 8 && (
          <>
            <div className="ob-title">PROFIL SPARAD</div>
            <div className="ob-subtitle">
              Dina svar är sparade. Nu genererar vi personliga uppdrag
              baserade på vad du berättat.
            </div>
            <button className="ob-btn" onClick={next}>FORTSÄTT →</button>
          </>
        )}

        {step === 9 && (
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