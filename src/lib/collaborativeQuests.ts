import { supabase } from './supabase'
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

function normalizeCompletedBy(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value === 'string' && value) return [value]
  return []
}

function syncCollaborativeQuestIntoStore(row: CollaborativeQuest | Record<string, any>) {
  const completedBy = normalizeCompletedBy((row as any).completed_by ?? (row as any).completedBy)
  const existing = S.quests.find((q: any) => q.id === row.quest_id)

  if (!existing) {
    S.quests.push({
      id: row.quest_id,
      title: row.quest_data?.title ?? '',
      desc: row.quest_data?.desc ?? '',
      xp: row.quest_data?.xp ?? 0,
      cat: row.quest_data?.cat ?? '',
      collaborative: true,
      participants: row.participants ?? [],
      initiator: row.initiator,
      done: row.done ?? false,
      completedBy,
      completed_by: completedBy,
      owner: row.initiator,
      region: 'Global',
      recur: 'none',
      type: 'collaborative',
      personal: false,
    } as any)
    return
  }

  existing.participants = row.participants ?? []
  existing.initiator = row.initiator
  existing.done = row.done ?? false
  existing.completedBy = completedBy
  existing.completed_by = completedBy
}

// Hämta alla collaborative quests där S.me är initiator eller deltagare
export async function fetchMyCollaborativeQuests(): Promise<CollaborativeQuest[]> {
  if (!supabase || !S.me) return []
  const { data, error } = await supabase
    .from('collaborative_quests')
    .select('*')
    .or(`initiator.eq.${S.me},participants.cs.{${S.me}}`)
  if (error || !data) {
    console.error('[CollabQuests] fetch error:', error)
    return []
  }

  const activeRows = data.filter((row) => !row.done)

  // Synka till S.quests
  for (const row of data) {
    syncCollaborativeQuestIntoStore(row)
  }

  return activeRows
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
      quest_data: {
        title: questData.title,
        desc: questData.desc ?? '',
        xp: questData.xp,
        cat: questData.cat ?? '',
      },
      initiator: S.me,
      participants,
      completed_by: [],
      done: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
  if (!supabase || !S.me) return null
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

export async function joinCollaborativeQuest(
  questId: number,
  memberKey: string
): Promise<CollaborativeQuest | null> {
  if (!supabase || !memberKey) return null

  let attempts = 0

  while (attempts < 3) {
    attempts += 1

    const { data: row, error: fetchError } = await supabase
      .from('collaborative_quests')
      .select('*')
      .eq('quest_id', questId)
      .single()

    if (fetchError || !row) {
      console.error('[CollabQuests] join fetch error:', fetchError)
      return null
    }

    const currentParticipants = Array.isArray(row.participants) ? row.participants.filter(Boolean) : []
    if (currentParticipants.includes(memberKey)) {
      syncCollaborativeQuestIntoStore(row)
      return row as CollaborativeQuest
    }

    const nextParticipants = [...new Set([...currentParticipants, memberKey])]
    const nextUpdatedAt = new Date().toISOString()

    const { data: updatedRows, error: updateError } = await supabase
      .from('collaborative_quests')
      .update({
        participants: nextParticipants,
        updated_at: nextUpdatedAt,
      })
      .eq('quest_id', questId)
      .eq('updated_at', row.updated_at)
      .select('*')

    if (updateError) {
      console.warn('[CollabQuests] join update error:', updateError)
      continue
    }

    const updated = updatedRows?.[0]
    if (updated) {
      syncCollaborativeQuestIntoStore(updated)
      save()
      return updated as CollaborativeQuest
    }
  }

  console.warn('[CollabQuests] join aborted after concurrent retries')
  return null
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
        if (S.me && quest.participants?.includes(S.me)) {
          syncCollaborativeQuestIntoStore(quest)
          onUpdate(quest)
        }
      }
    )
    .subscribe()
}
