import { JWT } from 'google-auth-library';

const FOLDER_ID = '149IJgnMfI9GBH813yTOhv-_leb8T59EU';

export const config = { runtime: 'edge' };

export default async function handler() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 500 });
  }

  const creds = JSON.parse(raw);

  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const token = await jwt.getAccessToken();

  const params = new URLSearchParams({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: '30',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${token.token}` } }
  );

  const data = await res.json();

  return new Response(JSON.stringify(data.files ?? []), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
