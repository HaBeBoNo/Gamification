import { useEffect, useState } from 'react';
import { syncToSupabase, syncFromSupabase } from './useSupabaseSync';
import { S } from '@/state/store';

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
