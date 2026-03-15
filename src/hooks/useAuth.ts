import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser]           = useState<User | null>(null);
  const [memberKey, setMemberKey] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    // Om supabase inte är konfigurerat — skippa auth
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMemberKey(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchMemberKey(session.user.id);
        } else {
          setMemberKey(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchMemberKey(userId: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('member_key')
      .eq('id', userId)
      .single();

    setMemberKey(data?.member_key ?? null);
    setLoading(false);
  }

  /** Skapa profil för ny användare — anropas när member väljer sin roll */
  async function createProfile(userId: string, mk: string) {
    if (!supabase) return;
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      member_key: mk,
      email: user?.email ?? '',
    });
    if (!error) setMemberKey(mk);
  }

  return { user, memberKey, loading, createProfile };
}
