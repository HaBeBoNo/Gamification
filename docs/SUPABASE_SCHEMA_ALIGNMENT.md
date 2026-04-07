**Supabase Schema Alignment**
Den här aligneringen gör två saker:

1. Repo:t speglar nu live-Supabase bättre.
2. En säker migration finns för att normalisera äldre driftmiljöer.

Viktigaste skillnaderna som nu fångas upp:
- `activity_feed.type` ersätts av `activity_feed.category`
- `activity_feed.meta` bevaras som legacy, medan `activity_feed.metadata` är den nya kanoniska JSON-kolumnen
- `activity_feed.witnesses` normaliseras till `jsonb`
- `member_data` får även `endorsements` och `mvp_badge`
- `push_subscriptions.updated_at` läggs till om den saknas

Kör i Supabase SQL Editor:
- [20260407_schema_alignment.sql](/Users/t-nab/Documents/Gamification/supabase/migrations/20260407_schema_alignment.sql)

Efter körning är det bra att göra en hård reload av appen och snabbt kontrollera:
- aktivitetstrådar
- reaktioner
- `Jag var där`
- push-registrering
