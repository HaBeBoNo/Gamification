import { S, save } from '@/state/store';
import type { ResponseProfile } from '@/types/game';

const RECALIBRATION_THRESHOLD = 10; // antal interaktioner innan re-kalibrering

export async function maybeRecalibrateCoach(memberKey: string): Promise<void> {
  const char = S.chars[memberKey];
  if (!char) return;

  const coachLog = char.coachLog || [];
  const lastCalibration = char.lastCalibration || 0;
  const interactionsSinceLast = coachLog.filter(
    (entry: any) => entry.ts > lastCalibration
  ).length;

  // Kör bara om tillräckligt många interaktioner sedan senaste kalibrering
  if (interactionsSinceLast < RECALIBRATION_THRESHOLD) return;

  // Hämta de senaste 10 interaktionerna
  const recentInteractions = coachLog.slice(-10);
  const recentText = recentInteractions
    .map((entry: any) => `Member: ${entry.user}\nCoach: ${entry.coach}`)
    .join('\n\n');

  const snapshot = (char.responseProfile as ResponseProfile | undefined)?.onboardingSnapshot?.rawAnswers || [];
  const snapshotText = snapshot.join('\n');

  const prompt = `Du analyserar hur en persons kommunikationsstil har förändrats över tid.\n\nOnboarding-svar (hur de kommunicerade från början):\n${snapshotText}\n\nSenaste 10 coach-interaktioner (hur de kommunicerar nu):\n${recentText}\n\nReturnera ENBART ett JSON-objekt utan markdown eller förklaringar:\n{\n  "tone": "analytical" | "emotional" | "neutral",\n  "register": "concrete" | "abstract" | "mixed",\n  "languageComplexity": "simple" | "moderate" | "complex",\n  "pronounDominance": "jag" | "vi" | "man",\n  "dominantTheme": "kort beskrivning av vad personen fokuserar på nu",\n  "silences": ["dimensioner som fortfarande är frånvarande"],\n  "drift": "beskrivning av hur kommunikationen förändrats sedan onboarding, eller null om ingen tydlig förändring"\n}`;

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim().replace(/```json|```/g, '');
    const updated = JSON.parse(text);

    // Uppdatera responseProfile med nya värden
    const profile = char.responseProfile as ResponseProfile | undefined;
    if (profile) {
      profile.tone               = updated.tone;
      profile.register           = updated.register;
      profile.languageComplexity = updated.languageComplexity;
      profile.pronounDominance   = updated.pronounDominance;
      profile.dominantTheme      = updated.dominantTheme;
      profile.silences           = updated.silences;
      profile.drift              = updated.drift || null;
    }

    // Spara tidpunkt för kalibrering
    char.lastCalibration = Date.now();
    save();

  } catch {
    // Tyst fel — påverkar inte användarupplevelsen
  }
}