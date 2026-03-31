export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  size?: string;
}

function getCategory(file: DriveFile): 'inspelningar' | 'dokument' | 'bilder' | 'ovrigt' {
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

export async function getDriveFiles(): Promise<DriveFile[]> {
  const res = await fetch('/api/drive');
  if (!res.ok) return [];
  const files: DriveFile[] = await res.json();
  return files;
}

export { getCategory };
