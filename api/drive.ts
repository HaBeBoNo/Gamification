import { JWT } from 'google-auth-library';
import type { IncomingMessage, ServerResponse } from 'http';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '149IJgnMfI9GBH813yTOhv-_leb8T59EU';

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      try {
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

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
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const token = await jwt.getAccessToken();

    if (req.method === 'POST') {
      const payload = await readJsonBody<{ name?: string; type?: string; dataBase64?: string }>(req);
      const name = String(payload?.name || '').trim();
      const mimeType = String(payload?.type || 'application/octet-stream');
      const dataBase64 = String(payload?.dataBase64 || '');

      if (!name || !dataBase64) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing file payload' }));
        return;
      }

      const metadata = {
        name,
        parents: [FOLDER_ID],
      };

      const boundary = `sektionen-${Date.now()}`;
      const prefix =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n';
      const suffix = `\r\n--${boundary}--`;
      const body = Buffer.concat([
        Buffer.from(prefix, 'utf8'),
        Buffer.from(dataBase64, 'utf8'),
        Buffer.from(suffix, 'utf8'),
      ]);

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,webViewLink,size',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': String(body.length),
          },
          body,
        }
      );

      const uploadData = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        res.statusCode = uploadRes.status;
        res.end(JSON.stringify({
          error: uploadData?.error?.message || 'Upload failed',
          details: uploadData,
        }));
        return;
      }

      res.statusCode = 200;
      res.end(JSON.stringify(uploadData));
      return;
    }

    const params = new URLSearchParams({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      orderBy: 'modifiedTime desc',
      pageSize: '30',
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${token.token}` } }
    );

    const data = await driveRes.json().catch(() => null);

    if (!driveRes.ok) {
      res.statusCode = driveRes.status;
      res.end(JSON.stringify({
        error: data?.error?.message || 'Drive fetch failed',
        details: data,
      }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify(data.files ?? []));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  }
}
