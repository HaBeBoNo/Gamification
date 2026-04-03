export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  size?: string;
}

export function getCategory(file: DriveFile): 'inspelningar' | 'dokument' | 'bilder' | 'ovrigt' {
  const { mimeType, name } = file;
  if (
    mimeType.includes('audio') ||
    name.endsWith('.wav') ||
    name.endsWith('.mp3') ||
    name.endsWith('.aif') ||
    name.endsWith('.zip')
  ) return 'inspelningar';
  if (mimeType.includes('image') || name.endsWith('.png') || name.endsWith('.jpg'))
    return 'bilder';
  if (
    mimeType.includes('document') ||
    mimeType.includes('pdf') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation')
  ) return 'dokument';
  return 'ovrigt';
}

// Fetches via service account proxy — no OAuth token required
export async function getDriveFiles(): Promise<DriveFile[]> {
  const res = await fetch('/api/drive');
  if (!res.ok) return [];
  return res.json();
}

export async function getRecentFiles(): Promise<DriveFile[]> {
  return getDriveFiles();
}

// kept for BandHub upload button
export async function uploadFile(file: File): Promise<void> {
  const { getGoogleAccessToken } = await import('./googleAuth');
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Inte inloggad');

  const FOLDER_ID = '149IJgnMfI9GBH813yTOhv-_leb8T59EU';
  const metadata = { name: file.name, parents: [FOLDER_ID] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) throw new Error('Uppladdning misslyckades');
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
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
