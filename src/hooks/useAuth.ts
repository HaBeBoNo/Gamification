import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EMAIL_TO_MEMBER } from '@/data/members';
import { S, save } from '@/state/store';
import { syncFromSupabase } from './useSupabaseSync';

async function ensureProfileRecord(supabaseUser: any, memberKey: string): Promise<boolean> {
  if (!supabase || !supabaseUser?.id || !memberKey) return false;

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: supabaseUser.id,
      member_key: memberKey,
      email: String(supabaseUser.email || '').trim().toLowerCase() || null,
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.warn('[Auth] Could not ensure profile row:', error.message);
    window.dispatchEvent(new CustomEvent('sek:auth-error', {
      detail: { message: 'Kopplingen till bandidentiteten blev inte helt klar. Logga ut och in igen om notiser saknas.' },
    }));
    return false;
  }

  return true;
}

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [memberKey, setMemberKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  const handleUser = useCallback(async (supabaseUser: any) => {
    const email = String(supabaseUser?.email || '').trim().toLowerCase();
    const resolvedMemberKey = EMAIL_TO_MEMBER[email];

    if (!resolvedMemberKey) {
      setUser(null);
      setMemberKey(null);
      S.me = null;
      save();
      window.dispatchEvent(new CustomEvent('sek:auth-error', {
        detail: { message: `Okänd e-postadress: ${email || 'saknas'}. Kontakta Hannes.` },
      }));
      setLoading(false);
      setSynced(true);
      if (supabase) void supabase.auth.signOut();
      return;
    }

    setUser(supabaseUser);
    setMemberKey(resolvedMemberKey);
    S.me = resolvedMemberKey;
    save();

    setLoading(false);
    setSynced(true);

    await ensureProfileRecord(supabaseUser, resolvedMemberKey);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setSynced(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUser(session.user);
      } else {
        setLoading(false);
        setSynced(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await handleUser(session.user);
        } else {
          setUser(null);
          setMemberKey(null);
          S.me = null;
          setLoading(false);
          setSynced(true);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleUser]);

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
