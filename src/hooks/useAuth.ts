import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MEMBERS } from '@/data/members';
import { S, save } from '@/state/store';
import { syncFromSupabase } from './useSupabaseSync';

// ── useAuth: listens to Supabase auth state, syncs member data, returns { user, memberKey, loading, synced } ──
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [memberKey, setMemberKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setSynced(true);
      return;
    }

    const timeout = setTimeout(() => {
      setLoading(false);
      setSynced(true);
    }, 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUser(session.user, timeout);
      } else {
        clearTimeout(timeout);
        setLoading(false);
        setSynced(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await handleUser(session.user, timeout);
        } else {
          clearTimeout(timeout);
          setUser(null);
          setMemberKey(null);
          setLoading(false);
          setSynced(true);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function handleUser(supabaseUser: any, timeout?: ReturnType<typeof setTimeout>) {
    setUser(supabaseUser);

    const email = supabaseUser.email?.toLowerCase();
    const match = Object.entries(MEMBERS).find(
      ([, m]) => (m as any).email?.toLowerCase() === email
    );

    if (match) {
      const key = match[0];
      setMemberKey(key);
      S.me = key;

      // Vänta på full sync innan vi sätter synced=true
      await syncFromSupabase(key).catch((e) => console.error('sync error:', e));
      console.log('After sync — S.onboarded:', S.onboarded, 'S.me:', S.me);
      S.me = key;
      save();
    } else {
      setMemberKey(null);
    }

    if (timeout) clearTimeout(timeout);
    setLoading(false);
    setSynced(true);
  }

  return { user, memberKey, loading, synced };
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