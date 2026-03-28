/**
 * useResponseProfile.ts
 * Builds a linguistic/behavioral profile from onboarding answers
 * by calling the Claude API and returning structured JSON.
 */

import { callClaude, parseJSON } from '../lib/claudeApi';
import type { ResponseProfile } from '../types/game';

export type { ResponseProfile };

/**
 * buildResponseProfile(answers)
 * @param answers - Array of 5 onboarding answers
 * @returns Parsed ResponseProfile, or null on failure
 */
export async function buildResponseProfile(answers: string[]): Promise<ResponseProfile | null> {
  const prompt = `Du får fem svar från en onboarding-enkät för en musikband-app.
Analysera svaren och returnera ENBART ett JSON-objekt med följande struktur.
Inga förklaringar, ingen text utanför JSON.

Svar:
${answers.map((a, i) => `Fråga ${i + 1}: ${a}`).join('\n')}

Returnera detta JSON-objekt:
{
  "verbosity": [1-5 per fråga baserat på svarslängd],
  "resonanceScore": [0.1-2.0 per fråga relativt personens eget snitt],
  "register": "concrete" | "abstract" | "mixed",
  "tone": "analytical" | "emotional" | "neutral",
  "languageComplexity": "simple" | "moderate" | "complex",
  "metaphorical": true | false,
  "pronounDominance": "jag" | "vi" | "man",
  "dominantTheme": "kortaste möjliga beskrivning av vad personen återkommer till",
  "silences": ["dimensioner som är helt frånvarande i svaren"],
  "tensions": ["par av svar som pekar i olika riktningar"],
  "engagement": "surface" | "deep",
  "resonantQuestions": [index på de 1-2 frågor som väckte mest, 0-baserat],
  "onboardingSnapshot": {
    "rawAnswers": [de fem svaren],
    "completedAt": ${Date.now()}
  },
  "drift": null
}`;

  try {
    const text = await callClaude(prompt, 1000);
    return parseJSON<ResponseProfile>(text);
  } catch {
    return null;
  }
}
