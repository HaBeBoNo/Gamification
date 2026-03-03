import React, { useState } from 'react';
import { S, save, defChar } from '../state/store';
import { MEMBERS } from '../data/members';
import { generatePersonalQuests } from '../hooks/useAI';
import { BASE_QUESTS } from '../data/quests';

const TOTAL_STEPS = 10;

const MEMBER_ROLE_COPY = {
  hannes:   "Det verkar som att du ofta ser vad bandet behöver kommunicera innan någon annan formulerat det. Berättelsen runt musiken — är det något du känner dig hemma i, eller är det en roll du tagit på dig av andra anledningar?",
  ludvig:   "Det verkar som att du ofta är den folk söker upp när något behöver landas. Det är ett sätt att vara i ett band som är svårt att sätta ord på — och svårt att ersätta. Hur upplever du din roll just nu?",
  martin:   "Det verkar som att du har ett öga för när något inte är helt rätt ännu — och att du inte släpper det förrän det är det. Den här säsongen, vad är det som kräver den noggrannheten mest?",
  nisse:    "Streams, räckvidd, nya lyssnare — oavsett var de kommer ifrån. Det är det som rör sig framåt. Ser du att det du gör faktiskt ger resultat, gör du det med allt du har. Vad rör sig just nu?",
  simon:    "Det verkar som att folk litar på dig — och att det är därifrån dina bästa affärsmöjligheter växer fram. Bokningar, samarbeten, sponsorer. Stämmer det med hur du upplever din roll, eller är det något annat som känns viktigare just nu?",
  johannes: "Merch, logistik, konsertuppbyggnad — det är ditt territorium. Ingen annan i bandet har den överblicken. Den här säsongen, vad är det första du vill sätta din prägel på?",
  carl:     "Bidragsansökningar är en konstform — det handlar lika mycket om att förstå vem som läser som vad du skriver. Du verkar ha ett naturligt öga för hur folk tänker. Stämmer det med hur du upplever dig själv?",
  niklas:   "Varje kabel som sitter rätt, varje system som fungerar, varje replokal som är redo — det är grunden som allt annat vilar på. Utan den grunden händer ingenting av det som syns. Den här säsongen bygger vi något. Du är en del av det från grunden upp.",
};

export default function Onboarding({ rerender }) {
  const [step, setStep] = useState(0);
  const [selectedMember, setSelectedMember] = useState(null);
  const [motivation, setMotivation] = useState('');
  const [roleEnjoy, setRoleEnjoy] = useState('');
  const [roleDrain, setRoleDrain] = useState('');
  const [hiddenValue, setHiddenValue] = useState('');
  const [gap, setGap] = useState('');
  const [roleReaction, setRoleReaction] = useState('');
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
    char.roleReaction = roleReaction;
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
    if (selectedMember && S.chars[selectedMember]) {
      S.chars[selectedMember].onboardedAt = Date.now();
    }
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
            <div className="ob-role-question">Känner du igen dig i det här?</div>
            <div className="ob-role-options">
              <button onClick={() => { setRoleReaction('yes'); next(); }}>Ja, det stämmer</button>
              <button onClick={() => { setRoleReaction('partly'); next(); }}>Delvis</button>
              <button onClick={() => { setRoleReaction('no'); next(); }}>Inte riktigt</button>
            </div>
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
              {selectedMember === 'ludvig'
                ? 'Vad gör du faktiskt — det som känns naturligt, inte det som står i din titel?'
                : selectedMember === 'carl'
                ? `Vad gör du i din roll som ${member?.role}? Om du inte vet än — vad skulle du vilja att det var?`
                : `Vad gör du faktiskt — det du gör med glädje, utan att det känns som jobb?`}
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
              {selectedMember === 'ludvig'
                ? 'Vad skulle saknas om du försvann — inte rollen, utan du?'
                : selectedMember === 'martin'
                ? 'Vad kan du som ingen annan vet om? Det kan vara erfarenhet, ett nätverk, ett sätt att tänka.'
                : selectedMember === 'niklas'
                ? 'Vad kan du som ingen annan i bandet ens förstår att de behöver?'
                : 'Vad gör du för bandet som ingen lägger märke till?'}
            </div>
            <textarea
              className="ob-input"
              placeholder={selectedMember === 'johannes'
                ? 'Det jag alltid gör som ingen ber om...'
                : 'Det ingen ber om men som skulle saknas...'}
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
              {selectedMember === 'ludvig'
                ? 'Vad saknar bandet som ingen pratar om?'
                : selectedMember === 'carl'
                ? 'Det jag ser att ingen gör — eller vad jag önskar att någon tog tag i.'
                : 'Det finns säkert ett gap i bandet — något som borde hända men som ingen tagit ansvar för. Vad ser du?'}
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