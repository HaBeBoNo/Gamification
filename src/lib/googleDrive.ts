/**
 * googleDrive.ts
 * Google Drive REST API helpers (v3).
 * All calls use the access token from googleAuth.ts.
 */

import { getAuthHeader } from './googleAuth';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: 'application/vnd.google-apps.folder';
}

/**
 * List files in a folder (or root if folderId is omitted).
 * Returns files sorted by modifiedTime descending.
 */
export async function listFiles(folderId?: string): Promise<DriveFile[]> {
  const query = folderId
    ? `'${folderId}' in parents and trashed = false`
    : `'root' in parents and trashed = false`;

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents)',
    orderBy: 'modifiedTime desc',
    pageSize: '50',
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) throw new Error(`Drive listFiles failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.files ?? [];
}

/**
 * Upload a file to Drive.
 * Uses multipart upload for files with metadata.
 */
export async function uploadFile(
  file: File,
  folderId?: string
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = { name: file.name };
  if (folderId) metadata.parents = [folderId];

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`,
    {
      method: 'POST',
      headers: { Authorization: getAuthHeader() },
      body: form,
    }
  );

  if (!res.ok) throw new Error(`Drive uploadFile failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Get the shareable web link for a file.
 * Sets permission to 'anyone with the link can view' first.
 */
export async function getFileUrl(fileId: string): Promise<string> {
  // Ensure anyone with link can view
  await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  const params = new URLSearchParams({ fields: 'webViewLink' });
  const res = await fetch(`${DRIVE_API}/files/${fileId}?${params}`, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) throw new Error(`Drive getFileUrl failed: ${res.status}`);
  const data = await res.json();
  return data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Create a new folder in Drive.
 * Optionally nest inside a parent folder.
 */
export async function createFolder(
  name: string,
  parentFolderId?: string
): Promise<DriveFolder> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) metadata.parents = [parentFolderId];

  const res = await fetch(`${DRIVE_API}/files?fields=id,name,mimeType`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) throw new Error(`Drive createFolder failed: ${res.status}`);
  return res.json();
}

/**
 * Search for a folder by name.
 * Returns the first match or null.
 */
export async function findFolder(name: string): Promise<DriveFolder | null> {
  const params = new URLSearchParams({
    q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name,mimeType)',
    pageSize: '1',
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) throw new Error(`Drive findFolder failed: ${res.status}`);
  const data = await res.json();
  return data.files?.[0] ?? null;
}

/** Format file size from bytes to human-readable string */
export function formatFileSize(bytes?: string): string {
  if (!bytes) return '—';
  const n = parseInt(bytes, 10);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a Drive modifiedTime ISO string to a Swedish relative label */
export function formatDriveDate(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Idag';
  if (diffDays === 1) return 'Igår';
  if (diffDays < 7) return `${diffDays} dagar sedan`;
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

/** Map a Drive MIME type to a display category */
export function mimeToCategory(mimeType: string): string {
  if (mimeType.includes('audio')) return 'Music';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Table';
  return 'FileText';
}
