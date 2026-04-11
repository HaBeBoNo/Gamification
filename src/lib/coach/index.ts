import { getCoachContext, type CoachContext } from './coachContext';
import {
  buildCoachPromptFromContext,
  buildDailyCoachPromptFromContext,
  buildGhostPromptFromContext,
  DEFAULT_COACH_NAMES,
  WELCOME_MESSAGES,
} from './coachPrompts';
import { CoachPolicy } from './coachPolicy';

export { getCoachContext, type CoachContext } from './coachContext';
export { CoachPolicy } from './coachPolicy';
export {
  buildCoachPromptFromContext,
  buildDailyCoachPromptFromContext,
  buildGhostPromptFromContext,
  DEFAULT_COACH_NAMES,
  WELCOME_MESSAGES,
} from './coachPrompts';

export function buildCoachPrompt(input: string | CoachContext): string {
  const context = typeof input === 'string' ? getCoachContext(input) : input;
  return buildCoachPromptFromContext(context);
}

export function buildDailyCoachPrompt(input: string | CoachContext): string {
  const context = typeof input === 'string' ? getCoachContext(input) : input;
  return buildDailyCoachPromptFromContext(context);
}

export function buildGhostPrompt(input: string | CoachContext): string {
  const context = typeof input === 'string' ? getCoachContext(input) : input;
  return buildGhostPromptFromContext(context);
}
