# Google Workspace Integration — Setup-guide

Denna guide förklarar hur du skapar ett Google Cloud-projekt, aktiverar nödvändiga APIs och hämtar ett Client ID för att aktivera Google-integrationen i Sektionen Headquarters.

---

## 1. Skapa ett Google Cloud-projekt

1. Gå till [Google Cloud Console](https://console.cloud.google.com/)
2. Klicka på projektväljaren uppe till vänster → **New Project**
3. Namnge projektet, t.ex. `sektionen-headquarters`
4. Klicka **Create**

---

## 2. Aktivera nödvändiga APIs

I Google Cloud Console, navigera till **APIs & Services → Library** och aktivera dessa APIs:

| API | Används för |
|-----|-------------|
| **Google Drive API** | Fillistning, uppladdning, delade mappar |
| **Google Calendar API** | Hämta och skapa kalenderhändelser |
| **Google Docs API** | Skapa och läsa dokument |
| **Google Sheets API** | Skapa och läsa kalkylark |
| **People API** | Hämta användarprofilbild och namn vid inloggning |

Sök på respektive namn i Library och klicka **Enable**.

---

## 3. Konfigurera OAuth-medgivandeskärm

1. Gå till **APIs & Services → OAuth consent screen**
2. Välj **External** (för testning) eller **Internal** (om ni kör Google Workspace för bandet)
3. Fyll i:
   - **App name:** Sektionen Headquarters
   - **User support email:** din e-post
   - **Developer contact information:** din e-post
4. Under **Scopes**, lägg till:
   - `openid`, `email`, `profile`
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/spreadsheets`
5. Under **Test users** (om External): lägg till e-postadresserna för bandmedlemmarna
6. Klicka **Save and Continue** tills du är klar

---

## 4. Skapa OAuth2-klientuppgifter

1. Gå till **APIs & Services → Credentials**
2. Klicka **+ Create Credentials → OAuth client ID**
3. Välj **Web application**
4. Fyll i:
   - **Name:** Sektionen Headquarters (Web)
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (lokal dev)
     - `http://localhost:8080` (alternativ port)
     - Din produktions-URL om du har en
   - **Authorized redirect URIs:** (lämna tomt — vi använder implicit flow via @react-oauth/google)
5. Klicka **Create**
6. Kopiera **Client ID** (ser ut som `xxxxx.apps.googleusercontent.com`)

---

## 5. Sätt Client ID i projektet

Öppna `.env.local` i projektets rot och klistra in ditt Client ID:

```env
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

> **OBS:** `.env.local` är gitignorerad och ska aldrig committas.

---

## 6. (Valfritt) Konfigurera bandets delade kalender

Om bandet har en delad Google-kalender:

1. Öppna [Google Kalender](https://calendar.google.com/)
2. Klicka på kugghjulet bredvid bandkalendern → **Settings and sharing**
3. Scrolla ner till **Integrate calendar** → kopiera **Calendar ID**
   (ser ut som `xxxxxxxx@group.calendar.google.com`)
4. Lägg till i `.env.local`:

```env
VITE_GOOGLE_CALENDAR_ID=xxxxxxxx@group.calendar.google.com
```

---

## 7. Starta appen

```bash
npm install
npm run dev
```

Gå till `http://localhost:5173`, navigera till **BandHub** och klicka **Anslut Google**.

---

## Felsökning

### "Access blocked: Authorization Error"
Din app är i testläge och din e-post är inte tillagd som testanvändare. Gå till OAuth consent screen → Test users och lägg till din e-post.

### "redirect_uri_mismatch"
Kontrollera att `http://localhost:5173` finns under **Authorized JavaScript origins** i Cloud Console.

### API-anrop returnerar 403
Kontrollera att rätt API är aktiverat (steg 2) och att OAuth-scopet är inkluderat i consent screen (steg 3).

### Tokens löper ut
Access tokens gäller i 1 timme. Appen visar exempeldata automatiskt om token har löpt ut — logga in igen via "Anslut Google"-knappen.

---

## Arkitektur

```
src/lib/
  googleAuth.ts     — OAuth2 token-hantering, localStorage
  googleDrive.ts    — Drive API v3 REST-anrop
  googleCalendar.ts — Calendar API v3 REST-anrop
  googleDocs.ts     — Docs API v1 + Drive REST-anrop
  googleSheets.ts   — Sheets API v4 + Drive REST-anrop

src/components/game/
  BandHub.tsx             — Huvudkomponent med GoogleOAuthProvider wrapper
  GoogleConnectButton.tsx — OAuth2 login/logout-knapp
```

> **OBS om `googleapis`-paketet:** Den här appen använder direkta REST-anrop till Google APIs (via `fetch`) istället för `googleapis` npm-paketet. Det beror på att `googleapis` är ett Node.js server-side-bibliotek som inte fungerar i webbläsaren. REST-varianten är identisk funktionsmässigt och fungerar korrekt i Vite/React.
