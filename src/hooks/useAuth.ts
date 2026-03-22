import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MEMBERS } from '@/data/members';
import { S, save } from '@/state/store';
import { syncFromSupabase } from './useSupabaseSync';

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
        console.log('Auth event:', event, session?.user?.email);
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
    console.log('handleUser called for:', supabaseUser.email);
    setUser(supabaseUser);

    const email = supabaseUser.email?.toLowerCase();
    const match = Object.entries(MEMBERS).find(
      ([, m]) => (m as any).email?.toLowerCase() === email
    );

    if (match) {
      const key = match[0];
      setMemberKey(key);
      S.me = key;

      await syncFromSupabase(key).catch((e) => console.error('sync error:', e));

      console.log('After sync:', 'S.onboarded=', S.onboarded, 'S.me=', S.me);
      S.me = key;
      save();
    } else {
      console.log('No member match for email:', email);
      setMemberKey(null);
    }

    if (timeout) clearTimeout(timeout);
    setLoading(false);
    setSynced(true);
  }

  return { user, memberKey, loading, synced };
}

export function useSupabaseData(memberKey: string | null) {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!memberKey) return;

    syncFromSupabase(memberKey).then(() => {
      setSynced(true);
    }).catch(() => {
      setSynced(true);
    });
  }, [memberKey]);

  return { synced };
}