import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { syncFromSupabase } from './useSupabaseSync';

// ── useAuth: listens to Supabase auth state, syncs member data, returns { user, memberKey, loading } ──
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [memberKey, setMemberKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function handleUser(supabaseUser: any) {
    setUser(supabaseUser);

    if (!supabaseUser) {
      setMemberKey(null);
      setLoading(false);
      return;
    }

    const email = supabaseUser.email?.toLowerCase();
    const match = Object.entries(MEMBERS).find(
      ([, m]) => (m as any).email?.toLowerCase() === email
    );

    if (match) {
      const key = match[0];
      setMemberKey(key);
      S.me = key;

      // Vänta på Supabase-sync innan loading sätts till false
      await syncFromSupabase(key).catch(() => {});
      save();
    } else {
      setMemberKey(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!supabase) {
      // Supabase not configured — skip auth gate, treat as not logged in
      setUser(null);
      setLoading(false);
      return;
    }

    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleUser(session.user);
      } else {
        setUser(null);
        setMemberKey(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, memberKey, loading };
}

// ── useSupabaseData: syncs game data from Supabase after member is selected ──
export function useSupabaseData(memberKey: string | null) {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!memberKey) return;

    // Hämta data från Supabase när member loggar in
    syncFromSupabase(memberKey).then(() => {
      setSynced(true);
    }).catch(() => {
      // Om Supabase inte svarar — fortsätt med localStorage
      setSynced(true);
    });
  }, [memberKey]);

  return { synced };
}