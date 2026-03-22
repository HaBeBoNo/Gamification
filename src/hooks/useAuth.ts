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

    // Hantera OAuth-callback från URL-hash (Chrome/implicit) eller query-params (Safari/PKCE)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get('access_token');
    if (accessToken) {
      // Rensa hash från URL utan reload
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Safari/PKCE skickar code + code_verifier som query-params — rensa dem efter att
    // Supabase har hanterat dem så att de inte triggar om vid reload
    const searchParams = new URLSearchParams(window.location.search);
    const oauthCode = searchParams.get('code');
    if (oauthCode) {
      window.history.replaceState(null, '', window.location.pathname);
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
        console.log('Auth event:', event, 'user:', session?.user?.email);
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
      console.log('=== AUTH DEBUG ===');
      console.log('memberKey:', key);
      console.log('S.me:', S.me);
      console.log('S.onboarded:', S.onboarded);
      console.log('S.chars[key]?.onboarded:', S.chars[key]?.onboarded);
      console.log('localStorage sek-v6:', localStorage.getItem('sek-v6')?.substring(0, 200));
      console.log('==================');
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