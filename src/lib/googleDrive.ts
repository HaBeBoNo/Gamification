import { getGoogleAccessToken } from './googleAuth';

const FOLDER_ID = '149IJgnMfI9GBH813yTOhv-_leb8T59EU';

async function getAccessToken(): Promise<string | null> {
  return getGoogleAccessToken();
}

export async function getDriveFiles(folderId = FOLDER_ID) {
  const token = await getAccessToken();
  if (!token) return [];

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: '20',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

export async function getRecentFiles() {
  return getDriveFiles(FOLDER_ID);
}

export async function uploadFile(file: File) {
  const token = await getAccessToken();
  if (!token) throw new Error('Inte inloggad');

  const metadata = {
    name: file.name,
    parents: [FOLDER_ID],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) throw new Error('Uppladdning misslyckades');
  return res.json();
}

export function getMimeTypeLabel(mimeType: string): string {
  if (mimeType.includes('folder')) return 'Mapp';
  if (mimeType.includes('document')) return 'Dokument';
  if (mimeType.includes('spreadsheet')) return 'Kalkylark';
  if (mimeType.includes('presentation')) return 'Presentation';
  if (mimeType.includes('audio')) return 'Ljud';
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('image')) return 'Bild';
  if (mimeType.includes('pdf')) return 'PDF';
  return 'Fil';
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sv-SE', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}