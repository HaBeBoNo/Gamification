import { supabase } from './supabase'
import { MEMBERS } from '@/data/members'
import { S, save } from '@/state/store'

export interface CollaborativeQuest {
  id: string
  quest_id: number
  quest_data: any
  initiator: string
  participants: string[]
  completed_by: string[]
  done: boolean
  created_at: string
  updated_at: string
}

// Hämta alla aktiva collaborative quests där S.me är deltagare
export async function fetchMyCollaborativeQuests(): Promise<CollaborativeQuest[]> {
  if (!supabase || !S.me) return []
  const { data, error } = await supabase
    .from('collaborative_quests')
    .select('*')
    .contains('participants', [S.me])
    .eq('done', false)
  if (error) {
    console.error('[CollabQuests] fetch error:', error)
    return []
  }
  return data ?? []
}

// Skapa ett nytt collaborative quest i Supabase
export async function createCollaborativeQuest(
  questData: any,
  participants: string[]
): Promise<CollaborativeQuest | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('collaborative_quests')
    .insert({
      quest_id: questData.id,
      quest_data: questData,
      initiator: S.me,
      participants,
      completed_by: [],
      done: false,
    })
    .select()
    .single()
  if (error) {
    console.error('[CollabQuests] create error:', error)
    return null
  }
  return data
}

// Markera att S.me har slutfört sin del
export async function completeMyPart(
  collabQuestId: string,
  currentCompletedBy: string[]
): Promise<{ allDone: boolean; completedBy: string[] } | null> {
  if (!supabase) return null
  const newCompletedBy = [...new Set([...currentCompletedBy, S.me])]
  const { data: quest } = await supabase
    .from('collaborative_quests')
    .select('participants')
    .eq('id', collabQuestId)
    .single()
  const allDone = quest?.participants?.every((p: string) => newCompletedBy.includes(p)) ?? false
  const { error } = await supabase
    .from('collaborative_quests')
    .update({
      completed_by: newCompletedBy,
      done: allDone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', collabQuestId)
  if (error) {
    console.error('[CollabQuests] complete error:', error)
    return null
  }
  return { allDone, completedBy: newCompletedBy }
}

// Prenumerera på realtidsuppdateringar för collaborative quests
export function subscribeCollaborativeQuests(
  onUpdate: (quest: CollaborativeQuest) => void
) {
  if (!supabase) return null
  return supabase
    .channel('collaborative_quests_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collaborative_quests',
      },
      (payload) => {
        const quest = payload.new as CollaborativeQuest
        if (quest.participants?.includes(S.me)) {
          onUpdate(quest)
        }
      }
    )
    .subscribe()
}
