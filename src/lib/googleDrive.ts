import { supabase } from './supabase';
import { getAccessToken, getGoogleAccessToken } from './googleAuth';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  size?: string;
}

type PinSource = 'shared' | 'local';

const LEGACY_PINNED_IDS_KEY = 'sektionen_pinned_files';
const DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '149IJgnMfI9GBH813yTOhv-_leb8T59EU';

async function getDriveUploadAccessToken(): Promise<string> {
  const localToken = getAccessToken();
  if (localToken) return localToken;

  const providerToken = await getGoogleAccessToken();
  if (providerToken) return providerToken;

  throw new Error('Anslut Google i Band Hub för att kunna ladda upp filer.');
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

function loadLegacyPinnedIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_PINNED_IDS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveLegacyPinnedIds(ids: string[]): void {
  localStorage.setItem(LEGACY_PINNED_IDS_KEY, JSON.stringify([...new Set(ids.filter(Boolean))]));
}

function isMissingDrivePinsResourceError(error: unknown): boolean {
  const message = String((error as any)?.message || (error as any)?.details || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the relation') ||
    message.includes('schema cache') ||
    message.includes('permission denied') ||
    message.includes('42p01') ||
    message.includes('42501') ||
    message.includes('pgrst205')
  );
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

export async function uploadFile(file: File): Promise<DriveFile> {
  if (!DRIVE_FOLDER_ID) {
    throw new Error('Drive-mappen är inte konfigurerad.');
  }

  const accessToken = await getDriveUploadAccessToken();

  const metadata = {
    name: file.name,
    parents: [DRIVE_FOLDER_ID],
  };

  const boundary = `sektionen-upload-${Date.now()}`;
  const multipartBody = new Blob([
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    '\r\n',
    `--${boundary}\r\n`,
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,webViewLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message);
  }

  return res.json();
}

export async function fetchPinnedFileIds(): Promise<{ ids: string[]; source: PinSource }> {
  if (!supabase) {
    return { ids: loadLegacyPinnedIds(), source: 'local' };
  }

  const { data, error } = await supabase
    .from('drive_pins')
    .select('file_id')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingDrivePinsResourceError(error)) {
      return { ids: loadLegacyPinnedIds(), source: 'local' };
    }
    throw error;
  }

  const ids = [...new Set((data || []).map((row: any) => String(row.file_id || '')).filter(Boolean))] as string[];
  saveLegacyPinnedIds(ids);
  return { ids, source: 'shared' };
}

export async function togglePinnedFile(fileId: string, pinned: boolean, memberKey?: string | null): Promise<PinSource> {
  if (!fileId) return 'local';

  const applyLocalToggle = () => {
    const current = new Set(loadLegacyPinnedIds());
    if (pinned) current.delete(fileId);
    else current.add(fileId);
    saveLegacyPinnedIds([...current]);
  };

  if (!supabase || !memberKey) {
    applyLocalToggle();
    return 'local';
  }

  if (pinned) {
    const { error } = await supabase
      .from('drive_pins')
      .delete()
      .eq('file_id', fileId);

    if (error) {
      if (isMissingDrivePinsResourceError(error)) {
        applyLocalToggle();
        return 'local';
      }
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('drive_pins')
      .upsert({
        file_id: fileId,
        pinned_by: memberKey,
      }, {
        onConflict: 'file_id',
      });

    if (error) {
      if (isMissingDrivePinsResourceError(error)) {
        applyLocalToggle();
        return 'local';
      }
      throw error;
    }
  }

  const nextIds = new Set(loadLegacyPinnedIds());
  if (pinned) nextIds.delete(fileId);
  else nextIds.add(fileId);
  saveLegacyPinnedIds([...nextIds]);
  return 'shared';
}

export function subscribePinnedFiles(onChange: () => void) {
  if (!supabase) return null;

  return supabase
    .channel('drive_pins_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'drive_pins',
    }, () => onChange())
    .subscribe();
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
