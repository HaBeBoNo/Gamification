import { describe, expect, it } from 'vitest';
import { getCompletedByMembers, wasQuestCompletedByMember } from './questUtils';

describe('questUtils collaborative completion helpers', () => {
  it('reads completed members from both camelCase and snake_case', () => {
    expect(getCompletedByMembers({ completedBy: ['hannes', 'ludvig'] })).toEqual(['hannes', 'ludvig']);
    expect(getCompletedByMembers({ completed_by: ['nisse'] })).toEqual(['nisse']);
  });

  it('treats snake_case collaborative completions as completed', () => {
    expect(wasQuestCompletedByMember({ completed_by: ['niklas'] }, 'niklas')).toBe(true);
    expect(wasQuestCompletedByMember({ completed_by: ['niklas'] }, 'hannes')).toBe(false);
  });
});
