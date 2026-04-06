// ═══════════════════════════════════════════════════════════════
// claudeApi.ts — Lågnivå Anthropic API-klient för Sektionen
// Separerad från useAI för att kunna testas och återanvändas
// oberoende av spellogik.
// ═══════════════════════════════════════════════════════════════

import { AI_MODEL } from './config';
import { clearRuntimeIssue, setRuntimeIssue } from './runtimeHealth';

const API_URL = '/api/claude';
const MODEL   = AI_MODEL;

/**
 * callClaude(prompt, maxTokens)
 * Skickar ett meddelande till Claude API:et och returnerar textsvaret.
 * Kastar ett Error om anropet misslyckas.
 */
export async function callClaude(prompt: string, maxTokens = 400): Promise<string> {
  try {
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: maxTokens,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      setRuntimeIssue('ai', 'Coachen svarar inte just nu. Appen fortsatter i reservlage.', 'warn');
      throw new Error(`API ${res.status}`);
    }

    clearRuntimeIssue('ai');
    return (data.content?.[0]?.text as string) || '';
  } catch (error) {
    setRuntimeIssue('ai', 'Coachen svarar inte just nu. Appen fortsatter i reservlage.', 'warn');
    throw error;
  }
}

/**
 * parseJSON(raw)
 * Rensar markdown-kodblock och parsar JSON.
 */
export function parseJSON<T = unknown>(raw: string): T {
  return JSON.parse(raw.replace(/```json|```/g, '').trim()) as T;
}

/**
 * ts()
 * Returnerar aktuell tid som HH:MM-sträng (svensk locale).
 */
export function ts(): string {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}
