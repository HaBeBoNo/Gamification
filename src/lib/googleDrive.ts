export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  size?: string;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const payload = await res.json();
    const message = payload?.error || payload?.details?.error?.message || payload?.details?.message;
    return typeof message === 'string' && message ? message : 'Okänt Drive-fel';
  } catch {
    return 'Okänt Drive-fel';
  }
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
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message);
  }
  return res.json();
}

export async function getRecentFiles(): Promise<DriveFile[]> {
  return getDriveFiles();
}

export async function uploadFile(file: File): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const res = await fetch('/api/drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      type: file.type || 'application/octet-stream',
      dataBase64: btoa(binary),
    }),
  });

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message);
  }
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
