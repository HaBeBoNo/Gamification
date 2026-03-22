import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { syncFromSupabase } from './useSupabaseSync';

// ── useAuth: listens to Supabase auth state and returns { user, loading } ──
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      // Supabase not configured — skip auth gate, treat as not logged in
      setUser(null);
      setLoading(false);
      return;
    }

    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
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