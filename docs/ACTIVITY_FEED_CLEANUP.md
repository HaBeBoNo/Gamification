**Activity Feed Cleanup**
Kör de här filerna i ordning i Supabase SQL Editor:

1. [20260407_activity_feed_duplicate_audit.sql](/Users/t-nab/Documents/Gamification/supabase/manual/20260407_activity_feed_duplicate_audit.sql)
2. [20260407_activity_feed_duplicate_cleanup.sql](/Users/t-nab/Documents/Gamification/supabase/manual/20260407_activity_feed_duplicate_cleanup.sql)
3. [20260407_activity_feed_duplicate_verify.sql](/Users/t-nab/Documents/Gamification/supabase/manual/20260407_activity_feed_duplicate_verify.sql)

Viktiga avgränsningar:
- Cleanupen riktar in sig på top-level aktivitetsdubbletter, inte generella kommentarsdubbletter.
- Kommentartrådar, reaktioner, witnesses och notiser pekas om innan aktivitetsposter raderas.
- Källan till nya dubbletter är redan stoppad i klientkoden; det här är bara städning av historisk data.

Det du vill se:
- audit visar rimligt antal dubblettgrupper
- verify visar `0` i `duplicate_rows_remaining`
- verify visar `0` i orphan-kolumnerna
