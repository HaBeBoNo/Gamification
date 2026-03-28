import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MEMBERS } from '@/data/members';
import { S, save } from '@/state/store';
import { syncFromSupabase } from './useSupabaseSync';
import { registerPush } from '@/lib/webPush';

const EMAIL_TO_MEMBER: Record<string, string> = {
  'hannes.norrby@gmail.com':  'hannes',
  'mschulzprivate@gmail.com': 'martin',
  'luddeslinser@gmail.com':   'ludvig',
  'johanneslincke@gmail.com': 'johannes',
  'simonfalk90@gmail.com':    'simon',
  'nilsmedskils@gmail.com':   'nisse',
  'niklas.arkhede@gmail.com': 'niklas',
  'callegh9351@gmail.com':    'carl',
}

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

    const memberKey = EMAIL_TO_MEMBER[supabaseUser.email ?? '']
    if (!memberKey) {
      console.warn('No member match for email:', supabaseUser.email)
      return
    }
    console.log('[Auth] Matched member:', memberKey)

    setMemberKey(memberKey);
    S.me = memberKey;

    await syncFromSupabase(memberKey).catch((e) => console.error('sync error:', e));

    console.log('After sync:', 'S.onboarded=', S.onboarded, 'S.me=', S.me);
    S.me = memberKey;
    save();

    // Register for push notifications (non-blocking)
    console.log('[Auth] Calling registerPush for:', memberKey)
    registerPush(memberKey).catch(e => console.error('[Push] Failed:', e));

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