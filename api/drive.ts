import { JWT } from 'google-auth-library';
import type { IncomingMessage, ServerResponse } from 'http';

const FOLDER_ID = '149IJgnMfI9GBH813yTOhv-_leb8T59EU';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Missing credentials' }));
    return;
  }

  try {
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

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${token.token}` } }
    );

    const data = await driveRes.json();

    res.statusCode = 200;
    res.end(JSON.stringify(data.files ?? []));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  }
}
